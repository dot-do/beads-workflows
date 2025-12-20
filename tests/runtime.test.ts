import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { createRuntime, type Runtime, type HandlerContext } from '../src/runtime'

const TEST_DIR = '/tmp/beads-runtime-test'
const BEADS_DIR = join(TEST_DIR, '.beads')
const JSONL_PATH = join(BEADS_DIR, 'issues.jsonl')

describe('runtime', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
    await writeFile(JSONL_PATH, '')
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('createRuntime', () => {
    test('creates runtime instance', () => {
      const runtime = createRuntime(BEADS_DIR)

      expect(runtime).toBeDefined()
      expect(typeof runtime.execute).toBe('function')
      expect(typeof runtime.createContext).toBe('function')
    })
  })

  describe('createContext', () => {
    test('creates context with issue', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const context = await runtime.createContext('issue.created', { issue })

      expect(context.globals.issue).toBeDefined()
      expect(context.globals.issue.id).toBe('test-1')
    })

    test('creates context with issues API', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const context = await runtime.createContext('issue.created', { issue })

      expect(context.globals.issues).toBeDefined()
      expect(typeof context.globals.issues.list).toBe('function')
      expect(typeof context.globals.issues.ready).toBe('function')
    })

    test('creates context with epics API', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const context = await runtime.createContext('issue.created', { issue })

      expect(context.globals.epics).toBeDefined()
      expect(typeof context.globals.epics.list).toBe('function')
    })

    test('creates context with previousIssue for updated events', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'closed' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }
      const previousIssue = {
        ...issue,
        status: 'open' as const,
      }

      const context = await runtime.createContext('issue.closed', { issue, previousIssue })

      expect(context.globals.previousIssue).toBeDefined()
      expect(context.globals.previousIssue?.status).toBe('open')
    })
  })

  describe('execute', () => {
    test('executes handler function', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      let executed = false
      const handler = async (ctx: HandlerContext) => {
        executed = true
        expect(ctx.issue.id).toBe('test-1')
      }

      await runtime.execute('issue.created', handler, { issue })

      expect(executed).toBe(true)
    })

    test('passes context to handler', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      let receivedIssues: unknown
      const handler = async (ctx: HandlerContext) => {
        receivedIssues = ctx.issues
      }

      await runtime.execute('issue.created', handler, { issue })

      expect(receivedIssues).toBeDefined()
    })

    test('handles handler errors gracefully', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const handler = async () => {
        throw new Error('Handler error')
      }

      const result = await runtime.execute('issue.created', handler, { issue })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Handler error')
    })

    test('returns success for successful handlers', async () => {
      const runtime = createRuntime(BEADS_DIR)
      const issue = {
        id: 'test-1',
        title: 'Test',
        status: 'open' as const,
        type: 'task' as const,
        priority: 2 as const,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const handler = async () => {
        // Success
      }

      const result = await runtime.execute('issue.created', handler, { issue })

      expect(result.success).toBe(true)
    })
  })
})
