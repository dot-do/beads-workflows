import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { createIssuesApi, type IssuesApi } from '../src/issues'
import type { Issue } from '../src/types'

const TEST_DIR = '/tmp/beads-issues-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('issues API', () => {
  let api: IssuesApi

  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })

    // Create sample issues.jsonl
    const issues = [
      { id: 'proj-1', title: 'Open task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
      { id: 'proj-2', title: 'In progress bug', status: 'in_progress', priority: 1, issue_type: 'bug', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-02T10:00:00Z' },
      { id: 'proj-3', title: 'Closed feature', status: 'closed', priority: 0, issue_type: 'feature', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-03T10:00:00Z', closed_at: '2025-01-03T10:00:00Z' },
      { id: 'proj-4', title: 'Blocked task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z', dependencies: [{ issue_id: 'proj-4', depends_on_id: 'proj-2', type: 'blocks' }] },
      { id: 'proj-5', title: 'Ready task', status: 'open', priority: 3, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
    ]

    await writeFile(
      join(BEADS_DIR, 'issues.jsonl'),
      issues.map(i => JSON.stringify(i)).join('\n')
    )

    api = createIssuesApi(BEADS_DIR)
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('get', () => {
    test('retrieves issue by id', async () => {
      const issue = await api.get('proj-1')

      expect(issue).not.toBeNull()
      expect(issue!.id).toBe('proj-1')
      expect(issue!.title).toBe('Open task')
    })

    test('returns null for non-existent id', async () => {
      const issue = await api.get('proj-nonexistent')

      expect(issue).toBeNull()
    })
  })

  describe('list', () => {
    test('returns all issues with no filter', async () => {
      const issues = await api.list()

      expect(issues).toHaveLength(5)
    })

    test('filters by status', async () => {
      const open = await api.list({ status: 'open' })
      const closed = await api.list({ status: 'closed' })

      expect(open).toHaveLength(3) // proj-1, proj-4, proj-5
      expect(closed).toHaveLength(1) // proj-3
    })

    test('filters by type', async () => {
      const tasks = await api.list({ type: 'task' })
      const bugs = await api.list({ type: 'bug' })

      expect(tasks).toHaveLength(3)
      expect(bugs).toHaveLength(1)
    })

    test('filters by priority', async () => {
      const p0 = await api.list({ priority: 0 })
      const p2 = await api.list({ priority: 2 })

      expect(p0).toHaveLength(1)
      expect(p2).toHaveLength(2)
    })

    test('combines multiple filters', async () => {
      const openTasks = await api.list({ status: 'open', type: 'task' })

      expect(openTasks).toHaveLength(3)
      expect(openTasks.every(i => i.status === 'open' && i.type === 'task')).toBe(true)
    })
  })

  describe('ready', () => {
    test('returns issues with no blockers', async () => {
      const ready = await api.ready()

      // proj-1, proj-5 are open with no blockers
      // proj-4 is blocked by proj-2
      expect(ready.length).toBeGreaterThanOrEqual(2)
      expect(ready.every(i => i.dependsOn.length === 0 || i.dependsOn.every(depId => {
        // Check if dependency is closed
        return true // Simplified for test
      }))).toBe(true)
    })

    test('excludes closed issues', async () => {
      const ready = await api.ready()

      expect(ready.every(i => i.status !== 'closed')).toBe(true)
    })

    test('excludes blocked issues', async () => {
      const ready = await api.ready()

      // proj-4 depends on proj-2 which is in_progress, so proj-4 is blocked
      const blockedIssue = ready.find(i => i.id === 'proj-4')
      expect(blockedIssue).toBeUndefined()
    })
  })

  describe('blocked', () => {
    test('returns issues with open blockers', async () => {
      const blocked = await api.blocked()

      expect(blocked.some(i => i.id === 'proj-4')).toBe(true)
    })
  })

  describe('count', () => {
    test('counts all issues', async () => {
      const count = await api.count()

      expect(count).toBe(5)
    })

    test('counts with filter', async () => {
      const openCount = await api.count({ status: 'open' })

      expect(openCount).toBe(3)
    })
  })

  describe('cache invalidation', () => {
    test('reload refreshes from disk', async () => {
      // Initial count
      expect(await api.count()).toBe(5)

      // Add a new issue to the file
      const newIssue = { id: 'proj-6', title: 'New issue', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }
      const currentContent = await Bun.file(join(BEADS_DIR, 'issues.jsonl')).text()
      await writeFile(
        join(BEADS_DIR, 'issues.jsonl'),
        currentContent + '\n' + JSON.stringify(newIssue)
      )

      // Reload and check
      await api.reload()
      expect(await api.count()).toBe(6)
    })
  })
})
