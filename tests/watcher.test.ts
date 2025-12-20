import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm, appendFile } from 'fs/promises'
import { join } from 'path'
import { createWatcher, type Watcher, type WatcherEvent } from '../src/watcher'

const TEST_DIR = '/tmp/beads-watcher-test'
const BEADS_DIR = join(TEST_DIR, '.beads')
const JSONL_PATH = join(BEADS_DIR, 'issues.jsonl')

describe('watcher', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
    await writeFile(JSONL_PATH, '')
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('createWatcher', () => {
    test('creates watcher instance', () => {
      const watcher = createWatcher(BEADS_DIR)

      expect(watcher).toBeDefined()
      expect(typeof watcher.start).toBe('function')
      expect(typeof watcher.stop).toBe('function')
      expect(typeof watcher.on).toBe('function')
    })
  })

  describe('watching for changes', () => {
    test('detects new issue appended', async () => {
      const watcher = createWatcher(BEADS_DIR)
      const events: WatcherEvent[] = []

      watcher.on('issue', (event) => {
        events.push(event)
      })

      await watcher.start()

      // Append a new issue
      const issue = { id: 'proj-1', title: 'New Issue', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }
      await appendFile(JSONL_PATH, JSON.stringify(issue) + '\n')

      // Wait for polling + debounce (50ms poll + 100ms debounce + buffer)
      await new Promise(r => setTimeout(r, 250))

      await watcher.stop()

      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0].type).toBe('created')
      expect(events[0].issue.id).toBe('proj-1')
    })

    test('detects multiple issues appended', async () => {
      const watcher = createWatcher(BEADS_DIR)
      const events: WatcherEvent[] = []

      watcher.on('issue', (event) => {
        events.push(event)
      })

      await watcher.start()

      // Append multiple issues
      const issues = [
        { id: 'proj-1', title: 'First', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
        { id: 'proj-2', title: 'Second', status: 'open', priority: 1, issue_type: 'bug', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
      ]
      await appendFile(JSONL_PATH, issues.map(i => JSON.stringify(i)).join('\n') + '\n')

      await new Promise(r => setTimeout(r, 250))

      await watcher.stop()

      expect(events.length).toBe(2)
    })

    test('detects status change (closed)', async () => {
      // Start with an open issue
      const initial = { id: 'proj-1', title: 'Task', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }
      await writeFile(JSONL_PATH, JSON.stringify(initial) + '\n')

      const watcher = createWatcher(BEADS_DIR)
      const events: WatcherEvent[] = []

      watcher.on('issue', (event) => {
        events.push(event)
      })

      await watcher.start()

      // Append closed version
      const closed = { ...initial, status: 'closed', closed_at: '2025-01-02T10:00:00Z', updated_at: '2025-01-02T10:00:00Z' }
      await appendFile(JSONL_PATH, JSON.stringify(closed) + '\n')

      await new Promise(r => setTimeout(r, 250))

      await watcher.stop()

      // Should detect update/closed event
      expect(events.some(e => e.type === 'closed' || e.type === 'updated')).toBe(true)
    })
  })

  describe('debouncing', () => {
    test('debounces rapid changes', async () => {
      const watcher = createWatcher(BEADS_DIR, { debounceMs: 100 })
      let callCount = 0

      watcher.on('change', () => {
        callCount++
      })

      await watcher.start()

      // Rapid appends
      for (let i = 0; i < 5; i++) {
        await appendFile(JSONL_PATH, JSON.stringify({ id: `proj-${i}`, title: `Task ${i}`, status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }) + '\n')
        await new Promise(r => setTimeout(r, 20))
      }

      await new Promise(r => setTimeout(r, 200))

      await watcher.stop()

      // Should be debounced to fewer calls
      expect(callCount).toBeLessThan(5)
    })
  })

  describe('lifecycle', () => {
    test('start and stop work correctly', async () => {
      const watcher = createWatcher(BEADS_DIR)

      expect(watcher.isRunning()).toBe(false)

      await watcher.start()
      expect(watcher.isRunning()).toBe(true)

      await watcher.stop()
      expect(watcher.isRunning()).toBe(false)
    })

    test('can restart after stop', async () => {
      const watcher = createWatcher(BEADS_DIR)
      const events: WatcherEvent[] = []

      watcher.on('issue', (event) => {
        events.push(event)
      })

      await watcher.start()
      await watcher.stop()
      await watcher.start()

      // Wait for fs.watch to fully initialize (macOS needs more time)
      await new Promise(r => setTimeout(r, 100))

      await appendFile(JSONL_PATH, JSON.stringify({ id: 'proj-1', title: 'Test', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }) + '\n')

      await new Promise(r => setTimeout(r, 200))

      await watcher.stop()

      expect(events.length).toBeGreaterThanOrEqual(1)
    })
  })
})
