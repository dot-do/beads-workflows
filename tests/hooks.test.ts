import { describe, expect, test, beforeEach } from 'bun:test'
import { createHooks, type Hooks } from '../src/hooks'
import type { Issue, Epic, Changes } from '../src/types'

describe('hooks', () => {
  let hooks: Hooks

  beforeEach(() => {
    hooks = createHooks()
  })

  describe('fluent API structure', () => {
    test('has on.issue namespace', () => {
      expect(hooks.on.issue).toBeDefined()
    })

    test('has on.epic namespace', () => {
      expect(hooks.on.epic).toBeDefined()
    })

    test('has on.dep namespace', () => {
      expect(hooks.on.dep).toBeDefined()
    })

    test('on.issue has all event methods', () => {
      expect(typeof hooks.on.issue.created).toBe('function')
      expect(typeof hooks.on.issue.updated).toBe('function')
      expect(typeof hooks.on.issue.closed).toBe('function')
      expect(typeof hooks.on.issue.reopened).toBe('function')
      expect(typeof hooks.on.issue.started).toBe('function')
      expect(typeof hooks.on.issue.ready).toBe('function')
      expect(typeof hooks.on.issue.blocked).toBe('function')
      expect(typeof hooks.on.issue.unblocked).toBe('function')
    })

    test('on.epic has all event methods', () => {
      expect(typeof hooks.on.epic.completed).toBe('function')
      expect(typeof hooks.on.epic.progress).toBe('function')
    })

    test('on.dep has all event methods', () => {
      expect(typeof hooks.on.dep.added).toBe('function')
      expect(typeof hooks.on.dep.removed).toBe('function')
    })
  })

  describe('registering handlers', () => {
    test('registers issue.created handler', () => {
      let called = false
      hooks.on.issue.created(() => { called = true })

      hooks.emit('issue.created', mockIssue())

      expect(called).toBe(true)
    })

    test('registers issue.closed handler', () => {
      let receivedIssue: Issue | null = null
      hooks.on.issue.closed((issue) => { receivedIssue = issue })

      const issue = mockIssue({ status: 'closed' })
      hooks.emit('issue.closed', issue)

      expect(receivedIssue).not.toBeNull()
      expect(receivedIssue!.id).toBe(issue.id)
    })

    test('registers issue.ready handler', () => {
      let readyIssueId: string | null = null
      hooks.on.issue.ready((issue) => { readyIssueId = issue.id })

      const issue = mockIssue({ id: 'ready-123' })
      hooks.emit('issue.ready', issue)

      expect(readyIssueId).toBe('ready-123')
    })

    test('registers multiple handlers for same event', () => {
      let count = 0
      hooks.on.issue.created(() => { count++ })
      hooks.on.issue.created(() => { count++ })
      hooks.on.issue.created(() => { count++ })

      hooks.emit('issue.created', mockIssue())

      expect(count).toBe(3)
    })

    test('handlers receive correct issue data', () => {
      let received: Issue | null = null
      hooks.on.issue.updated((issue) => { received = issue })

      const issue = mockIssue({
        id: 'test-456',
        title: 'Updated title',
        priority: 0,
      })
      hooks.emit('issue.updated', issue)

      expect(received!.id).toBe('test-456')
      expect(received!.title).toBe('Updated title')
      expect(received!.priority).toBe(0)
    })
  })

  describe('epic events', () => {
    test('epic.completed receives epic and children', () => {
      let receivedEpic: Epic | null = null
      let receivedChildren: Issue[] | null = null

      hooks.on.epic.completed((epic, children) => {
        receivedEpic = epic
        receivedChildren = children
      })

      const epic = mockEpic({ children: ['child-1', 'child-2'] })
      const children = [mockIssue({ id: 'child-1' }), mockIssue({ id: 'child-2' })]

      hooks.emit('epic.completed', epic, children)

      expect(receivedEpic!.id).toBe(epic.id)
      expect(receivedChildren).toHaveLength(2)
    })

    test('epic.progress receives epic and progress', () => {
      let progress: { total: number; closed: number } | null = null

      hooks.on.epic.progress((epic, p) => {
        progress = p
      })

      const epic = mockEpic()
      hooks.emit('epic.progress', epic, { total: 5, closed: 3 })

      expect(progress!.total).toBe(5)
      expect(progress!.closed).toBe(3)
    })
  })

  describe('dependency events', () => {
    test('dep.added receives issue and dependency', () => {
      let issueId: string | null = null
      let depId: string | null = null

      hooks.on.dep.added((issue, dependency) => {
        issueId = issue.id
        depId = dependency.id
      })

      const issue = mockIssue({ id: 'blocked-issue' })
      const dep = mockIssue({ id: 'blocker-issue' })

      hooks.emit('dep.added', issue, dep)

      expect(issueId).toBe('blocked-issue')
      expect(depId).toBe('blocker-issue')
    })

    test('dep.removed receives issue and dependency', () => {
      let received = false

      hooks.on.dep.removed(() => { received = true })

      hooks.emit('dep.removed', mockIssue(), mockIssue())

      expect(received).toBe(true)
    })
  })

  describe('async handlers', () => {
    test('supports async handlers', async () => {
      let resolved = false

      hooks.on.issue.created(async () => {
        await new Promise(r => setTimeout(r, 10))
        resolved = true
      })

      await hooks.emitAsync('issue.created', mockIssue())

      expect(resolved).toBe(true)
    })
  })

  describe('unsubscribe', () => {
    test('returns unsubscribe function', () => {
      let count = 0
      const unsub = hooks.on.issue.created(() => { count++ })

      hooks.emit('issue.created', mockIssue())
      expect(count).toBe(1)

      unsub()

      hooks.emit('issue.created', mockIssue())
      expect(count).toBe(1) // Still 1, handler unsubscribed
    })
  })
})

// Helper to create mock issues
function mockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'test-issue',
    title: 'Test Issue',
    status: 'open',
    type: 'task',
    priority: 2,
    created: new Date(),
    updated: new Date(),
    dependsOn: [],
    blocks: [],
    ...overrides,
  }
}

function mockEpic(overrides: Partial<Epic> = {}): Epic {
  return {
    id: 'test-epic',
    title: 'Test Epic',
    status: 'open',
    type: 'epic',
    priority: 1,
    created: new Date(),
    updated: new Date(),
    dependsOn: [],
    blocks: [],
    children: [],
    ...overrides,
  }
}
