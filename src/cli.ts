/**
 * CLI daemon for beads-workflows
 * Watches for changes and executes handlers
 */

import { createWatcher, type WatcherEvent } from './watcher'
import { createScanner, type HandlerInfo } from './scanner'
import { createRuntime, type HandlerFn } from './runtime'
import { Workflows } from './workflows'
import type { Issue } from './types'

/**
 * CLI options
 */
export interface DaemonOptions {
  path: string
  verbose?: boolean
  once?: boolean
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
 * Parsed command
 */
export interface Command {
  command: 'run' | 'list' | 'retry'
  once?: boolean
  failed?: boolean
  issue?: string
  event?: string
  allFailed?: boolean
}

/**
 * Parse command from arguments
 */
export function parseCommand(args: string[]): Command {
  const cmd: Command = { command: 'run' }

  if (args.length === 0) {
    return cmd
  }

  const firstArg = args[0]

  if (firstArg === 'list') {
    cmd.command = 'list'
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--failed') {
        cmd.failed = true
      } else if (args[i] === '--issue') {
        cmd.issue = args[++i]
      }
    }
  } else if (firstArg === 'retry') {
    cmd.command = 'retry'
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--all-failed') {
        cmd.allFailed = true
      } else if (!args[i].startsWith('-')) {
        if (!cmd.issue) {
          cmd.issue = args[i]
        } else if (!cmd.event) {
          cmd.event = args[i]
        }
      }
    }
  } else if (firstArg === 'run' || !firstArg.startsWith('-')) {
    cmd.command = 'run'
    const startIdx = firstArg === 'run' ? 1 : 0
    for (let i = startIdx; i < args.length; i++) {
      if (args[i] === '--once') {
        cmd.once = true
      }
    }
  } else {
    // Handle flags for default run command
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--once') {
        cmd.once = true
      }
    }
  }

  return cmd
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
  const { path: beadsDir, verbose, once, onHandlerExecuted } = options

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

      if (once) {
        // In once mode, just process current state and exit
        // No need to start watcher
        running = false
        return
      }

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
  const command = parseCommand(args)

  const beadsDir = options.path || process.cwd() + '/.beads'

  if (command.command === 'list') {
    const workflows = Workflows(beadsDir)
    const records = command.failed
      ? await workflows.listFailed()
      : await workflows.list(command.issue ? { issue: command.issue } : undefined)

    if (records.length === 0) {
      console.log('No workflow executions found.')
    } else {
      for (const record of records) {
        const status = record.status === 'success' ? '✓' : '✗'
        if (record.type === 'issue') {
          console.log(`${status} ${record.triggered_at} ${record.issue} ${record.event} (${record.handler})`)
        } else if (record.type === 'schedule') {
          console.log(`${status} ${record.triggered_at} schedule ${record.cron} (${record.handler})`)
        }
      }
    }
    return
  }

  if (command.command === 'retry') {
    const workflows = Workflows(beadsDir)

    if (command.allFailed) {
      const failed = await workflows.listFailed()
      console.log(`Found ${failed.length} failed executions to retry.`)
      // TODO: implement actual retry logic
    } else if (command.issue && command.event) {
      const retryInfo = await workflows.retry(command.issue, command.event)
      if (retryInfo) {
        console.log(`Retrying ${retryInfo.issue} ${retryInfo.event}...`)
        // TODO: implement actual retry logic
      } else {
        console.log(`No failed execution found for ${command.issue} ${command.event}`)
      }
    } else {
      console.log('Usage: beads-workflows retry <issue> <event>')
      console.log('       beads-workflows retry --all-failed')
    }
    return
  }

  // Default: run command
  console.log('beads-workflows daemon')
  console.log(`Watching: ${beadsDir}`)

  const daemon = createDaemon({
    path: beadsDir,
    verbose: options.verbose,
    once: command.once,
  })

  if (command.once) {
    await daemon.start()
    console.log('Single pass complete.')
    return
  }

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
