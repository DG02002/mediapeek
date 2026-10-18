import { Schema } from "effect"

import {
  MAX_PRIVATEBIN_RESPONSE_BYTES,
  PRIVATEBIN_UPLOAD_TIMEOUT_MS,
} from "~/constants"

import { PrivateBinResponseSchema } from "./schemas/privatebin"

const privateBinHost = "https://privatebin.net"

// Helper to encode ArrayBuffer to Base64 (Standard)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return window.btoa(binary)
}

export async function uploadToPrivateBin(
  content: string,
  signal?: AbortSignal
): Promise<{ url: string; deleteUrl: string }> {
  const { keyBytes, payload } = await encryptPrivateBinContent(content)

  const timeoutSignal = AbortSignal.timeout(PRIVATEBIN_UPLOAD_TIMEOUT_MS)

  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(`${privateBinHost}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "JSONHttpRequest",
    },
    body: JSON.stringify(payload),
    signal: requestSignal,
  })

  const result = await parsePrivateBinResponse(response, requestSignal)
  const keyBase58 = toBase58(keyBytes)

  return {
    url: `${privateBinHost}/?${result.id}#${keyBase58}`,
    deleteUrl: `${privateBinHost}/?pasteid=${result.id}&deletetoken=${result.deletetoken}`,
  }
}

const encryptPrivateBinContent = async (content: string) => {
  const keyBytes = window.crypto.getRandomValues(new Uint8Array(32))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const salt = window.crypto.getRandomValues(new Uint8Array(8))
  const iterations = 100000
  const keySize = 256
  const tagSize = 128

  const passphraseKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey", "deriveBits"]
  )

  const cryptoKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: keySize },
    false,
    ["encrypt"]
  )

  const cryptoParams = [
    arrayBufferToBase64(iv.buffer),
    arrayBufferToBase64(salt.buffer),
    iterations,
    keySize,
    tagSize,
    "aes",
    "gcm",
    "none",
  ]

  const adata = [
    cryptoParams,
    "plaintext", // format
    0, // open_discussion
    0, // burn_after_reading
  ]

  const adataJson = JSON.stringify(adata)
  const adataBytes = new TextEncoder().encode(adataJson)

  const encodedContent = new TextEncoder().encode(
    JSON.stringify({ paste: content })
  )

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: adataBytes,
      tagLength: 128,
    },
    cryptoKey,
    encodedContent
  )

  return {
    keyBytes,
    payload: {
      v: 2,
      adata,
      ct: arrayBufferToBase64(encrypted),
      meta: {
        expire: "1week",
      },
    },
  }
}

const parsePrivateBinResponse = async (
  response: Response,
  signal: AbortSignal
) => {
  if (!response.ok) {
    throw new Error(
      `PrivateBin upload failed: ${response.statusText} (${String(response.status)})`
    )
  }

  const responseBody = await readPrivateBinResponseBody(response, signal)
  let json: unknown

  try {
    json = JSON.parse(responseBody)
  } catch {
    throw new Error("PrivateBin returned malformed data.")
  }

  const result = Schema.decodeUnknownSync(PrivateBinResponseSchema)(json)

  if (result.status !== 0) {
    throw new Error(`PrivateBin error: Status ${String(result.status)}`)
  }

  return result
}

interface PrivateBinBodyReadState {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  readonly signal: AbortSignal
  readonly chunks: Uint8Array[]
  byteLength: number
}

const readNextPrivateBinResponseChunk = async (
  state: PrivateBinBodyReadState
): Promise<void> => {
  state.signal.throwIfAborted()
  const { done, value } = await state.reader.read()

  if (done) {
    return
  }

  if (value.byteLength > MAX_PRIVATEBIN_RESPONSE_BYTES - state.byteLength) {
    await state.reader.cancel()
    throw new Error("PrivateBin response exceeded the maximum size.")
  }

  state.chunks.push(value)
  state.byteLength += value.byteLength

  return readNextPrivateBinResponseChunk(state)
}

const readPrivateBinResponseBody = async (
  response: Response,
  signal: AbortSignal
) => {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("PrivateBin returned an empty response.")
  }

  const state: PrivateBinBodyReadState = {
    reader,
    signal,
    chunks: [],
    byteLength: 0,
  }

  try {
    await readNextPrivateBinResponseChunk(state)
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(state.byteLength)
  let offset = 0

  for (const chunk of state.chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(bytes)
}

// Simple Base58 encoder map
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function toBase58(bytes: Uint8Array): string {
  let z = 0

  while (z < bytes.length && bytes[z] === 0) {
    z++
  }

  const b58bytes: number[] = []

  for (let i = z; i < bytes.length; i++) {
    let carry = bytes[i]

    for (let j = 0; j < b58bytes.length; j++) {
      const x = b58bytes[j] * 256 + carry
      b58bytes[j] = x % 58
      carry = Math.floor(x / 58)
    }

    while (carry > 0) {
      b58bytes.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }

  let str = ""

  for (let i = 0; i < z; i++) {
    str += ALPHABET[0]
  }

  for (let i = b58bytes.length - 1; i >= 0; i--) {
    str += ALPHABET[b58bytes[i]]
  }

  return str
}
