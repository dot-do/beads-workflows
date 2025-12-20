import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm, appendFile } from 'fs/promises'
import { join } from 'path'
import { createDaemon, parseArgs, type Daemon, type DaemonOptions } from '../src/cli'

const TEST_DIR = '/tmp/beads-cli-test'
const BEADS_DIR = join(TEST_DIR, '.beads')
const JSONL_PATH = join(BEADS_DIR, 'issues.jsonl')

describe('cli', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
    await writeFile(JSONL_PATH, '')
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('parseArgs', () => {
    test('parses empty args', () => {
      const options = parseArgs([])

      expect(options.path).toBeUndefined()
      expect(options.verbose).toBe(false)
    })

    test('parses --path option', () => {
      const options = parseArgs(['--path', '/custom/path'])

      expect(options.path).toBe('/custom/path')
    })

    test('parses -p short option', () => {
      const options = parseArgs(['-p', '/custom/path'])

      expect(options.path).toBe('/custom/path')
    })

    test('parses --verbose flag', () => {
      const options = parseArgs(['--verbose'])

      expect(options.verbose).toBe(true)
    })

    test('parses -v short flag', () => {
      const options = parseArgs(['-v'])

      expect(options.verbose).toBe(true)
    })

    test('parses multiple options', () => {
      const options = parseArgs(['--path', '/custom', '--verbose'])

      expect(options.path).toBe('/custom')
      expect(options.verbose).toBe(true)
    })
  })

  describe('createDaemon', () => {
    test('creates daemon instance', () => {
      const daemon = createDaemon({ path: BEADS_DIR })

      expect(daemon).toBeDefined()
      expect(typeof daemon.start).toBe('function')
      expect(typeof daemon.stop).toBe('function')
      expect(typeof daemon.isRunning).toBe('function')
    })
  })

  describe('daemon lifecycle', () => {
    test('starts and stops', async () => {
      const daemon = createDaemon({ path: BEADS_DIR })

      expect(daemon.isRunning()).toBe(false)

      await daemon.start()
      expect(daemon.isRunning()).toBe(true)

      await daemon.stop()
      expect(daemon.isRunning()).toBe(false)
    })

    test('scans for handlers on start', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (ctx) => console.log(ctx.issue)'
      )

      const daemon = createDaemon({ path: BEADS_DIR })
      await daemon.start()

      expect(daemon.getHandlerCount()).toBe(1)

      await daemon.stop()
    })
  })

  describe('event handling', () => {
    test('triggers handlers when issue created', async () => {
      let handlerCalled = false

      // Create a handler file
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        `export default (ctx) => {
          console.log('Handler called:', ctx.issue.id)
        }`
      )

      const daemon = createDaemon({
        path: BEADS_DIR,
        onHandlerExecuted: () => {
          handlerCalled = true
        },
      })

      await daemon.start()

      // Add an issue
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
      }
      await appendFile(JSONL_PATH, JSON.stringify(issue) + '\n')

      // Wait for watcher + debounce + handler execution
      await new Promise((r) => setTimeout(r, 300))

      await daemon.stop()

      expect(handlerCalled).toBe(true)
    })
  })

  describe('error handling', () => {
    test('handles missing beads directory gracefully', async () => {
      const daemon = createDaemon({ path: '/nonexistent/.beads' })

      // Should not throw
      await daemon.start()
      await daemon.stop()
    })
  })
})
