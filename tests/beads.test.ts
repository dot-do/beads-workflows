import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { Beads, type BeadsInstance } from '../src/beads'

const TEST_DIR = '/tmp/beads-factory-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('Beads factory', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })

    // Create sample issues.jsonl
    const issues = [
      { id: 'proj-1', title: 'Task 1', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
      { id: 'proj-2', title: 'Task 2', status: 'closed', priority: 1, issue_type: 'bug', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-02T10:00:00Z', closed_at: '2025-01-02T10:00:00Z' },
      { id: 'epic-1', title: 'Epic 1', status: 'open', priority: 1, issue_type: 'epic', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
    ]

    await writeFile(
      join(BEADS_DIR, 'issues.jsonl'),
      issues.map(i => JSON.stringify(i)).join('\n')
    )
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('factory function', () => {
    test('creates instance with path option', () => {
      const beads = Beads({ path: BEADS_DIR })

      expect(beads).toBeDefined()
      expect(beads.issues).toBeDefined()
      expect(beads.epics).toBeDefined()
      expect(beads.on).toBeDefined()
    })

    test('returns issues API', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const issues = await beads.issues.list()

      expect(issues).toHaveLength(3)
    })

    test('returns epics API', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const epics = await beads.epics.list()

      expect(epics).toHaveLength(1)
      expect(epics[0].id).toBe('epic-1')
    })

    test('returns hooks API with fluent interface', () => {
      const beads = Beads({ path: BEADS_DIR })

      expect(typeof beads.on.issue.created).toBe('function')
      expect(typeof beads.on.issue.ready).toBe('function')
      expect(typeof beads.on.epic.completed).toBe('function')
    })
  })

  describe('multiple instances', () => {
    test('can create multiple independent instances', async () => {
      // Create second test directory
      const TEST_DIR_2 = '/tmp/beads-factory-test-2'
      const BEADS_DIR_2 = join(TEST_DIR_2, '.beads')
      await mkdir(BEADS_DIR_2, { recursive: true })
      await writeFile(
        join(BEADS_DIR_2, 'issues.jsonl'),
        JSON.stringify({ id: 'other-1', title: 'Other Task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' })
      )

      const beads1 = Beads({ path: BEADS_DIR })
      const beads2 = Beads({ path: BEADS_DIR_2 })

      const issues1 = await beads1.issues.list()
      const issues2 = await beads2.issues.list()

      expect(issues1).toHaveLength(3)
      expect(issues2).toHaveLength(1)
      expect(issues2[0].id).toBe('other-1')

      await rm(TEST_DIR_2, { recursive: true, force: true })
    })
  })

  describe('issues API through Beads', () => {
    test('issues.ready() works', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const ready = await beads.issues.ready()

      // proj-1, epic-1 are open with no blockers
      expect(ready.length).toBeGreaterThanOrEqual(2)
    })

    test('issues.get() works', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const issue = await beads.issues.get('proj-1')

      expect(issue).not.toBeNull()
      expect(issue!.title).toBe('Task 1')
    })

    test('issues.count() works', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const count = await beads.issues.count({ status: 'open' })

      expect(count).toBe(2)
    })
  })

  describe('epics API through Beads', () => {
    test('epics.get() works', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const epic = await beads.epics.get('epic-1')

      expect(epic).not.toBeNull()
      expect(epic!.type).toBe('epic')
    })

    test('epics.progress() works', async () => {
      const beads = Beads({ path: BEADS_DIR })

      const progress = await beads.epics.progress('epic-1')

      expect(progress.total).toBe(0) // No children in this test
      expect(progress.percentage).toBe(0)
    })
  })

  describe('hooks API through Beads', () => {
    test('can register and emit events', () => {
      const beads = Beads({ path: BEADS_DIR })

      let called = false
      beads.on.issue.created(() => { called = true })

      beads.emit('issue.created', {
        id: 'new-1',
        title: 'New Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      })

      expect(called).toBe(true)
    })
  })
})
