/**
 * JSONL reader for beads issues
 * Reads .beads/issues.jsonl and parses into Issue objects
 */

import { readFile, access } from 'fs/promises'
import { join, dirname } from 'path'
import type { Issue, IssueStatus, IssueType, Priority } from './types'

/**
 * Raw JSONL issue format from beads
 */
export interface JsonlIssue {
  id: string
  title: string
  description?: string
  status: string
  priority: number
  issue_type: string
  created_at: string
  updated_at: string
  closed_at?: string
  close_reason?: string
  assignee?: string
  labels?: string[]
  dependencies?: Array<{
    issue_id: string
    depends_on_id: string
    type: string
  }>
}

/**
 * Parse a single JSONL line into an Issue
 */
export function parseJsonlLine(line: string): Issue | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  try {
    const raw = JSON.parse(trimmed) as JsonlIssue

    // Extract dependsOn from dependencies array
    const dependsOn: string[] = []
    if (raw.dependencies && Array.isArray(raw.dependencies)) {
      for (const dep of raw.dependencies) {
        if (dep.depends_on_id) {
          dependsOn.push(dep.depends_on_id)
        }
      }
    }

    const issue: Issue = {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      status: raw.status as IssueStatus,
      type: raw.issue_type as IssueType,
      priority: raw.priority as Priority,
      assignee: raw.assignee,
      labels: raw.labels,
      created: new Date(raw.created_at),
      updated: new Date(raw.updated_at),
      closed: raw.closed_at ? new Date(raw.closed_at) : undefined,
      dependsOn,
      blocks: [], // Will be computed after all issues are loaded
    }

    return issue
  } catch {
    return null
  }
}

/**
 * Read all issues from a .beads directory
 */
export async function readIssuesFromJsonl(beadsDir: string): Promise<Issue[]> {
  const jsonlPath = join(beadsDir, 'issues.jsonl')

  const content = await readFile(jsonlPath, 'utf-8')
  const lines = content.split('\n')

  // First pass: parse all issues
  const issues: Issue[] = []
  for (const line of lines) {
    const issue = parseJsonlLine(line)
    if (issue) {
      issues.push(issue)
    }
  }

  // Second pass: compute blocks array
  // If issue A depends on issue B, then B blocks A
  const blocksMap = new Map<string, string[]>()

  for (const issue of issues) {
    for (const depId of issue.dependsOn) {
      if (!blocksMap.has(depId)) {
        blocksMap.set(depId, [])
      }
      blocksMap.get(depId)!.push(issue.id)
    }
  }

  // Apply blocks to each issue
  for (const issue of issues) {
    issue.blocks = blocksMap.get(issue.id) || []
  }

  return issues
}

/**
 * Find .beads directory starting from given path, walking up
 */
export async function findBeadsDir(startPath: string): Promise<string | null> {
  let current = startPath

  // Walk up directory tree
  for (let i = 0; i < 20; i++) {
    const beadsPath = join(current, '.beads')

    try {
      await access(beadsPath)
      return beadsPath
    } catch {
      // Not found, try parent
      const parent = dirname(current)
      if (parent === current) {
        // Reached root
        return null
      }
      current = parent
    }
  }

  return null
}
