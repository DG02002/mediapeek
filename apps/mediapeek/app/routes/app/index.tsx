import { createFileRoute, Link } from "@tanstack/react-router"

import { MediaForm } from "~/features/analyze/media-form"
import type { AnalysisQueueItem } from "~/features/analyze/queue/analysis-queue"
import { useAnalysisQueue } from "~/features/analyze/queue/use-analysis-queue"
import { ReportsSection } from "~/features/reports/reports-section"
import { useHydrated } from "~/hooks/use-hydrated"

const queueItemStatus: Record<AnalysisQueueItem["status"], string> = {
  queued: "Queued",
  analyzing: "Analyzing",
  done: "Analysis complete",
  error: "Analysis failed",
}

const AnalysisQueueSection = () => {
  const { snapshot } = useAnalysisQueue()

  if (snapshot.items.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="analysis-queue-title" className="space-y-2">
      <h2 id="analysis-queue-title" className="font-heading text-2xl font-bold">
        Analysis queue
      </h2>
      <ul role="list" className="flex flex-col divide-y divide-border/70">
        {snapshot.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            {item.status === "done" ? (
              <Link
                to="/app/item/$itemId"
                params={{ itemId: item.id }}
                className="min-w-0 break-all text-sm font-medium text-primary underline underline-offset-4"
              >
                {item.url}
              </Link>
            ) : (
              <span className="min-w-0 break-all text-sm font-medium">
                {item.url}
              </span>
            )}
            <div className="flex shrink-0 flex-col text-sm text-muted-foreground sm:items-end">
              <span>{queueItemStatus[item.status]}</span>
              {item.status === "analyzing" && item.progress?.title ? (
                <span>{item.progress.title}</span>
              ) : null}
              {item.status === "error" && item.message ? (
                <span>{item.message}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AppPage() {
  const isHydrated = useHydrated()

  return isHydrated ? (
    <>
      <MediaForm />
      <AnalysisQueueSection />
      <ReportsSection />
    </>
  ) : (
    <div className="flex w-full max-w-3xl animate-pulse flex-col gap-8 py-8">
      <div className="bg-muted/20 h-32 w-full rounded-lg" />
      <div className="bg-muted/20 h-64 w-full rounded-lg" />
    </div>
  )
}

export const Route = createFileRoute("/app/")({
  head: () => ({
    title: "App - MediaPeek",
    meta: [
      {
        name: "description",
        content:
          "Analyze media files directly in your browser using Cloudflare Workers and MediaInfo.js.",
      },
    ],
  }),
  component: AppPage,
})
