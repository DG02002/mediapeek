import { Schema } from "effect"

import { MediaView } from "~/components/media-view"
import { homeDemoFixture } from "~/lib/home-demo-fixture"
import { MediaInfoJSONSchema } from "~/lib/media-info-schema"
import type { MediaInfoJSON, MediaTrackJSON } from "~/types/media"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Preview - MediaPeek" },
  {
    name: "robots",
    content: "noindex, nofollow",
  },
]

const getOrCreateTrack = (tracks: MediaTrackJSON[], type: string) => {
  const existingTrack = tracks.find((track) => track["@type"] === type)

  if (existingTrack) {
    return existingTrack
  }

  const createdTrack: MediaTrackJSON = { "@type": type }
  tracks.push(createdTrack)

  return createdTrack
}

function enhancePreviewBadges(data: MediaInfoJSON): MediaInfoJSON {
  const clone = structuredClone(data)
  const tracks = clone.media?.track ?? []
  const generalTrack = getOrCreateTrack(tracks, "General")
  const completeName = generalTrack.CompleteName ?? "MediaPeek.Demo.mkv"

  if (!completeName.toUpperCase().includes("IMAX")) {
    generalTrack.CompleteName = completeName.replace(/\.mkv$/i, ".IMAX.mkv")
  }

  addVideoPreviewBadges(tracks)
  addAudioPreviewBadges(tracks)
  addTextPreviewBadges(tracks)

  clone.media = { ...clone.media, track: tracks }

  return clone
}

const addVideoPreviewBadges = (tracks: MediaTrackJSON[]) => {
  const videoTrack = getOrCreateTrack(tracks, "Video")
  videoTrack.HDR_Format = "Dolby Vision"
  videoTrack.HDR_Format_Compatibility = ""
  videoTrack.DisplayAspectRatio = 1.9
}

const addAudioPreviewBadges = (tracks: MediaTrackJSON[]) => {
  const audioTrack = getOrCreateTrack(tracks, "Audio")
  audioTrack.Format = "FLAC"
  audioTrack.Title = "Hi-Res Lossless"
  audioTrack.BitDepth = 24
  audioTrack.SamplingRate = 96000
  audioTrack.Compression_Mode = "Lossless"
}

const addTextPreviewBadges = (tracks: MediaTrackJSON[]) => {
  const textTrack = getOrCreateTrack(tracks, "Text")
  textTrack.Title = "CC"
  textTrack.Format = "UTF-8"
}

export async function loader({ request }: Route.LoaderArgs) {
  const demoUrl = new URL("/demo.json", request.url)

  try {
    const response = await fetch(demoUrl)

    if (!response.ok) {
      throw new Error(`Failed to load demo.json (${String(response.status)})`)
    }

    const data = Schema.decodeUnknownSync(MediaInfoJSONSchema)(
      await response.json()
    )

    const enhancedData = enhancePreviewBadges(data)

    const generalTrack = enhancedData.media?.track.find(
      (track) => track["@type"] === "General"
    )

    return {
      sourceUrl: generalTrack?.CompleteName ?? homeDemoFixture.sourceUrl,
      object: enhancedData,
      json: JSON.stringify(enhancedData, null, 2),
      text: homeDemoFixture.results.text,
    }
  } catch {
    return {
      sourceUrl: homeDemoFixture.sourceUrl,
      object: homeDemoFixture.results.object,
      json: homeDemoFixture.results.json,
      text: homeDemoFixture.results.text,
    }
  }
}

export default function PreviewRoute({ loaderData }: Route.ComponentProps) {
  const previewResults = {
    object: JSON.stringify(loaderData.object, null, 2),
    json: loaderData.json,
    text: loaderData.text,
  } satisfies Record<"object" | "json" | "text", string>

  return (
    <main className="bg-background min-h-screen px-4 py-4 sm:px-8">
      <MediaView data={previewResults} url={loaderData.sourceUrl} />
    </main>
  )
}
