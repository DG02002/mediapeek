export type SourceProvider = "direct" | "google-drive" | "onedrive"

export type SourceResolution =
  | {
      status: "resolved"
      provider: SourceProvider
      targetUrl: string
      htmlResponseMessage: string
    }
  | {
      status: "unsupported"
      provider: Exclude<SourceProvider, "direct">
      code: "folder_not_supported" | "provider_page_not_supported"
      message: string
    }

const GOOGLE_DRIVE_HOST = "drive.google.com"
const GOOGLE_DRIVE_DOWNLOAD_HOST = "drive.usercontent.google.com"
const ONEDRIVE_PAGE_HOSTS = new Set(["1drv.ms", "onedrive.live.com"])

const GOOGLE_DRIVE_RATE_LIMIT_MESSAGE =
  "Google Drive file is rate-limited. Try again in 24 hours."

const DIRECT_HTML_MESSAGE =
  "URL links to a webpage, not a media file. Provide a direct link."

const getDriveFileId = (url: URL): string | null => {
  const pathMatch = /^\/file\/d\/([-a-zA-Z0-9_]+)(?:\/|$)/.exec(url.pathname)

  if (pathMatch?.[1]) {
    return pathMatch[1]
  }

  if (url.pathname === "/open" || url.pathname === "/uc") {
    return url.searchParams.get("id")
  }

  return null
}

const resolveGoogleDriveSource = (url: URL): SourceResolution => {
  if (url.pathname.startsWith("/drive/folders/")) {
    return {
      status: "unsupported",
      provider: "google-drive",
      code: "folder_not_supported",
      message:
        "Google Drive folders are not supported. Open the folder and provide a public file link.",
    }
  }

  const fileId = getDriveFileId(url)

  if (!fileId) {
    return {
      status: "unsupported",
      provider: "google-drive",
      code: "provider_page_not_supported",
      message:
        "This Google Drive page is not a supported file link. Provide a public Drive file link.",
    }
  }

  const target = new URL(`https://${GOOGLE_DRIVE_DOWNLOAD_HOST}/download`)
  target.searchParams.set("id", fileId)
  target.searchParams.set("export", "download")
  target.searchParams.set("confirm", "t")
  const resourceKey = url.searchParams.get("resourcekey")

  if (resourceKey) {
    target.searchParams.set("resourcekey", resourceKey)
  }

  return {
    status: "resolved",
    provider: "google-drive",
    targetUrl: target.toString(),
    htmlResponseMessage: GOOGLE_DRIVE_RATE_LIMIT_MESSAGE,
  }
}

export const resolveSource = (sourceUrl: string): SourceResolution => {
  const url = new URL(sourceUrl)
  const hostname = url.hostname.toLowerCase()

  if (hostname === GOOGLE_DRIVE_DOWNLOAD_HOST) {
    return {
      status: "resolved",
      provider: "google-drive",
      targetUrl: url.toString(),
      htmlResponseMessage: GOOGLE_DRIVE_RATE_LIMIT_MESSAGE,
    }
  }

  if (hostname === GOOGLE_DRIVE_HOST) {
    return resolveGoogleDriveSource(url)
  }

  if (ONEDRIVE_PAGE_HOSTS.has(hostname)) {
    return {
      status: "unsupported",
      provider: "onedrive",
      code: "provider_page_not_supported",
      message:
        "OneDrive sharing pages are not supported. Provide a direct media download URL.",
    }
  }

  return {
    status: "resolved",
    provider: "direct",
    targetUrl: url.toString(),
    htmlResponseMessage: DIRECT_HTML_MESSAGE,
  }
}
