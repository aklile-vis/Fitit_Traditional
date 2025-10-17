import { rm, mkdir, stat } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const directoriesToRecreate = [
  'file_storage/uploads',
  'file_storage/processed',
  'file_storage/models',
  'file_storage/status',
  'file_storage/workspace',
  'backend/file_storage/uploads',
  'backend/file_storage/processed',
  'backend/file_storage/models',
  'backend/file_storage/status',
  'backend/file_storage/workspace'
]

const directoriesToRemoveCompletely = [
  '.next',
  'out',
  '.turbo',
  'backend/__pycache__',
]

const filesToRemove = [
  'file_storage/database/file_storage.db',
  'backend/file_storage/database/file_storage.db'
]

async function safeRm(target, options = { recursive: true, force: true }) {
  const fullPath = path.join(repoRoot, target)
  await rm(fullPath, options).catch(() => undefined)
}

async function safeMkdir(target) {
  const fullPath = path.join(repoRoot, target)
  await mkdir(fullPath, { recursive: true }).catch(() => undefined)
}

async function pathExists(target) {
  try {
    await stat(path.join(repoRoot, target))
    return true
  } catch {
    return false
  }
}

async function main() {
  for (const dir of directoriesToRemoveCompletely) {
    await safeRm(dir)
  }

  for (const file of filesToRemove) {
    await safeRm(file, { force: true })
  }

  for (const dir of directoriesToRecreate) {
    await safeRm(dir)
    await safeMkdir(dir)
  }

  const summary = []
  for (const dir of directoriesToRecreate) {
    summary.push(`${dir}${await pathExists(dir) ? '' : ' (missing)'}`)
  }

  console.log('Cleaned artifacts. Refreshed directories:')
  summary.forEach((line) => console.log(` - ${line}`))
}

main().catch((error) => {
  console.error('Failed to clean artifacts:', error)
  process.exitCode = 1
})
