"use client"

import { ArrowExpandIcon, ArrowShrink02Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import { Button } from "~/components/ui/button"
import { Icon } from "~/components/ui/icon"
import { Skeleton } from "~/components/ui/skeleton"
import {
  createBrowserAnalysisSessionForOutputs,
  type AnalysisSession,
} from "~/features/analyze/analysis-session"
import { parseMediaReport } from "~/features/reports/media-report"
import { SmoothTransition } from "~/lib/animation"
import { clientLog } from "~/lib/client-logger"
import { cn } from "~/lib/utils"
import { startNativeViewTransition } from "~/lib/view-transition"

import { MediaHeader } from "./media-view/media-header"
import { MediaReportExport } from "./media-view/media-report-export"
import { MediaReportSections } from "./media-view/media-report-sections"
import { useMediaPngExport } from "./media-view/use-media-png-export"

export type MediaViewData = Record<string, string>

interface MediaViewProps {
  data: MediaViewData
  url: string
  session?: Pick<AnalysisSession, "output">
  requestTurnstileToken?: () => Promise<string | null>
  allowLazyTextOutput?: boolean
}

const useParsedMediaReport = (data: MediaViewData, url: string) => {
  const parsedReport = useMemo(
    () => parseMediaReport({ json: data.json ?? "", sourceUrl: url }),
    [data.json, url]
  )

  useEffect(() => {
    if (!parsedReport.ok) {
      clientLog.error({
        event: "media_report_json_parse_failed",
        error: parsedReport.error.message,
      })
    }
  }, [parsedReport])

  return parsedReport
}

const useTextViewMode = () => {
  const [isTextView, setIsTextView] = useState(false)
  const viewModeRef = useRef<"text" | "structured">("structured")

  const updateTextView = useCallback((value: boolean) => {
    viewModeRef.current = value ? "text" : "structured"
    setIsTextView(value)
  }, [])

  return { isTextView, updateTextView, viewModeRef }
}

const useLazyTextOutput = (options: {
  enabled: boolean
  hasExistingText: boolean
  data: MediaViewData
  requestTurnstileToken?: () => Promise<string | null>
  session: Pick<AnalysisSession, "output">
}) => {
  const reportIdentity = useMemo(
    () => ({ session: options.session, data: options.data }),
    [options.data, options.session]
  )

  const [textOutputState, setTextOutputState] = useState<{
    reportIdentity: typeof reportIdentity
    fetchedText: string | null
    error: string | null
  }>(() => ({
    reportIdentity,
    fetchedText: null,
    error: null,
  }))

  const currentTextOutputState =
    textOutputState.reportIdentity === reportIdentity ? textOutputState : null

  const fetchedText = currentTextOutputState?.fetchedText ?? null

  const textLoadError =
    options.enabled && !options.hasExistingText && fetchedText === null
      ? (currentTextOutputState?.error ?? null)
      : null

  useEffect(() => {
    if (
      !options.enabled ||
      options.hasExistingText ||
      fetchedText !== null ||
      textLoadError !== null
    ) {
      return undefined
    }

    let isCurrent = true
    void (async () => {
      try {
        const text = await reportIdentity.session.output(
          "text",
          options.requestTurnstileToken
        )

        if (isCurrent) {
          setTextOutputState({
            reportIdentity,
            fetchedText: text,
            error: null,
          })
        }
      } catch (error) {
        if (isCurrent) {
          clientLog.error({
            event: "media_text_output_load_failed",
            error: error instanceof Error ? error.message : String(error),
          })
          setTextOutputState({
            reportIdentity,
            fetchedText: null,
            error: "Unable to load the text output. Try again.",
          })
        }
      }
    })()

    return () => {
      isCurrent = false
    }
  }, [
    fetchedText,
    options.enabled,
    options.hasExistingText,
    options.requestTurnstileToken,
    reportIdentity,
    textLoadError,
  ])

  const retryTextLoad = useCallback(() => {
    setTextOutputState({
      reportIdentity,
      fetchedText: null,
      error: null,
    })
  }, [reportIdentity])

  const isTextLoading =
    options.enabled &&
    !options.hasExistingText &&
    fetchedText === null &&
    textLoadError === null

  return { fetchedText, isTextLoading, retryTextLoad, textLoadError }
}

const renderTextOutput = (options: {
  text: string
  isLoading: boolean
  error: string | null
  isFullScreen: boolean
  onRetry: () => void
}) => {
  if (options.isLoading) {
    return (
      <motion.div
        key="loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SmoothTransition}
        className="absolute inset-0 z-10 p-4"
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="space-y-2 pt-4">
            <Skeleton className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </motion.div>
    )
  }

  if (options.error) {
    return (
      <motion.div
        key="text-error"
        role="alert"
        className="flex min-h-[200px] flex-col items-start justify-center gap-3 p-4"
      >
        <p className="text-destructive text-sm">{options.error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={options.onRetry}
        >
          Retry
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.pre
      key={`text-content-${options.isFullScreen ? "full" : "normal"}`}
      initial={{ opacity: 0, filter: "blur(5px)" }}
      animate={{
        opacity: 1,
        filter: "blur(0px)",
        transition: {
          duration: 0.3,
          ease: "easeOut",
          delay: 0.2,
        },
      }}
      exit={{
        opacity: 0,
        filter: "blur(5px)",
        transition: { duration: 0.15, ease: "easeIn" },
      }}
      className={cn(
        "overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre sm:text-base sm:whitespace-pre-wrap",
        options.isFullScreen
          ? "h-[calc(100vh-42px)] max-w-none"
          : "max-w-[calc(100vw-3rem)] sm:max-w-none"
      )}
    >
      {options.text || "No text data available."}
    </motion.pre>
  )
}

export const MediaView = memo(function MediaView({
  data,
  url,
  session: providedSession,
  requestTurnstileToken,
  allowLazyTextOutput = true,
}: MediaViewProps) {
  const { isTextView, updateTextView, viewModeRef } = useTextViewMode()
  const [showOriginalTitles, setShowOriginalTitles] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [_isPending, startTransition] = useTransition()

  const session = useMemo(
    () =>
      providedSession ??
      createBrowserAnalysisSessionForOutputs({ url, outputs: data }),
    [data, providedSession, url]
  )

  const { fetchedText, isTextLoading, retryTextLoad, textLoadError } =
    useLazyTextOutput({
      enabled: allowLazyTextOutput && isTextView,
      hasExistingText: Boolean(data.text),
      data,
      requestTurnstileToken,
      session,
    })

  // Stable handlers for View Switching to ensure responsiveness
  const handleSetIsTextView = useCallback(
    (val: boolean) => {
      startNativeViewTransition(
        () => updateTextView(val),
        () => startTransition(() => updateTextView(val))
      )
    },
    [startTransition, updateTextView]
  )

  const handleSetShowOriginalTitles = useCallback(
    (val: boolean) => {
      startNativeViewTransition(
        () => {
          setShowOriginalTitles(val)
        },
        () => {
          startTransition(() => {
            setShowOriginalTitles(val)
          })
        }
      )
    },
    [startTransition]
  )

  // Handle Escape key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullScreen])

  // Reset scroll when toggling view mode
  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const activeViewMode = isTextView ? "text" : "structured"

    if (viewModeRef.current !== activeViewMode) {
      return
    }

    const { top } = containerRef.current.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const absoluteTop = top + scrollTop

    if (scrollTop > absoluteTop) {
      window.scrollTo({ top: absoluteTop, behavior: "instant" })
    }
  }, [isTextView, viewModeRef])

  const parsedReport = useParsedMediaReport(data, url)

  // Merge lazy-loaded text into data
  const fullData = useMemo(() => {
    return {
      ...data,
      text: (data.text !== "" ? data.text : undefined) ?? fetchedText ?? "",
    }
  }, [data, fetchedText])

  const { handleExportPng, isExportingPng, mediaReportExportRef } =
    useMediaPngExport(
      parsedReport.ok ? parsedReport.report.file.displayName : "Unknown"
    )

  if (!parsedReport.ok) {
    return (
      <div
        role="alert"
        className="text-destructive rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20"
      >
        <p className="font-medium">Analysis Error</p>
        <p className="text-sm">
          Unable to read this Media Report. Try analyzing the URL again.
        </p>
        <p className="mt-1 text-sm">{parsedReport.error.message}</p>
        <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap opacity-70">
          {!(data["@ref"] ?? "").endsWith(".json") && "No JSON data"}
        </pre>
      </div>
    )
  }

  const { report } = parsedReport

  return (
    <div
      ref={containerRef}
      className="animate-in fade-in mx-auto w-full max-w-5xl space-y-6 pb-20"
    >
      {report.container && (
        <MediaHeader
          url={url}
          report={report}
          isTextView={isTextView}
          setIsTextView={handleSetIsTextView}
          showOriginalTitles={showOriginalTitles}
          setShowOriginalTitles={handleSetShowOriginalTitles}
          rawData={fullData}
          session={session}
          requestTurnstileToken={requestTurnstileToken}
          onExportPng={handleExportPng}
          isExportingPng={isExportingPng}
        />
      )}

      {isTextView ? (
        <div className="animate-in fade-in duration-300">
          <motion.div
            className={cn(
              "bg-muted/30 border-border/50 overflow-hidden border transition-colors",
              isFullScreen
                ? "bg-background fixed inset-0 z-50 h-screen w-screen"
                : "rounded-lg"
            )}
          >
            <motion.div
              layout
              transition={SmoothTransition}
              className="bg-muted/50 border-border/50 flex items-center justify-between border-b px-4 py-2"
            >
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                TEXT Output
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-background/50 h-6 px-2 text-xs"
                onClick={() => {
                  startNativeViewTransition(() => {
                    setIsFullScreen(!isFullScreen)
                  })
                }}
                title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen"}
              >
                <Icon
                  icon={ArrowExpandIcon}
                  altIcon={ArrowShrink02Icon}
                  showAlt={isFullScreen}
                  size={14}
                  className="mr-1.5 opacity-70"
                />
                {isFullScreen ? "Minimize" : "Maximize"}
              </Button>
            </motion.div>
            <div className="relative min-h-[200px]">
              <AnimatePresence mode="wait">
                {renderTextOutput({
                  text: fullData.text,
                  isLoading: isTextLoading,
                  error: textLoadError,
                  isFullScreen,
                  onRetry: retryTextLoad,
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : (
        <MediaReportSections
          report={report}
          showOriginalTitles={showOriginalTitles}
          className="animate-in fade-in space-y-6 duration-300"
        />
      )}

      {report.container && (
        <MediaReportExport
          ref={mediaReportExportRef}
          report={report}
          showOriginalTitles={showOriginalTitles}
        />
      )}
    </div>
  )
})
