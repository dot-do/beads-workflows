/**
 * Fluent event hooks API for beads-workflows
 * Provides on.issue.ready(), on.epic.completed(), etc.
 */

import type { Issue, Epic, Changes } from './types'

type Handler<T extends unknown[]> = (...args: T) => void | Promise<void>
type Unsubscribe = () => void

/**
 * Event registry for storing handlers
 */
class EventRegistry {
  private handlers = new Map<string, Set<Handler<unknown[]>>>()

  register<T extends unknown[]>(event: string, handler: Handler<T>): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler as Handler<unknown[]>)

    return () => {
      this.handlers.get(event)?.delete(handler as Handler<unknown[]>)
    }
  }

  emit<T extends unknown[]>(event: string, ...args: T): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }

  async emitAsync<T extends unknown[]>(event: string, ...args: T): Promise<void> {
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        await handler(...args)
      }
    }
  }
}

/**
 * Issue event handlers
 */
interface IssueHooks {
  created(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
  updated(handler: (issue: Issue, changes?: Changes) => void | Promise<void>): Unsubscribe
  closed(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
  reopened(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
  started(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
  ready(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
  blocked(handler: (issue: Issue, blocker: Issue) => void | Promise<void>): Unsubscribe
  unblocked(handler: (issue: Issue) => void | Promise<void>): Unsubscribe
}

/**
 * Epic event handlers
 */
interface EpicHooks {
  completed(handler: (epic: Epic, children: Issue[]) => void | Promise<void>): Unsubscribe
  progress(handler: (epic: Epic, progress: { total: number; closed: number }) => void | Promise<void>): Unsubscribe
}

/**
 * Dependency event handlers
 */
interface DepHooks {
  added(handler: (issue: Issue, dependency: Issue) => void | Promise<void>): Unsubscribe
  removed(handler: (issue: Issue, dependency: Issue) => void | Promise<void>): Unsubscribe
}

/**
 * Root hooks object with fluent API
 */
export interface Hooks {
  on: {
    issue: IssueHooks
    epic: EpicHooks
    dep: DepHooks
  }
  emit: <T extends unknown[]>(event: string, ...args: T) => void
  emitAsync: <T extends unknown[]>(event: string, ...args: T) => Promise<void>
}

/**
 * Create a new hooks instance
 */
export function createHooks(): Hooks {
  const registry = new EventRegistry()

  const issueHooks: IssueHooks = {
    created: (handler) => registry.register('issue.created', handler),
    updated: (handler) => registry.register('issue.updated', handler),
    closed: (handler) => registry.register('issue.closed', handler),
    reopened: (handler) => registry.register('issue.reopened', handler),
    started: (handler) => registry.register('issue.started', handler),
    ready: (handler) => registry.register('issue.ready', handler),
    blocked: (handler) => registry.register('issue.blocked', handler),
    unblocked: (handler) => registry.register('issue.unblocked', handler),
  }

  const epicHooks: EpicHooks = {
    completed: (handler) => registry.register('epic.completed', handler),
    progress: (handler) => registry.register('epic.progress', handler),
  }

  const depHooks: DepHooks = {
    added: (handler) => registry.register('dep.added', handler),
    removed: (handler) => registry.register('dep.removed', handler),
  }

  return {
    on: {
      issue: issueHooks,
      epic: epicHooks,
      dep: depHooks,
    },
    emit: (event, ...args) => registry.emit(event, ...args),
    emitAsync: (event, ...args) => registry.emitAsync(event, ...args),
  }
}
