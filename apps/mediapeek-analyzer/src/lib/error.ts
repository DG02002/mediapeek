import { Schema } from "effect"

const isErrorLike = Schema.is(Schema.Struct({ message: Schema.String }))
const isString = Schema.is(Schema.String)

const unknownToError = (cause: unknown): Error => {
  if (cause instanceof Error) {
    return cause
  }

  if (isErrorLike(cause)) {
    return new Error(cause.message)
  }

  return new Error(isString(cause) ? cause : "Unknown error")
}

export { unknownToError }
