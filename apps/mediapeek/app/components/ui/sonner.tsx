import { useTheme } from "~/components/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons"
import type { CSSProperties } from "react"

import { Icon } from "~/components/ui/icon"

type SonnerStyle = CSSProperties & {
  "--normal-bg": string
  "--normal-text": string
  "--normal-border": string
  "--border-radius": string
}

const toasterStyle: SonnerStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius)",
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <Icon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
        ),
        info: (
          <Icon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
        ),
        warning: (
          <Icon icon={Alert02Icon} strokeWidth={2} className="size-4" />
        ),
        error: (
          <Icon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <Icon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      style={toasterStyle}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
