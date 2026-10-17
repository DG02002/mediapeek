import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"

type IconProps = ComponentProps<typeof HugeiconsIcon>

function Icon({
  color = "currentColor",
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  role,
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      color={color}
      aria-hidden={
        ariaHidden ?? (ariaLabel === undefined && role === undefined)
      }
      aria-label={ariaLabel}
      role={role}
      {...props}
    />
  )
}

export { Icon }
