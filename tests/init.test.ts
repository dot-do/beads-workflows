import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm, readFile, access } from 'fs/promises'
import { join } from 'path'
import { initWorkflows, type InitOptions, type InitResult } from '../src/init'

const TEST_DIR = '/tmp/beads-init-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('init', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('initWorkflows', () => {
    test('creates global.d.ts', async () => {
      const result = await initWorkflows(BEADS_DIR)

      expect(result.success).toBe(true)
      expect(result.files).toContain('global.d.ts')

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('declare global')
      expect(globalDts).toContain('issue')
      expect(globalDts).toContain('Issue')
    })

    test('creates tsconfig.json', async () => {
      const result = await initWorkflows(BEADS_DIR)

      expect(result.success).toBe(true)
      expect(result.files).toContain('tsconfig.json')

      const tsconfig = await readFile(join(BEADS_DIR, 'tsconfig.json'), 'utf-8')
      const parsed = JSON.parse(tsconfig)
      expect(parsed.compilerOptions).toBeDefined()
      expect(parsed.include).toContain('*.ts')
    })

    test('creates example handler when requested', async () => {
      const result = await initWorkflows(BEADS_DIR, { createExample: true })

      expect(result.success).toBe(true)
      expect(result.files).toContain('on.issue.ready.ts')

      const handler = await readFile(join(BEADS_DIR, 'on.issue.ready.ts'), 'utf-8')
      expect(handler).toContain('issue')
    })

    test('does not create example handler by default', async () => {
      const result = await initWorkflows(BEADS_DIR)

      expect(result.files).not.toContain('on.issue.ready.ts')
    })

    test('global.d.ts has Issue type', async () => {
      await initWorkflows(BEADS_DIR)

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('interface Issue')
      expect(globalDts).toContain('id: string')
      expect(globalDts).toContain('title: string')
      expect(globalDts).toContain('status:')
    })

    test('global.d.ts has Epic type', async () => {
      await initWorkflows(BEADS_DIR)

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('interface Epic')
    })

    test('global.d.ts has issue global variable', async () => {
      await initWorkflows(BEADS_DIR)

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('const issue: Issue')
    })

    test('global.d.ts has issues global variable', async () => {
      await initWorkflows(BEADS_DIR)

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('const issues:')
    })

    test('global.d.ts has epics global variable', async () => {
      await initWorkflows(BEADS_DIR)

      const globalDts = await readFile(join(BEADS_DIR, 'global.d.ts'), 'utf-8')
      expect(globalDts).toContain('const epics:')
    })
  })

  describe('idempotency', () => {
    test('can run init multiple times', async () => {
      await initWorkflows(BEADS_DIR)
      const result = await initWorkflows(BEADS_DIR)

      expect(result.success).toBe(true)
    })

    test('preserves existing handler files', async () => {
      await Bun.write(join(BEADS_DIR, 'on.issue.created.ts'), 'custom handler')

      await initWorkflows(BEADS_DIR, { createExample: true })

      const handler = await readFile(join(BEADS_DIR, 'on.issue.created.ts'), 'utf-8')
      expect(handler).toBe('custom handler')
    })
  })

  describe('error handling', () => {
    test('fails gracefully if directory does not exist', async () => {
      const result = await initWorkflows('/nonexistent/.beads')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
