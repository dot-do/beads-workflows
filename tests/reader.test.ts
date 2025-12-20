import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import {
  readIssuesFromJsonl,
  parseJsonlLine,
  findBeadsDir,
  type JsonlIssue,
} from '../src/reader'
import type { Issue } from '../src/types'

const TEST_DIR = '/tmp/beads-workflows-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('reader', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('parseJsonlLine', () => {
    test('parses a complete issue line', () => {
      const line = JSON.stringify({
        id: 'proj-123',
        title: 'Test issue',
        description: 'A description',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-02T10:00:00Z',
      })

      const issue = parseJsonlLine(line)

      expect(issue).not.toBeNull()
      expect(issue!.id).toBe('proj-123')
      expect(issue!.title).toBe('Test issue')
      expect(issue!.description).toBe('A description')
      expect(issue!.status).toBe('open')
      expect(issue!.priority).toBe(2)
      expect(issue!.type).toBe('task')
      expect(issue!.created).toBeInstanceOf(Date)
      expect(issue!.updated).toBeInstanceOf(Date)
    })

    test('parses closed issue with close_reason', () => {
      const line = JSON.stringify({
        id: 'proj-456',
        title: 'Closed issue',
        status: 'closed',
        priority: 1,
        issue_type: 'bug',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-03T10:00:00Z',
        closed_at: '2025-01-03T10:00:00Z',
        close_reason: 'Fixed the bug',
      })

      const issue = parseJsonlLine(line)

      expect(issue!.status).toBe('closed')
      expect(issue!.closed).toBeInstanceOf(Date)
    })

    test('parses issue with dependencies', () => {
      const line = JSON.stringify({
        id: 'proj-789',
        title: 'Dependent issue',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
        dependencies: [
          { issue_id: 'proj-789', depends_on_id: 'proj-100', type: 'blocks' },
          { issue_id: 'proj-789', depends_on_id: 'proj-200', type: 'blocks' },
        ],
      })

      const issue = parseJsonlLine(line)

      expect(issue!.dependsOn).toEqual(['proj-100', 'proj-200'])
    })

    test('handles empty line gracefully', () => {
      expect(parseJsonlLine('')).toBeNull()
      expect(parseJsonlLine('  ')).toBeNull()
    })

    test('handles invalid JSON gracefully', () => {
      expect(parseJsonlLine('not json')).toBeNull()
      expect(parseJsonlLine('{invalid')).toBeNull()
    })

    test('maps issue_type to type field', () => {
      const taskLine = JSON.stringify({
        id: 'proj-1',
        title: 'Task',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
      })

      const epicLine = JSON.stringify({
        id: 'proj-2',
        title: 'Epic',
        status: 'open',
        priority: 1,
        issue_type: 'epic',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
      })

      expect(parseJsonlLine(taskLine)!.type).toBe('task')
      expect(parseJsonlLine(epicLine)!.type).toBe('epic')
    })
  })

  describe('readIssuesFromJsonl', () => {
    test('reads all issues from JSONL file', async () => {
      const jsonlContent = [
        JSON.stringify({ id: 'proj-1', title: 'First', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }),
        JSON.stringify({ id: 'proj-2', title: 'Second', status: 'closed', priority: 1, issue_type: 'bug', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-02T10:00:00Z', closed_at: '2025-01-02T10:00:00Z' }),
        JSON.stringify({ id: 'proj-3', title: 'Third', status: 'in_progress', priority: 0, issue_type: 'feature', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }),
      ].join('\n')

      await writeFile(join(BEADS_DIR, 'issues.jsonl'), jsonlContent)

      const issues = await readIssuesFromJsonl(BEADS_DIR)

      expect(issues).toHaveLength(3)
      expect(issues[0].id).toBe('proj-1')
      expect(issues[1].id).toBe('proj-2')
      expect(issues[2].id).toBe('proj-3')
    })

    test('handles empty file', async () => {
      await writeFile(join(BEADS_DIR, 'issues.jsonl'), '')

      const issues = await readIssuesFromJsonl(BEADS_DIR)

      expect(issues).toHaveLength(0)
    })

    test('skips invalid lines', async () => {
      const jsonlContent = [
        JSON.stringify({ id: 'proj-1', title: 'Valid', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }),
        'invalid json line',
        '',
        JSON.stringify({ id: 'proj-2', title: 'Also Valid', status: 'open', priority: 2, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }),
      ].join('\n')

      await writeFile(join(BEADS_DIR, 'issues.jsonl'), jsonlContent)

      const issues = await readIssuesFromJsonl(BEADS_DIR)

      expect(issues).toHaveLength(2)
      expect(issues[0].id).toBe('proj-1')
      expect(issues[1].id).toBe('proj-2')
    })

    test('throws if file does not exist', async () => {
      await expect(readIssuesFromJsonl('/nonexistent/.beads')).rejects.toThrow()
    })

    test('builds blocks array from all dependencies', async () => {
      // Issue proj-2 depends on proj-1, so proj-1 blocks proj-2
      const jsonlContent = [
        JSON.stringify({ id: 'proj-1', title: 'Blocker', status: 'open', priority: 1, issue_type: 'task', created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' }),
        JSON.stringify({
          id: 'proj-2',
          title: 'Blocked',
          status: 'open',
          priority: 2,
          issue_type: 'task',
          created_at: '2025-01-01T10:00:00Z',
          updated_at: '2025-01-01T10:00:00Z',
          dependencies: [{ issue_id: 'proj-2', depends_on_id: 'proj-1', type: 'blocks' }]
        }),
      ].join('\n')

      await writeFile(join(BEADS_DIR, 'issues.jsonl'), jsonlContent)

      const issues = await readIssuesFromJsonl(BEADS_DIR)

      // proj-1 should have blocks = ['proj-2']
      const blocker = issues.find(i => i.id === 'proj-1')!
      expect(blocker.blocks).toContain('proj-2')

      // proj-2 should have dependsOn = ['proj-1']
      const blocked = issues.find(i => i.id === 'proj-2')!
      expect(blocked.dependsOn).toContain('proj-1')
    })
  })

  describe('findBeadsDir', () => {
    test('finds .beads in current directory', async () => {
      const found = await findBeadsDir(TEST_DIR)
      expect(found).toBe(BEADS_DIR)
    })

    test('finds .beads in parent directory', async () => {
      const subdir = join(TEST_DIR, 'src', 'components')
      await mkdir(subdir, { recursive: true })

      const found = await findBeadsDir(subdir)
      expect(found).toBe(BEADS_DIR)
    })

    test('returns null if no .beads found', async () => {
      const isolated = '/tmp/no-beads-here'
      await mkdir(isolated, { recursive: true })

      const found = await findBeadsDir(isolated)
      expect(found).toBeNull()

      await rm(isolated, { recursive: true, force: true })
    })
  })
})
