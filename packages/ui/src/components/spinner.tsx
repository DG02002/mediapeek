import { Loading03Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@mediapeek/ui/components/icon"
import { cn } from "@mediapeek/ui/lib/utils"

function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Icon>, "icon">) {
  return (
    <Icon icon={Loading03Icon} strokeWidth={2} role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
