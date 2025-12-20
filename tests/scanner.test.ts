import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { createScanner, type Scanner, type HandlerInfo } from '../src/scanner'

const TEST_DIR = '/tmp/beads-scanner-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('scanner', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('createScanner', () => {
    test('creates scanner instance', () => {
      const scanner = createScanner(BEADS_DIR)

      expect(scanner).toBeDefined()
      expect(typeof scanner.scan).toBe('function')
      expect(typeof scanner.getHandlers).toBe('function')
    })
  })

  describe('scanning handlers', () => {
    test('finds no handlers in empty directory', async () => {
      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers).toEqual([])
    })

    test('finds on.issue.created.ts handler', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (issue) => console.log(issue)'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers.length).toBe(1)
      expect(handlers[0].event).toBe('issue.created')
      expect(handlers[0].path).toContain('on.issue.created.ts')
    })

    test('finds on.issue.ready.ts handler', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.ready.ts'),
        'export default (issue) => console.log(issue)'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers.length).toBe(1)
      expect(handlers[0].event).toBe('issue.ready')
    })

    test('finds multiple handlers', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (issue) => {}'
      )
      await writeFile(
        join(BEADS_DIR, 'on.issue.closed.ts'),
        'export default (issue) => {}'
      )
      await writeFile(
        join(BEADS_DIR, 'on.epic.completed.ts'),
        'export default (epic) => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers.length).toBe(3)
      expect(handlers.map(h => h.event).sort()).toEqual([
        'epic.completed',
        'issue.closed',
        'issue.created',
      ])
    })

    test('ignores non-handler files', async () => {
      await writeFile(join(BEADS_DIR, 'config.ts'), 'export default {}')
      await writeFile(join(BEADS_DIR, 'utils.ts'), 'export function x() {}')
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (issue) => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers.length).toBe(1)
      expect(handlers[0].event).toBe('issue.created')
    })

    test('handles .js extension', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.js'),
        'export default (issue) => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers.length).toBe(1)
      expect(handlers[0].event).toBe('issue.created')
    })
  })

  describe('getHandlers', () => {
    test('returns empty map before scan', () => {
      const scanner = createScanner(BEADS_DIR)
      const handlers = scanner.getHandlers()

      expect(handlers.size).toBe(0)
    })

    test('returns handlers map after scan', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default (issue) => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      await scanner.scan()
      const handlers = scanner.getHandlers()

      expect(handlers.size).toBe(1)
      expect(handlers.has('issue.created')).toBe(true)
    })
  })

  describe('event name parsing', () => {
    test('parses issue.created from on.issue.created.ts', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.created.ts'),
        'export default () => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers[0].event).toBe('issue.created')
    })

    test('parses dep.added from on.dep.added.ts', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.dep.added.ts'),
        'export default () => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers[0].event).toBe('dep.added')
    })

    test('handles multi-part event names', async () => {
      await writeFile(
        join(BEADS_DIR, 'on.issue.status.changed.ts'),
        'export default () => {}'
      )

      const scanner = createScanner(BEADS_DIR)
      const handlers = await scanner.scan()

      expect(handlers[0].event).toBe('issue.status.changed')
    })
  })
})
