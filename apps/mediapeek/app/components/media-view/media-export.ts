import {
  MEDIA_EXPORT_DARK_BACKGROUND_COLOR,
  MEDIA_EXPORT_LIGHT_BACKGROUND_COLOR,
  MEDIA_EXPORT_SCALE,
} from "~/constants"

export type MediaPngExportTheme = "light" | "dark"

interface MediaPngExportRequest {
  element: HTMLElement
  filename: string
  theme: MediaPngExportTheme
}

export interface MediaPngCaptureOptions {
  backgroundColor: string
  scale: number
}

export interface MediaPngExportDependencies {
  capturePng: (
    element: HTMLElement,
    options: MediaPngCaptureOptions
  ) => Promise<string>
}

const getDownloadFilename = (
  filename: string,
  theme: MediaPngExportRequest["theme"]
) => {
  const safeFilename = filename
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")

  return `${safeFilename || "media-report"}-${theme}.png`
}

const capturePngWithModernScreenshot = async (
  element: HTMLElement,
  options: MediaPngCaptureOptions
): Promise<string> => {
  const { domToPng } = await import("modern-screenshot")

  return domToPng(element, options)
}

const defaultMediaPngExportDependencies: MediaPngExportDependencies = {
  capturePng: capturePngWithModernScreenshot,
}

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const exportMediaReportAsPng = async (
  { element, filename, theme }: MediaPngExportRequest,
  dependencies: MediaPngExportDependencies = defaultMediaPngExportDependencies
): Promise<void> => {
  const rootElement = document.documentElement
  const bodyElement = document.body
  const originalRootClassName = rootElement.className
  const originalBodyTransition = bodyElement.style.transition

  rootElement.classList.toggle("dark", theme === "dark")
  bodyElement.style.transition = "none"

  try {
    if (document.fonts) {
      await document.fonts.ready
    }

    const dataUrl = await dependencies.capturePng(element, {
      backgroundColor:
        theme === "dark"
          ? MEDIA_EXPORT_DARK_BACKGROUND_COLOR
          : MEDIA_EXPORT_LIGHT_BACKGROUND_COLOR,
      scale: MEDIA_EXPORT_SCALE,
    })

    downloadDataUrl(dataUrl, getDownloadFilename(filename, theme))
  } finally {
    rootElement.className = originalRootClassName
    bodyElement.style.transition = originalBodyTransition
  }
}
