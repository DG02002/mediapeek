import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGE_URL =
  'https://tv.apple.com/in/show/pluribus/umc.cmc.37axgovs2yozlyh3c2cmwzlza';
const OUTPUT_DIR = join(process.cwd(), 'experiment', 'extracted-badges');

async function main() {
  console.log(`Fetching page: ${PAGE_URL}`);
  const pageRes = await fetch(PAGE_URL);
  const pageHtml = await pageRes.text();

  // Find the main css file
  // Look for <link rel="stylesheet" ... href="/assets/main~...">
  // Example: <link rel="stylesheet" crossorigin href="/assets/main~C4ibcj_vaK.css">
  const cssMatch = /href="([^"]*\/assets\/main[^"]*\.css)"/.exec(pageHtml);

  if (!cssMatch) {
    console.error('Could not find main CSS file in HTML');
    // Fallback search for any css if specific main pattern fails
    const anyCss = /href="(\/assets\/[^"]+\.css)"/.exec(pageHtml);
    if (!anyCss) {
      console.error('No CSS assets found.');
      return;
    }
  }

  const cssPath = cssMatch ? cssMatch[1] : '';
  const cssUrl = new URL(cssPath, 'https://tv.apple.com').toString();
  console.log(`Fetching CSS: ${cssUrl}`);

  const cssRes = await fetch(cssUrl);
  const cssContent = await cssRes.text();

  // Regex to find badges
  // Looks like: .badge--cc.svelte-nd7koe{content:url("data:image/svg+xml;charset=utf-8,%3Csvg ...")}
  const badgeRegex = /\.badge--([a-zA-Z0-9-]+)[^{]*{content:url\("([^"]+)"\)/g;

  await mkdir(OUTPUT_DIR, { recursive: true });

  let match;
  let count = 0;
  while ((match = badgeRegex.exec(cssContent)) !== null) {
    const badgeName = match[1];
    const dataUrl = match[2];

    if (!dataUrl.includes('image/svg+xml')) {
      continue;
    }

    // Extract the SVG content from data URL. It's URI encoded.
    // Format: data:image/svg+xml;charset=utf-8,%3Csvg...
    const rawContent = dataUrl.replace(
      /^data:image\/svg\+xml;charset=utf-8,/,
      '',
    );
    let svgContent = decodeURIComponent(rawContent);

    // Optional: Beautify/Format?
    // We can do simple cleanup to convert colors to currentColor if requested,
    // but for "raw extraction" requests, it's often better to keep as is.
    // However, the user previously wanted to fix hardcoded colors.
    // I will replace the specific hardcoded light grey #ebebf5 and dark grey #3C3C43 with currentColor
    // to make them theme-adaptable, as that seemed to be the user's intent with the manual fix.

    // Apple TV often has two versions of the badge (light/dark mode) or one that matches specific theme.
    // The CSS might have multiple entries for the same badge with different classes/media queries.
    // Our regex captures based on class name.
    // If there are duplicates (e.g. badge--cc defined twice), we might overwrite.
    // Let's check for duplicates or stick to saving all unique ones found.

    // To handle overwrite, we'll just let it overwrite or check if exists.
    // Given the CSS structure usually cascades or uses scoping, the last one might be the one intended for specific media,
    // or they might be identical.

    // Helper to replace colors
    svgContent = svgContent
      .replace(/stroke=['"]#ebebf5['"]/gi, 'stroke="currentColor"')
      .replace(/fill=['"]#ebebf5['"]/gi, 'fill="currentColor"')
      .replace(/stroke=['"]#3C3C43['"]/gi, 'stroke="currentColor"')
      .replace(/fill=['"]#3C3C43['"]/gi, 'fill="currentColor"');

    const filePath = join(OUTPUT_DIR, `${badgeName}.svg`);
    await writeFile(filePath, svgContent);
    console.log(`Saved ${badgeName}.svg`);
    count++;
  }

  console.log(`\nExtracted ${count} badges to ${OUTPUT_DIR}`);
}

main().catch(console.error);
