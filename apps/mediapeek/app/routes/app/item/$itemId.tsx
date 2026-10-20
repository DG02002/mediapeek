import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

import { MediaSkeleton } from "~/components/media-skeleton"
import { MediaView } from "~/components/media-view"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import { Icon } from "~/components/ui/icon"
import {
  createBrowserAnalysisSession,
  type AnalysisResult,
  type AnalysisSession,
} from "~/features/analyze/analysis-session"
import type { AnalysisQueueItem } from "~/features/analyze/queue/analysis-queue"
import { useAnalysisQueue } from "~/features/analyze/queue/use-analysis-queue"
import { TurnstileTokenDialog } from "~/features/analyze/turnstile-token-dialog"
import { useTurnstileVerification } from "~/features/analyze/use-turnstile-verification"
import type { StoredReport } from "~/features/reports/report-storage"
import { SaveReportButton } from "~/features/reports/save-report-button"
import { StoredReportView } from "~/features/reports/stored-report-view"
import { useStoredReports } from "~/features/reports/use-stored-reports"
import { useHydrated } from "~/hooks/use-hydrated"

const RecentReportsLink = () => (
  <Link to="/app" className={buttonVariants({ variant: "ghost" })}>
    <Icon icon={ArrowLeft01Icon} size={16} />
    Recent reports
  </Link>
)

const useAnalysisSessionSnapshot = (session: AnalysisSession) => {
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session]
  )

  const getSnapshot = useCallback(() => session.getSnapshot(), [session])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

const AnalysisResultPage = ({
  analysis,
}: {
  readonly analysis: AnalysisResult
}) => {
  const navigate = useNavigate()
  const [turnstileError, setTurnstileError] = useState<string | null>(null)

  const session = useMemo(
    () => createBrowserAnalysisSession({ initialAnalysis: analysis }),
    [analysis]
  )

  useEffect(() => () => session.dispose(), [session])

  const sessionSnapshot = useAnalysisSessionSnapshot(session)
  const turnstile = useTurnstileVerification()

  const currentAnalysis =
    sessionSnapshot.phase === "ready" ? sessionSnapshot.analysis : analysis

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RecentReportsLink />
        <SaveReportButton
          analysis={currentAnalysis}
          session={session}
          requestTurnstileToken={turnstile.requestToken}
          onSaved={(report) => {
            void navigate({
              to: "/app/item/$itemId",
              params: { itemId: report.id },
              replace: true,
            })
          }}
        />
      </div>
      {turnstileError && (
        <Alert variant="destructive">
          <Icon icon={AlertCircleIcon} size={16} />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{turnstileError}</AlertDescription>
        </Alert>
      )}
      <MediaView
        data={currentAnalysis.outputs}
        url={currentAnalysis.url}
        session={session}
        requestTurnstileToken={turnstile.requestToken}
      />
      <TurnstileTokenDialog
        verification={turnstile}
        onError={() =>
          setTurnstileError(
            "Security check failed. Refresh the page and try again."
          )
        }
      />
    </section>
  )
}

const AnalysisProgressPage = ({
  item,
  isActive,
  onCancel,
}: {
  readonly item: AnalysisQueueItem
  readonly isActive: boolean
  readonly onCancel: () => void
}) => {
  const title = isActive
    ? (item.progress?.title ?? "Analyzing media")
    : "Waiting for the current analysis to finish"

  const message = isActive
    ? (item.progress?.message ?? "Connecting to the analyzer.")
    : "Your analysis will start shortly."

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <RecentReportsLink />
      <Alert>
        <Icon icon={Loading03Icon} size={16} className="animate-spin" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <span className="block break-all">{item.url}</span>
          <span className="mt-1 block">{message}</span>
        </AlertDescription>
      </Alert>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel analysis
      </Button>
    </section>
  )
}

