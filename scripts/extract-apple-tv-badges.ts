import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const PAGE_URL =
  "https://tv.apple.com/in/show/pluribus/umc.cmc.37axgovs2yozlyh3c2cmwzlza"

const OUTPUT_DIR = join(process.cwd(), "experiment", "extracted-badges")

interface BadgeImage {
  name: string
  dataUrl: string
}

const fetchText = async (url: string, label: string): Promise<string> => {
  console.log(`Fetching ${label}: ${url}`)
  const response = await fetch(url)

  return response.text()
}

const getStylesheetUrl = (html: string): string | null => {
  const match =
    /href="(?<stylesheet>[^"]*\/assets\/main[^"]*\.css)"/.exec(html) ??
    /href="(?<stylesheet>\/assets\/[^"]+\.css)"/.exec(html)

  const stylesheetPath = match?.groups?.stylesheet

  return stylesheetPath === undefined
    ? null
    : new URL(stylesheetPath, "https://tv.apple.com").toString()
}

const getBadgeImages = (css: string): BadgeImage[] => {
  const badgePattern =
    /\.badge--(?<name>[a-zA-Z0-9-]+)[^{]*{content:url\("(?<dataUrl>[^"]+)"\)/g

  const badges: BadgeImage[] = []

  for (const match of css.matchAll(badgePattern)) {
    const name = match.groups?.name
    const dataUrl = match.groups?.dataUrl

    if (name !== undefined && dataUrl?.includes("image/svg+xml")) {
      badges.push({ name, dataUrl })
    }
  }

  return badges
}

const getSvgContent = (dataUrl: string): string => {
  const encodedContent = dataUrl.replace(
    /^data:image\/svg\+xml;charset=utf-8,/,
    ""
  )

  const svgContent = decodeURIComponent(encodedContent)

  return svgContent
    .replaceAll(/stroke=['"]#ebebf5['"]/gi, 'stroke="currentColor"')
    .replaceAll(/fill=['"]#ebebf5['"]/gi, 'fill="currentColor"')
    .replaceAll(/stroke=['"]#3C3C43['"]/gi, 'stroke="currentColor"')
    .replaceAll(/fill=['"]#3C3C43['"]/gi, 'fill="currentColor"')
}

const saveBadges = async (badges: BadgeImage[]): Promise<number> => {
  const contentByName = new Map<string, string>()

  for (const badge of badges) {
    contentByName.set(badge.name, getSvgContent(badge.dataUrl))
  }

  await Promise.all(
    [...contentByName].map(async ([name, svgContent]) => {
      await writeFile(join(OUTPUT_DIR, `${name}.svg`), svgContent)
      console.log(`Saved ${name}.svg`)
    })
  )

  return contentByName.size
}

const main = async (): Promise<void> => {
  const pageHtml = await fetchText(PAGE_URL, "page")
  const stylesheetUrl = getStylesheetUrl(pageHtml)

  if (stylesheetUrl === null) {
    console.error("Could not find a stylesheet in the page HTML")

    return
  }

  const cssContent = await fetchText(stylesheetUrl, "CSS")
  await mkdir(OUTPUT_DIR, { recursive: true })
  const count = await saveBadges(getBadgeImages(cssContent))

  console.log(`\nSaved ${count} unique badges to ${OUTPUT_DIR}`)
}

main().catch(console.error)
