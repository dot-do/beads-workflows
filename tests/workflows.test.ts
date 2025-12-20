import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { Workflows, type WorkflowRecord } from '../src/workflows'

const TEST_DIR = '/tmp/beads-workflows-api-test'
const BEADS_DIR = join(TEST_DIR, '.beads')
const WORKFLOWS_PATH = join(BEADS_DIR, 'workflows.jsonl')

describe('Workflows', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('Workflows factory', () => {
    test('creates workflows instance', () => {
      const workflows = Workflows(BEADS_DIR)

      expect(workflows).toBeDefined()
      expect(typeof workflows.record).toBe('function')
      expect(typeof workflows.wasExecuted).toBe('function')
      expect(typeof workflows.list).toBe('function')
      expect(typeof workflows.listFailed).toBe('function')
      expect(typeof workflows.retry).toBe('function')
    })
  })

  describe('record', () => {
    test('records issue event execution', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-123',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc123',
        duration: 142,
      })

      const content = await readFile(WORKFLOWS_PATH, 'utf-8')
      const record = JSON.parse(content.trim())

      expect(record.type).toBe('issue')
      expect(record.issue).toBe('bw-123')
      expect(record.event).toBe('created')
      expect(record.status).toBe('success')
      expect(record.triggered_at).toBeDefined()
    })

    test('records schedule execution', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'schedule',
        cron: '0 * * * *',
        status: 'success',
        handler: 'every.hour.ts',
        trigger: 'schedule',
        commit: 'abc123',
        duration: 5230,
      })

      const content = await readFile(WORKFLOWS_PATH, 'utf-8')
      const record = JSON.parse(content.trim())

      expect(record.type).toBe('schedule')
      expect(record.cron).toBe('0 * * * *')
    })

    test('records failed execution with error', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-456',
        event: 'closed',
        status: 'failed',
        handler: 'on.issue.closed.ts',
        trigger: 'push',
        commit: 'abc123',
        duration: 89,
        error: 'Handler threw: connection refused',
      })

      const content = await readFile(WORKFLOWS_PATH, 'utf-8')
      const record = JSON.parse(content.trim())

      expect(record.status).toBe('failed')
      expect(record.error).toBe('Handler threw: connection refused')
    })

    test('appends to existing file', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-1',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc',
        duration: 100,
      })

      await workflows.record({
        type: 'issue',
        issue: 'bw-2',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'def',
        duration: 200,
      })

      const content = await readFile(WORKFLOWS_PATH, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines.length).toBe(2)
    })
  })

  describe('wasExecuted', () => {
    test('returns false for unexecuted event', async () => {
      const workflows = Workflows(BEADS_DIR)

      const result = await workflows.wasExecuted('bw-123', 'created')

      expect(result).toBe(false)
    })

    test('returns true for executed event', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-123',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc123',
        duration: 100,
      })

      const result = await workflows.wasExecuted('bw-123', 'created')

      expect(result).toBe(true)
    })

    test('returns false for different event on same issue', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-123',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc123',
        duration: 100,
      })

      const result = await workflows.wasExecuted('bw-123', 'closed')

      expect(result).toBe(false)
    })

    test('considers failed executions as not executed', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-123',
        event: 'created',
        status: 'failed',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc123',
        duration: 100,
        error: 'some error',
      })

      const result = await workflows.wasExecuted('bw-123', 'created')

      expect(result).toBe(false)
    })
  })

  describe('list', () => {
    test('returns empty array when no executions', async () => {
      const workflows = Workflows(BEADS_DIR)

      const records = await workflows.list()

      expect(records).toEqual([])
    })

    test('returns all executions', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-1',
        event: 'created',
        status: 'success',
        handler: 'on.issue.created.ts',
        trigger: 'push',
        commit: 'abc',
        duration: 100,
      })

      await workflows.record({
        type: 'issue',
        issue: 'bw-2',
        event: 'closed',
        status: 'failed',
        handler: 'on.issue.closed.ts',
        trigger: 'push',
        commit: 'def',
        duration: 200,
        error: 'error',
      })

      const records = await workflows.list()

      expect(records.length).toBe(2)
    })

    test('filters by issue', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-1',
        event: 'created',
        status: 'success',
        handler: 'h',
        trigger: 'push',
        commit: 'a',
        duration: 1,
      })

      await workflows.record({
        type: 'issue',
        issue: 'bw-2',
        event: 'created',
        status: 'success',
        handler: 'h',
        trigger: 'push',
        commit: 'b',
        duration: 1,
      })

      const records = await workflows.list({ issue: 'bw-1' })

      expect(records.length).toBe(1)
      expect(records[0].issue).toBe('bw-1')
    })
  })

  describe('listFailed', () => {
    test('returns only failed executions', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-1',
        event: 'created',
        status: 'success',
        handler: 'h',
        trigger: 'push',
        commit: 'a',
        duration: 1,
      })

      await workflows.record({
        type: 'issue',
        issue: 'bw-2',
        event: 'closed',
        status: 'failed',
        handler: 'h',
        trigger: 'push',
        commit: 'b',
        duration: 1,
        error: 'error',
      })

      const failed = await workflows.listFailed()

      expect(failed.length).toBe(1)
      expect(failed[0].issue).toBe('bw-2')
      expect(failed[0].status).toBe('failed')
    })
  })

  describe('retry', () => {
    test('marks failed event for retry', async () => {
      const workflows = Workflows(BEADS_DIR)

      await workflows.record({
        type: 'issue',
        issue: 'bw-123',
        event: 'closed',
        status: 'failed',
        handler: 'on.issue.closed.ts',
        trigger: 'push',
        commit: 'abc',
        duration: 100,
        error: 'error',
      })

      const retryInfo = await workflows.retry('bw-123', 'closed')

      expect(retryInfo).toBeDefined()
      expect(retryInfo?.issue).toBe('bw-123')
      expect(retryInfo?.event).toBe('closed')
    })

    test('returns null for non-existent event', async () => {
      const workflows = Workflows(BEADS_DIR)

      const retryInfo = await workflows.retry('bw-999', 'created')

      expect(retryInfo).toBeNull()
    })
  })
})
