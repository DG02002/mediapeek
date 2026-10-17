import { execSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

interface RepositoryConfiguration {
  id: string
  repository: string
  path: string
}

const repositories: RepositoryConfiguration[] = [
  {
    id: "effect",
    repository: "https://github.com/Effect-TS/effect.git",
    path: ".repos/effect",
  },
]

const runCommand = (command: string, workingDirectory?: string): void => {
  try {
    console.log(
      `Running: ${command}${workingDirectory ? ` in ${workingDirectory}` : ""}`
    )
    execSync(command, { stdio: "inherit", cwd: workingDirectory })
  } catch (error) {
    console.error(`Command failed: ${command}`, error)
    process.exit(1)
  }
}

const main = (): void => {
  const rootDirectory = join(import.meta.dirname, "..")
  const repositoriesDirectory = join(rootDirectory, ".repos")

  if (!existsSync(repositoriesDirectory)) {
    console.log(`Creating directory: ${repositoriesDirectory}`)
    mkdirSync(repositoriesDirectory, { recursive: true })
  }

  const argumentsList = process.argv.slice(2)
  const repositoryFlagIndex = argumentsList.indexOf("--repo")

  const targetRepositoryId =
    repositoryFlagIndex === -1
      ? undefined
      : argumentsList[repositoryFlagIndex + 1]

  const repositoriesToSync = targetRepositoryId
    ? repositories.filter((repository) => repository.id === targetRepositoryId)
    : repositories

  if (targetRepositoryId && repositoriesToSync.length === 0) {
    console.error(
      `Error: Repository with ID "${targetRepositoryId}" is not configured.`
    )
    process.exit(1)
  }

  for (const repository of repositoriesToSync) {
    const fullPath = join(rootDirectory, repository.path)
    console.log(`\nSyncing [${repository.id}] into ${repository.path}...`)

    if (!existsSync(fullPath)) {
      runCommand(
        `git clone --depth 1 ${repository.repository} ${repository.path}`,
        rootDirectory
      )
    } else {
      runCommand("git pull", fullPath)
    }
  }

  console.log("\nRepository sync complete!")
}

main()
