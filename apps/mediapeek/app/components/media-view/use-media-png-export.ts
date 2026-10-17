import { useRef, useState } from "react"

import {
  exportMediaReportAsPng,
  type MediaPngExportTheme,
} from "./media-export"

export const useMediaPngExport = (filename: string) => {
  const [isExportingPng, setIsExportingPng] = useState(false)
  const mediaReportExportRef = useRef<HTMLDivElement>(null)

  const handleExportPng = async (theme: MediaPngExportTheme) => {
    const element = mediaReportExportRef.current

    if (!element) {
      throw new Error("The report is not ready to export.")
    }

    setIsExportingPng(true)

    try {
      await exportMediaReportAsPng({ element, filename, theme })
    } finally {
      setIsExportingPng(false)
    }
  }

  return { handleExportPng, isExportingPng, mediaReportExportRef }
}
