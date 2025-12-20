/**
 * Issues API for beads-workflows
 * Provides issues.ready(), issues.get(), issues.list(), etc.
 */

import type { Issue, IssueStatus, IssueType, Priority } from './types'
import { readIssuesFromJsonl } from './reader'
import { createIssue as bdCreate, updateIssue as bdUpdate, closeIssue as bdClose, type CreateOptions, type UpdateOptions } from './writer'

/**
 * Filter options for listing issues
 */
export interface ListFilter {
  status?: IssueStatus
  type?: IssueType
  priority?: Priority
  assignee?: string
}

/**
 * Issues API interface
 */
export interface IssuesApi {
  get(id: string): Promise<Issue | null>
  list(filter?: ListFilter): Promise<Issue[]>
  ready(): Promise<Issue[]>
  blocked(): Promise<Issue[]>
  count(filter?: ListFilter): Promise<number>
  reload(): Promise<void>
  create(options: CreateOptions): Promise<Issue | null>
  update(id: string, options: UpdateOptions): Promise<Issue | null>
  close(id: string, reason?: string): Promise<boolean>
}

/**
 * Create an issues API instance for a beads directory
 */
export function createIssuesApi(beadsDir: string): IssuesApi {
  let cachedIssues: Issue[] | null = null
  let issuesById: Map<string, Issue> | null = null

  async function loadIssues(): Promise<Issue[]> {
    if (cachedIssues === null) {
      cachedIssues = await readIssuesFromJsonl(beadsDir)
      issuesById = new Map(cachedIssues.map(i => [i.id, i]))
    }
    return cachedIssues
  }

  function applyFilter(issues: Issue[], filter?: ListFilter): Issue[] {
    if (!filter) return issues

    return issues.filter(issue => {
      if (filter.status && issue.status !== filter.status) return false
      if (filter.type && issue.type !== filter.type) return false
      if (filter.priority !== undefined && issue.priority !== filter.priority) return false
      if (filter.assignee && issue.assignee !== filter.assignee) return false
      return true
    })
  }

  function isBlocked(issue: Issue, allIssues: Map<string, Issue>): boolean {
    if (issue.dependsOn.length === 0) return false

    for (const depId of issue.dependsOn) {
      const dep = allIssues.get(depId)
      // If dependency exists and is not closed, issue is blocked
      if (dep && dep.status !== 'closed') {
        return true
      }
    }
    return false
  }

  return {
    async get(id: string): Promise<Issue | null> {
      await loadIssues()
      return issuesById?.get(id) ?? null
    },

    async list(filter?: ListFilter): Promise<Issue[]> {
      const issues = await loadIssues()
      return applyFilter(issues, filter)
    },

    async ready(): Promise<Issue[]> {
      const issues = await loadIssues()
      const byId = issuesById!

      return issues.filter(issue => {
        // Must be open (not closed, not in_progress for some definitions)
        if (issue.status === 'closed') return false

        // Must not be blocked
        if (isBlocked(issue, byId)) return false

        return true
      })
    },

    async blocked(): Promise<Issue[]> {
      const issues = await loadIssues()
      const byId = issuesById!

      return issues.filter(issue => {
        if (issue.status === 'closed') return false
        return isBlocked(issue, byId)
      })
    },

    async count(filter?: ListFilter): Promise<number> {
      const issues = await this.list(filter)
      return issues.length
    },

    async reload(): Promise<void> {
      cachedIssues = null
      issuesById = null
      await loadIssues()
    },

    async create(options: CreateOptions): Promise<Issue | null> {
      const result = await bdCreate(options, { cwd: beadsDir.replace('/.beads', '') })
      if (result.success && result.data) {
        await this.reload()
        return this.get(result.data.id as string)
      }
      return null
    },

    async update(id: string, options: UpdateOptions): Promise<Issue | null> {
      const result = await bdUpdate(id, options, { cwd: beadsDir.replace('/.beads', '') })
      if (result.success) {
        await this.reload()
        return this.get(id)
      }
      return null
    },

    async close(id: string, reason?: string): Promise<boolean> {
      const result = await bdClose(id, reason, { cwd: beadsDir.replace('/.beads', '') })
      if (result.success) {
        await this.reload()
        return true
      }
      return false
    },
  }
}