const AnalysisFailurePage = ({
  item,
}: {
  readonly item: AnalysisQueueItem
}) => {
  const { queue, requestTurnstileToken: requestQueueTurnstileToken } =
    useAnalysisQueue()

  const navigate = useNavigate()
  const [retryError, setRetryError] = useState<string | null>(null)
  const turnstile = useTurnstileVerification()

  const retry = async () => {
    const token = turnstile.enabled ? await turnstile.requestToken() : null

    if (turnstile.enabled && !token) {
      return
    }

    const result = queue.retry(
      item.id,
      token ?? undefined,
      turnstile.enabled ? requestQueueTurnstileToken : undefined
    )

    if (result.kind === "error") {
      setRetryError(result.message)
    } else {
      setRetryError(null)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <RecentReportsLink />
      <Alert variant="destructive">
        <Icon icon={AlertCircleIcon} size={16} />
        <AlertTitle>Analysis failed</AlertTitle>
        <AlertDescription>
          <span className="block break-all">{item.url}</span>
          <span className="mt-1 block">{retryError ?? item.message}</span>
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void retry()}>
          Retry analysis
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            queue.remove(item.id)
            void navigate({ to: "/app" })
          }}
        >
          Remove
        </Button>
      </div>
      <TurnstileTokenDialog
        verification={turnstile}
        onError={() =>
          setRetryError(
            "Security check failed. Refresh the page and try again."
          )
        }
      />
    </section>
  )
}

const StoredReportPage = ({ report }: { readonly report: StoredReport }) => (
  <section className="flex w-full flex-col gap-4">
    <RecentReportsLink />
    <StoredReportView report={report} />
  </section>
)

const UnavailableReportPage = () => (
  <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <h1 className="font-heading text-2xl font-semibold">Report unavailable</h1>
    <p className="text-muted-foreground text-sm">
      This analysis is no longer active and no saved report matches this URL.
    </p>
    <Link
      to="/app"
      className={buttonVariants({
        variant: "outline",
        className: "self-start",
      })}
    >
      <Icon icon={ArrowLeft01Icon} size={16} />
      Back to MediaPeek
    </Link>
  </section>
)

const AppItemRouteContent = ({
  itemId,
  isHydrated,
  storedReports,
}: {
  readonly itemId: string | undefined
  readonly isHydrated: boolean
  readonly storedReports: ReturnType<typeof useStoredReports>
}) => {
  const navigate = useNavigate()
  const { queue, snapshot } = useAnalysisQueue()

  const queueItem = snapshot.items.find((item) => item.id === itemId)

  const storedReport = storedReports.reports.find(
    (report) => report.id === itemId
  )

  const activeItem = snapshot.items.find(
    (item) => item.id === snapshot.activeItemId
  )

  if (!isHydrated) {
    return <MediaSkeleton />
  }

  if (queueItem?.status === "done" && queueItem.analysis) {
    return <AnalysisResultPage analysis={queueItem.analysis} />
  }

  if (storedReport) {
    return <StoredReportPage report={storedReport} />
  }

  if (queueItem?.status === "queued" || queueItem?.status === "analyzing") {
    return (
      <AnalysisProgressPage
        item={queueItem}
        isActive={activeItem?.id === queueItem.id}
        onCancel={() => {
          queue.remove(queueItem.id)
          void navigate({ to: "/app" })
        }}
      />
    )
  }

  if (queueItem?.status === "error") {
    return <AnalysisFailurePage item={queueItem} />
  }

  if (storedReports.isLoading) {
    return <MediaSkeleton />
  }

  return <UnavailableReportPage />
}

function AppItemPage() {
  const { itemId } = Route.useParams()
  const isHydrated = useHydrated()
  const storedReports = useStoredReports(isHydrated)

  return (
    <AppItemRouteContent
      itemId={itemId}
      isHydrated={isHydrated}
      storedReports={storedReports}
    />
  )
}

export const Route = createFileRoute("/app/item/$itemId")({
  head: () => ({ meta: [{ title: "Media Report - MediaPeek" }] }),
  component: AppItemPage,
})
