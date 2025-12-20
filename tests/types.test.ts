import { describe, expect, test } from 'bun:test'
import {
  type Issue,
  type Epic,
  type Changes,
  type IssueEvent,
  type IssueStatus,
  type IssueType,
  type Priority,
  isIssue,
  isEpic,
  isValidStatus,
  isValidType,
  isValidPriority,
} from '../src/types'

describe('types', () => {
  describe('Issue interface', () => {
    test('Issue has required fields', () => {
      const issue: Issue = {
        id: 'proj-123',
        title: 'Test issue',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date('2025-01-01'),
        updated: new Date('2025-01-02'),
        dependsOn: [],
        blocks: [],
      }

      expect(issue.id).toBe('proj-123')
      expect(issue.title).toBe('Test issue')
      expect(issue.status).toBe('open')
      expect(issue.type).toBe('task')
      expect(issue.priority).toBe(2)
      expect(issue.dependsOn).toEqual([])
      expect(issue.blocks).toEqual([])
    })

    test('Issue has optional fields', () => {
      const issue: Issue = {
        id: 'proj-456',
        title: 'Full issue',
        description: 'A detailed description',
        status: 'in_progress',
        type: 'bug',
        priority: 0,
        assignee: 'alice',
        labels: ['urgent', 'frontend'],
        created: new Date('2025-01-01'),
        updated: new Date('2025-01-02'),
        closed: new Date('2025-01-03'),
        dependsOn: ['proj-100'],
        blocks: ['proj-200', 'proj-201'],
        parent: 'proj-epic',
        children: [],
      }

      expect(issue.description).toBe('A detailed description')
      expect(issue.assignee).toBe('alice')
      expect(issue.labels).toEqual(['urgent', 'frontend'])
      expect(issue.closed).toBeInstanceOf(Date)
      expect(issue.parent).toBe('proj-epic')
    })
  })

  describe('isIssue type guard', () => {
    test('returns true for valid Issue object', () => {
      const issue = {
        id: 'proj-123',
        title: 'Test',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }
      expect(isIssue(issue)).toBe(true)
    })

    test('returns false for missing required fields', () => {
      expect(isIssue({})).toBe(false)
      expect(isIssue({ id: 'proj-123' })).toBe(false)
      expect(isIssue({ id: 'proj-123', title: 'Test' })).toBe(false)
      expect(isIssue(null)).toBe(false)
      expect(isIssue(undefined)).toBe(false)
      expect(isIssue('string')).toBe(false)
    })

    test('returns false for invalid field types', () => {
      const badIssue = {
        id: 123, // should be string
        title: 'Test',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }
      expect(isIssue(badIssue)).toBe(false)
    })

    test('returns false for invalid status', () => {
      const badIssue = {
        id: 'proj-123',
        title: 'Test',
        status: 'invalid_status',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }
      expect(isIssue(badIssue)).toBe(false)
    })
  })

  describe('Epic interface', () => {
    test('Epic extends Issue with type epic', () => {
      const epic: Epic = {
        id: 'proj-100',
        title: 'Big Feature',
        status: 'open',
        type: 'epic',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        children: ['proj-101', 'proj-102', 'proj-103'],
      }

      expect(epic.type).toBe('epic')
      expect(epic.children).toHaveLength(3)
    })
  })

  describe('isEpic type guard', () => {
    test('returns true for valid Epic', () => {
      const epic = {
        id: 'proj-100',
        title: 'Epic',
        status: 'open',
        type: 'epic',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        children: ['proj-101'],
      }
      expect(isEpic(epic)).toBe(true)
    })

    test('returns false for non-epic Issue', () => {
      const task = {
        id: 'proj-123',
        title: 'Task',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }
      expect(isEpic(task)).toBe(false)
    })

    test('returns false for epic without children array', () => {
      const badEpic = {
        id: 'proj-100',
        title: 'Epic',
        status: 'open',
        type: 'epic',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        // missing children
      }
      expect(isEpic(badEpic)).toBe(false)
    })
  })

  describe('Changes interface', () => {
    test('tracks field changes with from/to', () => {
      const changes: Changes = {
        status: { from: 'open', to: 'in_progress' },
        priority: { from: 3, to: 1 },
        assignee: { from: undefined, to: 'bob' },
      }

      expect(changes.status?.from).toBe('open')
      expect(changes.status?.to).toBe('in_progress')
      expect(changes.priority?.from).toBe(3)
      expect(changes.assignee?.to).toBe('bob')
    })
  })

  describe('IssueEvent interface', () => {
    test('represents JSONL event structure', () => {
      const event: IssueEvent = {
        type: 'created',
        issueId: 'proj-123',
        timestamp: new Date('2025-01-01T10:00:00Z'),
        data: {
          title: 'New issue',
          status: 'open',
          type: 'task',
          priority: 2,
        },
      }

      expect(event.type).toBe('created')
      expect(event.issueId).toBe('proj-123')
      expect(event.timestamp).toBeInstanceOf(Date)
      expect(event.data.title).toBe('New issue')
    })

    test('includes actor for audit trail', () => {
      const event: IssueEvent = {
        type: 'updated',
        issueId: 'proj-123',
        timestamp: new Date(),
        actor: 'alice',
        changes: {
          status: { from: 'open', to: 'closed' },
        },
      }

      expect(event.actor).toBe('alice')
      expect(event.changes?.status?.to).toBe('closed')
    })
  })

  describe('status validation', () => {
    test('isValidStatus returns true for valid statuses', () => {
      expect(isValidStatus('open')).toBe(true)
      expect(isValidStatus('in_progress')).toBe(true)
      expect(isValidStatus('closed')).toBe(true)
    })

    test('isValidStatus returns false for invalid statuses', () => {
      expect(isValidStatus('pending')).toBe(false)
      expect(isValidStatus('done')).toBe(false)
      expect(isValidStatus('')).toBe(false)
      expect(isValidStatus(null)).toBe(false)
    })
  })

  describe('type validation', () => {
    test('isValidType returns true for valid types', () => {
      expect(isValidType('task')).toBe(true)
      expect(isValidType('bug')).toBe(true)
      expect(isValidType('feature')).toBe(true)
      expect(isValidType('epic')).toBe(true)
    })

    test('isValidType returns false for invalid types', () => {
      expect(isValidType('story')).toBe(false)
      expect(isValidType('ticket')).toBe(false)
      expect(isValidType('')).toBe(false)
    })
  })

  describe('priority validation', () => {
    test('isValidPriority returns true for 0-4', () => {
      expect(isValidPriority(0)).toBe(true)
      expect(isValidPriority(1)).toBe(true)
      expect(isValidPriority(2)).toBe(true)
      expect(isValidPriority(3)).toBe(true)
      expect(isValidPriority(4)).toBe(true)
    })

    test('isValidPriority returns false for out of range', () => {
      expect(isValidPriority(-1)).toBe(false)
      expect(isValidPriority(5)).toBe(false)
      expect(isValidPriority(100)).toBe(false)
      expect(isValidPriority(1.5)).toBe(false)
      expect(isValidPriority(NaN)).toBe(false)
    })
  })
})
