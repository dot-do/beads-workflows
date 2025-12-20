/**
 * Epics API for beads-workflows
 * Provides epics.get(), epics.children(), epics.progress()
 */

import type { Issue, Epic, IssueStatus } from './types'
import { readIssuesFromJsonl } from './reader'

/**
 * Progress information for an epic
 */
export interface EpicProgress {
  total: number
  closed: number
  percentage: number
}

/**
 * Filter options for listing epics
 */
export interface EpicFilter {
  status?: IssueStatus
}

/**
 * Epics API interface
 */
export interface EpicsApi {
  get(id: string): Promise<Epic | null>
  list(filter?: EpicFilter): Promise<Epic[]>
  children(epicId: string): Promise<Issue[]>
  progress(epicId: string): Promise<EpicProgress>
  reload(): Promise<void>
}

/**
 * Create an epics API instance for a beads directory
 */
export function createEpicsApi(beadsDir: string): EpicsApi {
  let cachedIssues: Issue[] | null = null

  async function loadIssues(): Promise<Issue[]> {
    if (cachedIssues === null) {
      cachedIssues = await readIssuesFromJsonl(beadsDir)
    }
    return cachedIssues
  }

  function getChildren(epicId: string, issues: Issue[]): Issue[] {
    // Children are issues that depend on (are blocked by) the epic
    return issues.filter(issue => {
      if (issue.type === 'epic') return false // Epics can't be children of epics (in this model)
      return issue.dependsOn.includes(epicId)
    })
  }

  return {
    async get(id: string): Promise<Epic | null> {
      const issues = await loadIssues()
      const issue = issues.find(i => i.id === id)

      if (!issue || issue.type !== 'epic') {
        return null
      }

      // Build Epic with children array
      const children = getChildren(id, issues)
      const epic: Epic = {
        ...issue,
        type: 'epic',
        children: children.map(c => c.id),
      }

      return epic
    },

    async list(filter?: EpicFilter): Promise<Epic[]> {
      const issues = await loadIssues()
      const epics = issues.filter(i => i.type === 'epic')

      let filtered = epics
      if (filter?.status) {
        filtered = epics.filter(e => e.status === filter.status)
      }

      // Add children arrays
      return filtered.map(e => ({
        ...e,
        type: 'epic' as const,
        children: getChildren(e.id, issues).map(c => c.id),
      }))
    },

    async children(epicId: string): Promise<Issue[]> {
      const issues = await loadIssues()
      return getChildren(epicId, issues)
    },

    async progress(epicId: string): Promise<EpicProgress> {
      const children = await this.children(epicId)

      if (children.length === 0) {
        return { total: 0, closed: 0, percentage: 0 }
      }

      const total = children.length
      const closed = children.filter(c => c.status === 'closed').length
      const percentage = (closed / total) * 100

      return { total, closed, percentage }
    },

    async reload(): Promise<void> {
      cachedIssues = null
      await loadIssues()
    },
  }
}
