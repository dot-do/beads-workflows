/**
 * Beads factory for creating configured SDK instances
 * Returns { issues, epics, on } bound to a specific .beads path
 */

import { createIssuesApi, type IssuesApi } from './issues'
import { createEpicsApi, type EpicsApi } from './epics'
import { createHooks, type Hooks } from './hooks'
import { findBeadsDir } from './reader'
import type { Issue } from './types'

/**
 * Options for creating a Beads instance
 */
export interface BeadsOptions {
  path?: string
}

/**
 * Beads instance with all APIs
 */
export interface BeadsInstance {
  issues: IssuesApi
  epics: EpicsApi
  on: Hooks['on']
  emit: Hooks['emit']
  emitAsync: Hooks['emitAsync']
  path: string
}

/**
 * Create a Beads instance for a specific path
 */
export function Beads(options: BeadsOptions = {}): BeadsInstance {
  const path = options.path || process.cwd()

  // Normalize path - if it doesn't end with .beads, assume it's the project root
  const beadsDir = path.endsWith('.beads') ? path : `${path}/.beads`

  const issues = createIssuesApi(beadsDir)
  const epics = createEpicsApi(beadsDir)
  const hooks = createHooks()

  return {
    issues,
    epics,
    on: hooks.on,
    emit: hooks.emit,
    emitAsync: hooks.emitAsync,
    path: beadsDir,
  }
}

/**
 * Auto-detect .beads directory and create instance
 */
export async function autoDetectBeads(startPath?: string): Promise<BeadsInstance | null> {
  const path = startPath || process.cwd()
  const beadsDir = await findBeadsDir(path)

  if (!beadsDir) {
    return null
  }

  return Beads({ path: beadsDir })
}
