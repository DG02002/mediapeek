import { memo } from "react"

import type { MediaReport } from "~/features/reports/media-report"

import { MediaDetailItem } from "./media-detail-item"

interface GeneralSectionProps {
  report: MediaReport
}

export const GeneralSection = memo(function GeneralSection({
  report,
}: GeneralSectionProps) {
  const { container } = report

  if (!container) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Container</h2>
      </div>
      <div className="border-border grid gap-x-8 gap-y-6 rounded-lg border p-6 text-sm sm:grid-cols-2 md:grid-cols-4">
        {(container.format.name ?? container.format.profile) && (
          <MediaDetailItem label="Format">
            <div className="flex flex-col">
              {(container.format.info ?? container.format.name) && (
                <span className="text-foreground/85 font-semibold break-all">
                  {container.format.info ?? container.format.name}
                </span>
              )}
              {container.format.profile && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  {container.format.profile}
                </span>
              )}
              {container.format.version && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  Version {container.format.version}
                </span>
              )}
            </div>
          </MediaDetailItem>
        )}

        {(container.codecId ?? container.compatibleCodecIds) && (
          <MediaDetailItem label="Codec ID">
            <div className="flex flex-col">
              {container.codecId && (
                <span className="text-foreground/85 font-semibold break-all">
                  {container.codecId}
                </span>
              )}
              {container.compatibleCodecIds && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  {container.compatibleCodecIds}
                </span>
              )}
            </div>
          </MediaDetailItem>
        )}

        {container.encodedDate && (
          <MediaDetailItem label="Encoded Date" value={container.encodedDate} />
        )}

        {container.encodedApplication && (
          <MediaDetailItem
            label="Encoded Application"
            value={container.encodedApplication}
          />
        )}

        {container.uniqueId && (
          <MediaDetailItem label="Unique ID" className="col-span-full">
            <span className="text-foreground/85 font-mono font-semibold break-all">
              {container.uniqueId}
            </span>
          </MediaDetailItem>
        )}
      </div>
    </section>
  )
})
