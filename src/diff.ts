/**
 * Diff function for detecting changes in issues.jsonl
 * Compares before and after content to find created, updated, and closed issues
 */

import { parseJsonlLine } from './reader'
import type { Issue } from './types'

/**
 * Input for diff function
 */
export interface DiffInput {
  before: string
  after: string
}

/**
 * Updated issue with before and after states
 */
export interface UpdatedIssue {
  id: string
  before: Issue
  after: Issue
}

/**
 * Result of diff operation
 */
export interface DiffResult {
  created: Issue[]
  updated: UpdatedIssue[]
  closed: Issue[]
}

/**
 * Parse JSONL content into a map of issues (last occurrence wins for snapshot format)
 */
function parseToMap(content: string): Map<string, Issue> {
  const map = new Map<string, Issue>()
  const lines = content.split('\n')

  for (const line of lines) {
    const issue = parseJsonlLine(line)
    if (issue) {
      map.set(issue.id, issue)
    }
  }

  return map
}

/**
 * Compare two issues to detect if they changed
 */
function issueChanged(before: Issue, after: Issue): boolean {
  // Compare key fields
  if (before.status !== after.status) return true
  if (before.title !== after.title) return true
  if (before.priority !== after.priority) return true
  if (before.assignee !== after.assignee) return true
  if (before.description !== after.description) return true

  // Compare updated timestamps
  if (before.updated.getTime() !== after.updated.getTime()) return true

  return false
}

/**
 * Diff two versions of issues.jsonl content
 */
export async function diff(input: DiffInput): Promise<DiffResult> {
  const beforeMap = parseToMap(input.before)
  const afterMap = parseToMap(input.after)

  const created: Issue[] = []
  const updated: UpdatedIssue[] = []
  const closed: Issue[] = []

  // Find created and updated issues
  for (const [id, after] of afterMap) {
    const before = beforeMap.get(id)

    if (!before) {
      // New issue
      created.push(after)
    } else if (issueChanged(before, after)) {
      // Check if it was closed
      if (before.status !== 'closed' && after.status === 'closed') {
        closed.push(after)
      } else {
        updated.push({ id, before, after })
      }
    }
  }

  return { created, updated, closed }
}
