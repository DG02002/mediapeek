import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptFilePath = fileURLToPath(import.meta.url)
const scriptDirectory = path.dirname(scriptFilePath)

// Adjust paths relative to this script located in /scripts/
const projectRoot = path.resolve(scriptDirectory, "..")
const inputPath = path.join(projectRoot, "public/badges/dolby-vision.svg")
const outputPath = path.join(projectRoot, "public/badges/dolby-audio.svg")

try {
  const svgContent = fs.readFileSync(inputPath, "utf8")

  // Extract the Dolby Symbol and "Dolby" text paths
  // The "VISION" text path is at the beginning. "M46.325" marks the start of the Dolby logo parts.
  const match = svgContent.match(/d=['"](?<pathData>[^'"]+)['"]/)

  const fullD = match?.groups?.pathData

  if (fullD === undefined) {
    throw new Error("Could not find d attribute in source SVG")
  }

  const splitMarker = "M46.325"
  const splitIndex = fullD.indexOf(splitMarker)

  if (splitIndex === -1) {
    throw new Error(`Could not find marker ${splitMarker} in d attribute.`)
  }

  const keptPaths = fullD.substring(splitIndex)

  // Configuration for "AUDIO" text
  const textConfig = {
    x: "9.72", // Left-aligned with original VISION start
    y: "20.48", // Calculated baseline for correct vertical positioning
    fontFamily:
      "'AvenirNext-DemiBold', 'AvenirNextLTPro-Medium', 'Avenir Next', sans-serif",
    fontWeight: "600", // DemiBold
    fontSize: "9.5", // Size matching visual weight
    letterSpacing: "0.7", // Tight spacing
    transform: "scale(1, 1.05)", // 5% vertical stretch
    text: "AUDIO",
  }

  const newSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="22" viewBox="0 0 52 22">
  <path fill="currentColor" d="${keptPaths}" />
  <text x="${textConfig.x}" y="${textConfig.y}" transform="${textConfig.transform}" font-family="${textConfig.fontFamily}" font-weight="${textConfig.fontWeight}" font-size="${textConfig.fontSize}" fill="currentColor" letter-spacing="${textConfig.letterSpacing}">${textConfig.text}</text>
</svg>`

  fs.writeFileSync(outputPath, newSvg)
  console.log(`Successfully generated: ${outputPath}`)
} catch (error) {
  console.error("Error generating SVG:", error)
  process.exit(1)
}
