import { Schema } from "effect"

import type { MediaTrackJSON } from "~/types/media"

export const getString = (
  track: Partial<MediaTrackJSON>,
  key: string
): string | undefined => {
  const value = track[key]

  return Schema.is(Schema.String)(value) ? value : undefined
}
