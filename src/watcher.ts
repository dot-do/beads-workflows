/**
 * File watcher for issues.jsonl
 * Detects changes and emits typed events
 */

import { watch } from 'fs'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { parseJsonlLine } from './reader'
import type { Issue } from './types'

/**
 * Watcher event types
 */
export type WatcherEventType = 'created' | 'updated' | 'closed' | 'reopened'

/**
 * Event emitted when an issue changes
 */
export interface WatcherEvent {
  type: WatcherEventType
  issue: Issue
  previousIssue?: Issue
}

/**
 * Watcher options
 */
export interface WatcherOptions {
  debounceMs?: number
}

/**
 * Watcher instance
 */
export interface Watcher {
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  on(event: 'issue', handler: (event: WatcherEvent) => void): void
  on(event: 'change', handler: () => void): void
  on(event: 'error', handler: (error: Error) => void): void
}

/**
 * Create a watcher for a beads directory
 */
export function createWatcher(beadsDir: string, options: WatcherOptions = {}): Watcher {
  const debounceMs = options.debounceMs ?? 100
  const jsonlPath = join(beadsDir, 'issues.jsonl')

  let fsWatcher: ReturnType<typeof watch> | null = null
  let pollInterval: ReturnType<typeof setTimeout> | null = null
  let running = false
  let lastSize = 0
  let knownIssues = new Map<string, Issue>()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastPolledSize = 0

  const issueHandlers: Array<(event: WatcherEvent) => void> = []
  const changeHandlers: Array<() => void> = []
  const errorHandlers: Array<(error: Error) => void> = []

  async function loadInitialState(): Promise<void> {
    try {
      const content = await readFile(jsonlPath, 'utf-8')
      const lines = content.split('\n')

      knownIssues.clear()
      for (const line of lines) {
        const issue = parseJsonlLine(line)
        if (issue) {
          knownIssues.set(issue.id, issue)
        }
      }

      const stats = await stat(jsonlPath)
      lastSize = stats.size
    } catch {
      // File might not exist yet
      lastSize = 0
      knownIssues.clear()
    }
  }

  async function processChanges(): Promise<void> {
    try {
      const stats = await stat(jsonlPath)
      const currentSize = stats.size

      if (currentSize <= lastSize) {
        // File was truncated or unchanged
        lastSize = currentSize
        return
      }

      // Read entire file and find new/changed issues
      const content = await readFile(jsonlPath, 'utf-8')
      const lines = content.split('\n')
      const currentIssues = new Map<string, Issue>()

      for (const line of lines) {
        const issue = parseJsonlLine(line)
        if (issue) {
          currentIssues.set(issue.id, issue)
        }
      }

      // Detect changes
      for (const [id, issue] of currentIssues) {
        const previous = knownIssues.get(id)

        if (!previous) {
          // New issue
          const event: WatcherEvent = { type: 'created', issue }
          for (const handler of issueHandlers) {
            handler(event)
          }
        } else if (previous.status !== issue.status) {
          // Status changed
          let type: WatcherEventType = 'updated'
          if (issue.status === 'closed') {
            type = 'closed'
          } else if (previous.status === 'closed') {
            // Was closed, now open/in_progress
            type = 'reopened'
          }

          const event: WatcherEvent = { type, issue, previousIssue: previous }
          for (const handler of issueHandlers) {
            handler(event)
          }
        }
      }

      // Update known state
      knownIssues = currentIssues
      lastSize = currentSize

      // Emit change event
      for (const handler of changeHandlers) {
        handler()
      }
    } catch (error) {
      for (const handler of errorHandlers) {
        handler(error as Error)
      }
    }
  }

  function debouncedProcess(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      processChanges()
    }, debounceMs)
  }

  return {
    async start(): Promise<void> {
      if (running) return

      await loadInitialState()

      // Use fs.watch for instant notifications
      try {
        fsWatcher = watch(jsonlPath, { persistent: true }, (eventType) => {
          if (eventType === 'change') {
            debouncedProcess()
          }
        })

        fsWatcher.on('error', (error) => {
          for (const handler of errorHandlers) {
            handler(error)
          }
        })
      } catch {
        // fs.watch may not be available, fall back to polling only
      }

      running = true

      // Also use polling as backup (more reliable on some platforms)
      lastPolledSize = lastSize
      const poll = async () => {
        if (!running) return
        try {
          const file = Bun.file(jsonlPath)
          const size = file.size
          // Only trigger debounce if size changed since last poll
          if (size !== lastPolledSize) {
            lastPolledSize = size
            debouncedProcess()
          }
        } catch {
          // File might not exist
        }
        if (running) {
          pollInterval = setTimeout(poll, 50)
        }
      }
      pollInterval = setTimeout(poll, 50)
    },

    async stop(): Promise<void> {
      if (!running) return

      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }

      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }

      if (fsWatcher) {
        fsWatcher.close()
        fsWatcher = null
      }

      running = false
    },

    isRunning(): boolean {
      return running
    },

    on: ((event: string, handler: unknown): void => {
      if (event === 'issue') {
        issueHandlers.push(handler as (event: WatcherEvent) => void)
      } else if (event === 'change') {
        changeHandlers.push(handler as () => void)
      } else if (event === 'error') {
        errorHandlers.push(handler as (error: Error) => void)
      }
    }) as Watcher['on'],
  }
}
