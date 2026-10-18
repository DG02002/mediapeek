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
import { parseMediaReport } from "~/features/reports/media-report"
import { fetchAnalyzeFormat } from "~/lib/analyze-client"
import { SmoothTransition } from "~/lib/animation"
import { clientLog } from "~/lib/client-logger"
import { cn } from "~/lib/utils"
import { startNativeViewTransition } from "~/lib/view-transition"

import { AccessibilitySection } from "./media-view/accessibility-section"
import { AudioSection } from "./media-view/audio-section"
import { ChapterSection } from "./media-view/chapter-section"
import { GeneralSection } from "./media-view/general-section"
import { LibrarySection } from "./media-view/library-section"
import { MediaHeader } from "./media-view/media-header"
import { MediaReportExport } from "./media-view/media-report-export"
import { SubtitleSection } from "./media-view/subtitle-section"
import { useMediaPngExport } from "./media-view/use-media-png-export"
import { VideoSection } from "./media-view/video-section"

export type MediaViewData = Record<string, string>

interface MediaViewProps {
  data: MediaViewData
  url: string
  requestTurnstileToken?: () => Promise<string | null>
  fetchFormat?: typeof fetchAnalyzeFormat
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

export const MediaView = memo(function MediaView({
  data,
  url,
  requestTurnstileToken,
  fetchFormat = fetchAnalyzeFormat,
}: MediaViewProps) {
  const [isTextView, setIsTextView] = useState(false)
  const [showOriginalTitles, setShowOriginalTitles] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [fetchedText, setFetchedText] = useState<string | null>(null)
  const [isTextLoading, setIsTextLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [_isPending, startTransition] = useTransition()

  // Stable handlers for View Switching to ensure responsiveness
  const handleSetIsTextView = useCallback(
    (val: boolean) => {
      startNativeViewTransition(
        () => {
          setIsTextView(val)
        },
        () => {
          startTransition(() => {
            setIsTextView(val)
          })
        }
      )
    },
    [startTransition]
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

  // Lazy-load text output on demand using POST to avoid exposing URLs in query strings.
  useEffect(() => {
    if (isTextView && !data.text && !fetchedText) {
      let cancelled = false

      const loadText = async () => {
        setIsTextLoading(true)

        try {
          const result = await fetchFormat({
            url,
            format: "text",
            requestTurnstileToken,
          })

          if (!result.ok) {
            throw new Error(result.message)
          }

          if (!cancelled) {
            setFetchedText(result.content)
          }
        } catch (error) {
          console.error("Failed to lazy-load text output", error)
        } finally {
          if (!cancelled) {
            setIsTextLoading(false)
          }
        }
      }

      void loadText()

      return () => {
        cancelled = true
      }
    }

    return undefined
  }, [
    data.text,
    fetchFormat,
    fetchedText,
    isTextView,
    requestTurnstileToken,
    url,
  ])

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

    if (containerRef.current.dataset.viewMode !== activeViewMode) {
      return
    }

    const { top } = containerRef.current.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const absoluteTop = top + scrollTop

    if (scrollTop > absoluteTop) {
      window.scrollTo({ top: absoluteTop, behavior: "instant" })
    }
  }, [isTextView])

  const parsedReport = useParsedMediaReport(data, url)

  // Merge lazy-loaded text into data
  const fullData = useMemo(() => {
    return {
      ...data,
      text:
        (data.text !== "" ? data.text : undefined) ??
        fetchedText ??
        (isTextLoading ? "" : ""),
    }
  }, [data, fetchedText, isTextLoading])

  const exportFilename = parsedReport.ok
    ? parsedReport.report.file.displayName
    : "Unknown"

  const { handleExportPng, isExportingPng, mediaReportExportRef } =
    useMediaPngExport(exportFilename)

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
          {(data["@ref"] ?? "").endsWith(".json") && "No JSON data"}
        </pre>
      </div>
    )
  }

  const { report } = parsedReport

  return (
    <div
      ref={containerRef}
      data-view-mode={isTextView ? "text" : "structured"}
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
                {isTextLoading ? (
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
                ) : (
                  <motion.pre
                    key={`text-content-${isFullScreen ? "full" : "normal"}`}
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
                      isFullScreen
                        ? "h-[calc(100vh-42px)] max-w-none"
                        : "max-w-[calc(100vw-3rem)] sm:max-w-none"
                    )}
                  >
                    {fullData.text || "No text data available."}
                  </motion.pre>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-6 duration-300">
          <GeneralSection report={report} />
          <VideoSection
            videoTracks={report.videos}
            archiveSizingWarning={report.file.archive?.sizing.warning}
          />
          <AudioSection
            audioTracks={report.audios}
            showOriginalTitles={showOriginalTitles}
          />
          <SubtitleSection
            textTracks={report.subtitles}
            showOriginalTitles={showOriginalTitles}
          />
          <ChapterSection chapters={report.chapters} />
          <AccessibilitySection accessibility={report.accessibility} />
          <LibrarySection library={report.engine} badges={report.badges} />
        </div>
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
