import { readdir, readFile } from "node:fs/promises"

import { load } from "js-yaml"

const yamlFilePaths = [
  ...(await readdir(new URL("../.github/workflows/", import.meta.url)))
    .filter(
      (fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml")
    )
    .map(
      (fileName) => new URL(`../.github/workflows/${fileName}`, import.meta.url)
    ),
  new URL("../.github/actions/sync-issue-labels/action.yml", import.meta.url),
]

const yamlContents = await Promise.all(
  yamlFilePaths.map((filePath) => readFile(filePath, "utf8"))
)

for (const yamlContent of yamlContents) {
  load(yamlContent)
}
