import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'
import {
  buildCreateCommand,
  buildUpdateCommand,
  buildCloseCommand,
  parseJsonOutput,
  type CreateOptions,
  type UpdateOptions,
} from '../src/writer'

describe('writer', () => {
  describe('buildCreateCommand', () => {
    test('builds basic create command', () => {
      const options: CreateOptions = {
        title: 'New task',
        type: 'task',
        priority: 2,
      }

      const args = buildCreateCommand(options)

      expect(args).toContain('create')
      expect(args).toContain('--title=New task')
      expect(args).toContain('--type=task')
      expect(args).toContain('--priority=2')
      expect(args).toContain('--json')
    })

    test('includes description when provided', () => {
      const options: CreateOptions = {
        title: 'New task',
        type: 'task',
        priority: 2,
        description: 'A detailed description',
      }

      const args = buildCreateCommand(options)

      expect(args).toContain('--description=A detailed description')
    })

    test('includes assignee when provided', () => {
      const options: CreateOptions = {
        title: 'New task',
        type: 'task',
        priority: 2,
        assignee: 'alice',
      }

      const args = buildCreateCommand(options)

      expect(args).toContain('--assignee=alice')
    })

    test('builds epic create command', () => {
      const options: CreateOptions = {
        title: 'New epic',
        type: 'epic',
        priority: 1,
        description: 'An epic description',
      }

      const args = buildCreateCommand(options)

      expect(args).toContain('--type=epic')
    })
  })

  describe('buildUpdateCommand', () => {
    test('builds status update command', () => {
      const options: UpdateOptions = {
        status: 'in_progress',
      }

      const args = buildUpdateCommand('proj-123', options)

      expect(args).toContain('update')
      expect(args).toContain('proj-123')
      expect(args).toContain('--status=in_progress')
      expect(args).toContain('--json')
    })

    test('builds priority update command', () => {
      const options: UpdateOptions = {
        priority: 0,
      }

      const args = buildUpdateCommand('proj-123', options)

      expect(args).toContain('--priority=0')
    })

    test('builds assignee update command', () => {
      const options: UpdateOptions = {
        assignee: 'bob',
      }

      const args = buildUpdateCommand('proj-123', options)

      expect(args).toContain('--assignee=bob')
    })

    test('combines multiple updates', () => {
      const options: UpdateOptions = {
        status: 'in_progress',
        priority: 1,
        assignee: 'charlie',
      }

      const args = buildUpdateCommand('proj-456', options)

      expect(args).toContain('proj-456')
      expect(args).toContain('--status=in_progress')
      expect(args).toContain('--priority=1')
      expect(args).toContain('--assignee=charlie')
    })
  })

  describe('buildCloseCommand', () => {
    test('builds basic close command', () => {
      const args = buildCloseCommand('proj-123')

      expect(args).toContain('close')
      expect(args).toContain('proj-123')
      expect(args).toContain('--json')
    })

    test('includes reason when provided', () => {
      const args = buildCloseCommand('proj-123', 'Fixed the issue')

      expect(args).toContain('--reason=Fixed the issue')
    })
  })

  describe('parseJsonOutput', () => {
    test('parses successful create output', () => {
      const output = JSON.stringify({
        id: 'proj-abc',
        title: 'Created issue',
        status: 'open',
      })

      const result = parseJsonOutput(output)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('proj-abc')
    })

    test('parses successful update output', () => {
      const output = JSON.stringify({
        id: 'proj-123',
        title: 'Updated issue',
        status: 'in_progress',
      })

      const result = parseJsonOutput(output)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('in_progress')
    })

    test('handles empty output', () => {
      const result = parseJsonOutput('')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('handles non-JSON output', () => {
      const result = parseJsonOutput('Error: something went wrong')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to parse')
    })

    test('extracts success message from bd output', () => {
      // bd sometimes outputs: ✓ Created issue: proj-123
      // followed by JSON
      const output = `✓ Created issue: proj-123
${JSON.stringify({ id: 'proj-123', title: 'Test' })}`

      const result = parseJsonOutput(output)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('proj-123')
    })
  })
})
