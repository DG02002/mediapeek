import type { ReactNode } from "react"

interface MediaDetailItemProps {
  label: string
  value?: ReactNode
  className?: string
  children?: ReactNode
}

export function MediaDetailItem({
  label,
  value,
  className,
  children,
}: MediaDetailItemProps) {
  return (
    <div className={className}>
      <span className="text-muted-foreground/70 mb-1 block text-[10px] tracking-wider uppercase">
        {label}
      </span>
      {children ?? (
        <div className="flex flex-col">
          <span className="text-foreground/85 text-sm font-medium break-all">
            {value ?? "N/A"}
          </span>
        </div>
      )}
    </div>
  )
}
