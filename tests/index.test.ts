import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'

// Test that all expected exports are available
describe('beads-workflows exports', () => {
  const TEST_DIR = '/tmp/beads-index-test'
  const BEADS_DIR = join(TEST_DIR, '.beads')

  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
    await writeFile(
      join(BEADS_DIR, 'issues.jsonl'),
      JSON.stringify({ id: 'test-1', title: 'Test', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' })
    )
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  test('exports Beads factory', async () => {
    const { Beads } = await import('../src/index')
    expect(typeof Beads).toBe('function')

    const beads = Beads({ path: BEADS_DIR })
    expect(beads.issues).toBeDefined()
    expect(beads.epics).toBeDefined()
    expect(beads.on).toBeDefined()
  })

  test('exports type guards', async () => {
    const { isIssue, isEpic, isValidStatus, isValidType, isValidPriority } = await import('../src/index')

    expect(typeof isIssue).toBe('function')
    expect(typeof isEpic).toBe('function')
    expect(typeof isValidStatus).toBe('function')
    expect(typeof isValidType).toBe('function')
    expect(typeof isValidPriority).toBe('function')
  })

  test('exports reader functions', async () => {
    const { readIssuesFromJsonl, findBeadsDir, parseJsonlLine } = await import('../src/index')

    expect(typeof readIssuesFromJsonl).toBe('function')
    expect(typeof findBeadsDir).toBe('function')
    expect(typeof parseJsonlLine).toBe('function')
  })

  test('exports writer functions', async () => {
    const { buildCreateCommand, buildUpdateCommand, buildCloseCommand, parseJsonOutput } = await import('../src/index')

    expect(typeof buildCreateCommand).toBe('function')
    expect(typeof buildUpdateCommand).toBe('function')
    expect(typeof buildCloseCommand).toBe('function')
    expect(typeof parseJsonOutput).toBe('function')
  })

  test('exports createIssuesApi', async () => {
    const { createIssuesApi } = await import('../src/index')
    expect(typeof createIssuesApi).toBe('function')

    const api = createIssuesApi(BEADS_DIR)
    const issues = await api.list()
    expect(issues).toHaveLength(1)
  })

  test('exports createEpicsApi', async () => {
    const { createEpicsApi } = await import('../src/index')
    expect(typeof createEpicsApi).toBe('function')
  })

  test('exports createHooks', async () => {
    const { createHooks } = await import('../src/index')
    expect(typeof createHooks).toBe('function')

    const hooks = createHooks()
    expect(hooks.on.issue.ready).toBeDefined()
  })
})
