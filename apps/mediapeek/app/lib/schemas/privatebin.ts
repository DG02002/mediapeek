import { Schema } from "effect"

export const PrivateBinResponseSchema = Schema.Struct({
  status: Schema.Number,
  id: Schema.String,
  url: Schema.optionalKey(Schema.String),
  deletetoken: Schema.String,
  message: Schema.optionalKey(Schema.String),
})
