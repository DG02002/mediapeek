import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon, Loading03Icon,MultiplicationSignCircleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@mediapeek/ui/components/icon"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
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
          <Icon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
        ),
        loading: (
          <Icon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
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
