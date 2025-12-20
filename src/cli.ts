/**
 * CLI daemon for beads-workflows
 * Watches for changes and executes handlers
 */

import { createWatcher, type WatcherEvent } from './watcher'
import { createScanner, type HandlerInfo } from './scanner'
import { createRuntime, type HandlerFn } from './runtime'
import type { Issue } from './types'

/**
 * CLI options
 */
export interface DaemonOptions {
  path: string
  verbose?: boolean
  onHandlerExecuted?: (event: string, result: { success: boolean }) => void
}

/**
 * Daemon instance
 */
export interface Daemon {
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getHandlerCount(): number
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): { path?: string; verbose: boolean } {
  const result: { path?: string; verbose: boolean } = { verbose: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--path' || arg === '-p') {
      result.path = args[++i]
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true
    }
  }

  return result
}

/**
 * Create a workflow daemon
 */
export function createDaemon(options: DaemonOptions): Daemon {
  const { path: beadsDir, verbose, onHandlerExecuted } = options

  let running = false
  let handlers: Map<string, HandlerInfo> = new Map()
  let loadedHandlers: Map<string, HandlerFn> = new Map()

  const watcher = createWatcher(beadsDir)
  const scanner = createScanner(beadsDir)
  const runtime = createRuntime(beadsDir)

  async function loadHandlers(): Promise<void> {
    const handlerInfos = await scanner.scan()
    handlers = scanner.getHandlers()
    loadedHandlers.clear()

    for (const info of handlerInfos) {
      try {
        const module = await import(info.path)
        if (typeof module.default === 'function') {
          loadedHandlers.set(info.event, module.default)
          if (verbose) {
            console.log(`Loaded handler: ${info.event}`)
          }
        }
      } catch (error) {
        console.error(`Failed to load handler ${info.path}:`, error)
      }
    }
  }

  async function handleIssueEvent(event: WatcherEvent): Promise<void> {
    const eventName = `issue.${event.type}`
    const handler = loadedHandlers.get(eventName)

    if (handler) {
      if (verbose) {
        console.log(`Executing handler for ${eventName}:`, event.issue.id)
      }

      const result = await runtime.execute(eventName, handler, {
        issue: event.issue,
        previousIssue: event.previousIssue,
      })

      if (onHandlerExecuted) {
        onHandlerExecuted(eventName, result)
      }

      if (!result.success && verbose) {
        console.error(`Handler error for ${eventName}:`, result.error)
      }
    }
  }

  watcher.on('issue', handleIssueEvent)

  watcher.on('error', (error) => {
    console.error('Watcher error:', error)
  })

  return {
    async start(): Promise<void> {
      if (running) return

      await loadHandlers()
      await watcher.start()
      running = true

      if (verbose) {
        console.log(`Daemon started, watching ${beadsDir}`)
        console.log(`Loaded ${loadedHandlers.size} handler(s)`)
      }
    },

    async stop(): Promise<void> {
      if (!running) return

      await watcher.stop()
      running = false

      if (verbose) {
        console.log('Daemon stopped')
      }
    },

    isRunning(): boolean {
      return running
    },

    getHandlerCount(): number {
      return handlers.size
    },
  }
}

/**
 * Main CLI entry point
 */
export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args)

  const beadsDir = options.path || process.cwd() + '/.beads'

  console.log('beads-workflows daemon')
  console.log(`Watching: ${beadsDir}`)

  const daemon = createDaemon({
    path: beadsDir,
    verbose: options.verbose,
  })

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await daemon.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await daemon.stop()
    process.exit(0)
  })

  await daemon.start()

  console.log('Daemon running. Press Ctrl+C to stop.')
}
