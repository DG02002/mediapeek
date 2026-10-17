import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptFilePath = fileURLToPath(import.meta.url)
const scriptDirectory = path.dirname(scriptFilePath)
const projectRoot = path.resolve(scriptDirectory, "..")

const inputPath = path.join(
  projectRoot,
  "public/badges/sources/source_imax_dtsx.svg"
)

const imaxPath = path.join(projectRoot, "public/badges/imax-enhanced.svg")
const dtsPath = path.join(projectRoot, "public/badges/dts-x.svg")

try {
  const content = fs.readFileSync(inputPath, "utf8")
  const lines = content.split(/\r?\n/)

  // Create helper to extract lines (1-indexed input to 0-indexed slice)
  const extractLines = (start: number, end: number) =>
    lines.slice(start - 1, end).join("\n")

  // Extract Paths Only (Avoid unclosed <g> tags)
  // IMAX Enhanced: Lines 13-28
  const groupIMAX_Enhanced = extractLines(13, 28)

  // IMAX Logo: Lines 32-38
  // (Lines 39-40 are the circle/symbol, 41-42 are R, 43 is </g>)
  const groupIMAX_Logo = extractLines(32, 38)

  // DTS: Lines 45-51
  // (Lines 52-53 are symbols, 54 is </g>, 44 was <g>)
  const groupDTS = extractLines(45, 51)

  // Combine IMAX
  // Order: Logo (Top) + Text (Bottom).
  const imaxContent = `${groupIMAX_Logo}\n${groupIMAX_Enhanced}`

  // Define Clean Headers with Cropped ViewBoxes

  // IMAX ViewBox Calculation:
  // Exact BBox from browser analysis: x=40.9, y=111, w=191.2, h=66.7
  const imaxHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40.9 111 191.2 66.7">
<style type="text/css">
	.st0{fill:none;}
	.st1{fill:currentColor;}
</style>`

  // DTS ViewBox Calculation:
  // Exact BBox from browser analysis: x=40.9, y=37, w=139, h=40.8
  const dtsHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40.9 37 139 40.8">
<style type="text/css">
	.st0{fill:none;}
	.st1{fill:currentColor;}
</style>`

  const footer = `</svg>`

  fs.writeFileSync(imaxPath, imaxHeader + imaxContent + footer)
  fs.writeFileSync(dtsPath, dtsHeader + groupDTS + footer)

  console.log(`Created ${imaxPath}`)
  console.log(`Created ${dtsPath}`)
} catch (e) {
  console.error(e)
}
