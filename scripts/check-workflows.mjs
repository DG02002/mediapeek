import { access, readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

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

const projectRoot = fileURLToPath(new URL("../", import.meta.url))

const validateLocalActionReferences = async (value, sourcePath) => {
  if (Array.isArray(value)) {
    await Promise.all(
      value.map((item) => validateLocalActionReferences(item, sourcePath))
    )

    return
  }

  if (value === null || value === undefined) {
    return
  }

  const workflowNode = Object(value)

  if (Object.getPrototypeOf(workflowNode) !== Object.prototype) {
    return
  }

  const { uses } = workflowNode

  const localReference =
    uses?.startsWith?.("$/") || uses?.startsWith?.("./")
      ? uses.slice(2)
      : undefined

  if (localReference) {
    try {
      await access(resolve(projectRoot, localReference))
    } catch (cause) {
      throw new Error(
        `${sourcePath} references missing local target ${String(uses)}.`,
        { cause }
      )
    }
  }

  await Promise.all(
    Object.values(workflowNode).map((item) =>
      validateLocalActionReferences(item, sourcePath)
    )
  )
}

await Promise.all(
  yamlContents.map(async (yamlContent, index) => {
    const parsed = load(yamlContent)
    const sourcePath = fileURLToPath(yamlFilePaths[index])
    await validateLocalActionReferences(parsed, sourcePath)
  })
)
