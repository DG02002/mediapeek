export interface ReadStreamBytesWithinLimitOptions {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  readonly maxBytes: number
  readonly overflow: "truncate" | "reject"
  readonly firstChunk?: Uint8Array | null
  readonly signal?: AbortSignal
}

interface StreamReadState extends ReadStreamBytesWithinLimitOptions {
  readonly chunks: Uint8Array[]
  byteLength: number
}

type ChunkResult = "continue" | "complete" | "overflow"

const joinChunks = (chunks: ReadonlyArray<Uint8Array>, byteLength: number) => {
  const bytes = new Uint8Array(byteLength)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

const appendChunk = async (
  state: StreamReadState,
  chunk: Uint8Array
): Promise<ChunkResult> => {
  const remaining = state.maxBytes - state.byteLength

  if (chunk.byteLength > remaining && state.overflow === "reject") {
    await state.reader.cancel()

    return "overflow"
  }

  const acceptedChunk = chunk.subarray(0, remaining)

  if (acceptedChunk.byteLength > 0) {
    state.chunks.push(acceptedChunk)
    state.byteLength += acceptedChunk.byteLength
  }

  if (
    chunk.byteLength > acceptedChunk.byteLength ||
    (state.byteLength >= state.maxBytes && state.overflow === "truncate")
  ) {
    await state.reader.cancel()

    return "complete"
  }

  return "continue"
}

const readNextChunk = async (
  state: StreamReadState
): Promise<Uint8Array | null> => {
  state.signal?.throwIfAborted()

  const { done, value } = await state.reader.read()

  if (done) {
    return joinChunks(state.chunks, state.byteLength)
  }

  const result = await appendChunk(state, value)

  if (result === "overflow") {
    return null
  }

  if (result === "complete") {
    return joinChunks(state.chunks, state.byteLength)
  }

  return readNextChunk(state)
}

export const readStreamBytesWithinLimit = async (
  options: ReadStreamBytesWithinLimitOptions
): Promise<Uint8Array | null> => {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0) {
    throw new RangeError(
      "The maximum response size must be a non-negative integer."
    )
  }

  const state: StreamReadState = {
    ...options,
    chunks: [],
    byteLength: 0,
  }

  if (options.firstChunk) {
    const result = await appendChunk(state, options.firstChunk)

    if (result === "overflow") {
      return null
    }

    if (result === "complete") {
      return joinChunks(state.chunks, state.byteLength)
    }
  }

  return readNextChunk(state)
}
