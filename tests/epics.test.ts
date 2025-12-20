import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { createEpicsApi, type EpicsApi } from '../src/epics'

const TEST_DIR = '/tmp/beads-epics-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('epics API', () => {
  let api: EpicsApi

  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })

    // Create sample issues.jsonl with epics and children
    const issues = [
      // Epic with 3 children
      { id: 'epic-1', title: 'Main Epic', status: 'open', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
      { id: 'task-1', title: 'Task 1', status: 'closed', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-02T10:00:00Z', closed_at: '2025-01-02T10:00:00Z', dependencies: [{ issue_id: 'task-1', depends_on_id: 'epic-1', type: 'blocks' }] },
      { id: 'task-2', title: 'Task 2', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z', dependencies: [{ issue_id: 'task-2', depends_on_id: 'epic-1', type: 'blocks' }] },
      { id: 'task-3', title: 'Task 3', status: 'in_progress', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z', dependencies: [{ issue_id: 'task-3', depends_on_id: 'epic-1', type: 'blocks' }] },
      // Completed epic with all children closed
      { id: 'epic-2', title: 'Completed Epic', status: 'closed', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-03T10:00:00Z', closed_at: '2025-01-03T10:00:00Z' },
      { id: 'task-4', title: 'Task 4', status: 'closed', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-03T10:00:00Z', closed_at: '2025-01-03T10:00:00Z', dependencies: [{ issue_id: 'task-4', depends_on_id: 'epic-2', type: 'blocks' }] },
      // Standalone task (no parent)
      { id: 'task-5', title: 'Standalone Task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
    ]

    await writeFile(
      join(BEADS_DIR, 'issues.jsonl'),
      issues.map(i => JSON.stringify(i)).join('\n')
    )

    api = createEpicsApi(BEADS_DIR)
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('get', () => {
    test('retrieves epic by id', async () => {
      const epic = await api.get('epic-1')

      expect(epic).not.toBeNull()
      expect(epic!.id).toBe('epic-1')
      expect(epic!.type).toBe('epic')
    })

    test('returns null for non-epic issue', async () => {
      const result = await api.get('task-1')

      expect(result).toBeNull()
    })

    test('returns null for non-existent id', async () => {
      const result = await api.get('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    test('returns all epics', async () => {
      const epics = await api.list()

      expect(epics).toHaveLength(2)
      expect(epics.every(e => e.type === 'epic')).toBe(true)
    })

    test('filters by status', async () => {
      const open = await api.list({ status: 'open' })
      const closed = await api.list({ status: 'closed' })

      expect(open).toHaveLength(1)
      expect(closed).toHaveLength(1)
    })
  })

  describe('children', () => {
    test('returns all children of an epic', async () => {
      const children = await api.children('epic-1')

      expect(children).toHaveLength(3)
      expect(children.map(c => c.id).sort()).toEqual(['task-1', 'task-2', 'task-3'])
    })

    test('returns empty array for epic with no children', async () => {
      // Add an epic with no children
      const newIssue = { id: 'epic-empty', title: 'Empty Epic', status: 'open', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }
      const currentContent = await Bun.file(join(BEADS_DIR, 'issues.jsonl')).text()
      await writeFile(
        join(BEADS_DIR, 'issues.jsonl'),
        currentContent + '\n' + JSON.stringify(newIssue)
      )
      await api.reload()

      const children = await api.children('epic-empty')

      expect(children).toHaveLength(0)
    })

    test('returns empty array for non-existent epic', async () => {
      const children = await api.children('nonexistent')

      expect(children).toHaveLength(0)
    })
  })

  describe('progress', () => {
    test('returns progress for an epic', async () => {
      const progress = await api.progress('epic-1')

      expect(progress.total).toBe(3)
      expect(progress.closed).toBe(1) // task-1 is closed
      expect(progress.percentage).toBeCloseTo(33.33, 1)
    })

    test('returns 100% for completed epic', async () => {
      const progress = await api.progress('epic-2')

      expect(progress.total).toBe(1)
      expect(progress.closed).toBe(1)
      expect(progress.percentage).toBe(100)
    })

    test('returns 0% for epic with no closed children', async () => {
      // Create epic with all open children
      const issues = [
        { id: 'epic-new', title: 'New Epic', status: 'open', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
        { id: 'task-new', title: 'New Task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z', dependencies: [{ issue_id: 'task-new', depends_on_id: 'epic-new', type: 'blocks' }] },
      ]
      const currentContent = await Bun.file(join(BEADS_DIR, 'issues.jsonl')).text()
      await writeFile(
        join(BEADS_DIR, 'issues.jsonl'),
        currentContent + '\n' + issues.map(i => JSON.stringify(i)).join('\n')
      )
      await api.reload()

      const progress = await api.progress('epic-new')

      expect(progress.total).toBe(1)
      expect(progress.closed).toBe(0)
      expect(progress.percentage).toBe(0)
    })

    test('returns zeros for non-existent epic', async () => {
      const progress = await api.progress('nonexistent')

      expect(progress.total).toBe(0)
      expect(progress.closed).toBe(0)
      expect(progress.percentage).toBe(0)
    })
  })

  describe('reload', () => {
    test('refreshes data from disk', async () => {
      const initialCount = (await api.list()).length
      expect(initialCount).toBe(2)

      // Add a new epic
      const newEpic = { id: 'epic-3', title: 'New Epic', status: 'open', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }
      const currentContent = await Bun.file(join(BEADS_DIR, 'issues.jsonl')).text()
      await writeFile(
        join(BEADS_DIR, 'issues.jsonl'),
        currentContent + '\n' + JSON.stringify(newEpic)
      )

      await api.reload()
      const newCount = (await api.list()).length

      expect(newCount).toBe(3)
    })
  })
})
