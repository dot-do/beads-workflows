/**
 * Handler runtime for executing workflow handlers
 * Provides context injection and error handling
 */

import type { Issue, Epic } from './types'
import { createIssuesApi, type IssuesApi } from './issues'
import { createEpicsApi, type EpicsApi } from './epics'

/**
 * Handler context passed to handlers
 */
export interface HandlerContext {
  issue: Issue
  previousIssue?: Issue
  epic?: Epic
  issues: IssuesApi
  epics: EpicsApi
  event: string
}

/**
 * Globals exposed to handlers
 */
export interface HandlerGlobals {
  issue: Issue
  previousIssue?: Issue
  epic?: Epic
  issues: IssuesApi
  epics: EpicsApi
}

/**
 * Context created for handler execution
 */
export interface ExecutionContext {
  globals: HandlerGlobals
  event: string
}

/**
 * Handler function type
 */
export type HandlerFn = (context: HandlerContext) => Promise<void> | void

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean
  error?: string
  duration?: number
}

/**
 * Event data passed to handlers
 */
export interface EventData {
  issue?: Issue
  previousIssue?: Issue
  epic?: Epic
}

/**
 * Runtime instance
 */
export interface Runtime {
  createContext(event: string, data: EventData): Promise<ExecutionContext>
  execute(event: string, handler: HandlerFn, data: EventData): Promise<ExecutionResult>
}

/**
 * Create a runtime for a beads directory
 */
export function createRuntime(beadsDir: string): Runtime {
  const issuesApi = createIssuesApi(beadsDir)
  const epicsApi = createEpicsApi(beadsDir)

  return {
    async createContext(event: string, data: EventData): Promise<ExecutionContext> {
      const globals: HandlerGlobals = {
        issue: data.issue!,
        previousIssue: data.previousIssue,
        epic: data.epic,
        issues: issuesApi,
        epics: epicsApi,
      }

      return {
        globals,
        event,
      }
    },

    async execute(
      event: string,
      handler: HandlerFn,
      data: EventData
    ): Promise<ExecutionResult> {
      const start = Date.now()

      try {
        const context: HandlerContext = {
          issue: data.issue!,
          previousIssue: data.previousIssue,
          epic: data.epic,
          issues: issuesApi,
          epics: epicsApi,
          event,
        }

        await handler(context)

        return {
          success: true,
          duration: Date.now() - start,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - start,
        }
      }
    },
  }
}
