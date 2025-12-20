/**
 * Core types for beads-workflows
 */

// Status types
export type IssueStatus = 'open' | 'in_progress' | 'closed'

// Issue types
export type IssueType = 'task' | 'bug' | 'feature' | 'epic'

// Priority levels (P0-P4)
export type Priority = 0 | 1 | 2 | 3 | 4

/**
 * Core Issue interface
 */
export interface Issue {
  id: string
  title: string
  description?: string
  status: IssueStatus
  type: IssueType
  priority: Priority
  assignee?: string
  labels?: string[]
  created: Date
  updated: Date
  closed?: Date
  dependsOn: string[]
  blocks: string[]
  parent?: string
  children?: string[]
}

/**
 * Epic - an Issue with type 'epic' and required children
 */
export interface Epic extends Issue {
  type: 'epic'
  children: string[]
}

/**
 * Tracks changes to issue fields
 */
export interface Changes {
  [field: string]: { from: unknown; to: unknown } | undefined
}

/**
 * Event from issues.jsonl
 */
export interface IssueEvent {
  type: 'created' | 'updated' | 'closed' | 'reopened' | 'deleted'
  issueId: string
  timestamp: Date
  actor?: string
  data?: Partial<Issue>
  changes?: Changes
}

/**
 * Beads configuration
 */
export interface BeadsConfig {
  prefix: string
  syncBranch?: string
  path: string
}

// Valid statuses
const VALID_STATUSES: IssueStatus[] = ['open', 'in_progress', 'closed']

// Valid types
const VALID_TYPES: IssueType[] = ['task', 'bug', 'feature', 'epic']

/**
 * Type guard: check if value is valid IssueStatus
 */
export function isValidStatus(value: unknown): value is IssueStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as IssueStatus)
}

/**
 * Type guard: check if value is valid IssueType
 */
export function isValidType(value: unknown): value is IssueType {
  return typeof value === 'string' && VALID_TYPES.includes(value as IssueType)
}

/**
 * Type guard: check if value is valid Priority (0-4)
 */
export function isValidPriority(value: unknown): value is Priority {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4
  )
}

/**
 * Type guard: check if value is a valid Issue
 */
export function isIssue(value: unknown): value is Issue {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check required string fields
  if (typeof obj.id !== 'string') return false
  if (typeof obj.title !== 'string') return false

  // Check status
  if (!isValidStatus(obj.status)) return false

  // Check type
  if (!isValidType(obj.type)) return false

  // Check priority
  if (!isValidPriority(obj.priority)) return false

  // Check dates
  if (!(obj.created instanceof Date)) return false
  if (!(obj.updated instanceof Date)) return false

  // Check arrays
  if (!Array.isArray(obj.dependsOn)) return false
  if (!Array.isArray(obj.blocks)) return false

  return true
}

/**
 * Type guard: check if value is a valid Epic
 */
export function isEpic(value: unknown): value is Epic {
  if (!isIssue(value)) return false

  const obj = value as Issue

  // Must have type 'epic'
  if (obj.type !== 'epic') return false

  // Must have children array
  if (!Array.isArray(obj.children)) return false

  return true
}
