import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm, appendFile, readFile } from 'fs/promises'
import { join } from 'path'
import { createDaemon, parseArgs, parseCommand, type Daemon, type DaemonOptions, type Command } from '../src/cli'

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

  describe('parseCommand', () => {
    test('parses run command (default)', () => {
      const cmd = parseCommand([])
      expect(cmd.command).toBe('run')
    })

    test('parses run --once', () => {
      const cmd = parseCommand(['run', '--once'])
      expect(cmd.command).toBe('run')
      expect(cmd.once).toBe(true)
    })

    test('parses list command', () => {
      const cmd = parseCommand(['list'])
      expect(cmd.command).toBe('list')
    })

    test('parses list --failed', () => {
      const cmd = parseCommand(['list', '--failed'])
      expect(cmd.command).toBe('list')
      expect(cmd.failed).toBe(true)
    })

    test('parses list --issue', () => {
      const cmd = parseCommand(['list', '--issue', 'bw-123'])
      expect(cmd.command).toBe('list')
      expect(cmd.issue).toBe('bw-123')
    })

    test('parses retry command with issue and event', () => {
      const cmd = parseCommand(['retry', 'bw-123', 'closed'])
      expect(cmd.command).toBe('retry')
      expect(cmd.issue).toBe('bw-123')
      expect(cmd.event).toBe('closed')
    })

    test('parses retry --all-failed', () => {
      const cmd = parseCommand(['retry', '--all-failed'])
      expect(cmd.command).toBe('retry')
      expect(cmd.allFailed).toBe(true)
    })
  })

  describe('--once mode', () => {
    test('runs once and exits', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (ctx) => console.log(ctx.issue)'
      )

      const daemon = createDaemon({ path: BEADS_DIR, once: true })

      // Add an issue before starting
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
      }
      await writeFile(JSONL_PATH, JSON.stringify(issue) + '\n')

      await daemon.start()

      // In once mode, should automatically stop after processing
      expect(daemon.isRunning()).toBe(false)
    })
  })
})
