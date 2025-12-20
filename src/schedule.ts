/**
 * Schedule API for registering cron-based handlers
 * Used with every() function and every.*.ts files
 */

import type { IssuesApi } from './issues'
import type { EpicsApi } from './epics'

/**
 * Context passed to schedule handlers
 */
export interface ScheduleContext {
  cron: string
  triggeredAt: Date
  issues: IssuesApi
  epics: EpicsApi
}

/**
 * Schedule handler function type
 */
export type ScheduleHandler = (context: ScheduleContext) => Promise<void> | void

/**
 * Registered schedule handler with its cron expression
 */
export interface RegisteredHandler {
  cron: string
  handler: ScheduleHandler
}

/**
 * Internal registry of scheduled handlers
 */
let scheduledHandlers: RegisteredHandler[] = []

/**
 * Register a handler for a cron expression
 *
 * @example
 * ```typescript
 * import { every } from 'beads-workflows'
 *
 * every('0 * * * *', async ({ issues, epics }) => {
 *   // Runs hourly
 *   const ready = await issues.ready()
 *   console.log(`${ready.length} issues ready`)
 * })
 *
 * every('0 9 * * 1-5', async ({ issues }) => {
 *   // Runs at 9am on weekdays
 * })
 * ```
 */
export function every(cron: string, handler: ScheduleHandler): void {
  scheduledHandlers.push({ cron, handler })
}

/**
 * Get all registered schedule handlers
 * Optionally filter by cron expression
 */
export function getScheduledHandlers(cron?: string): RegisteredHandler[] {
  if (cron) {
    return [...scheduledHandlers.filter((h) => h.cron === cron)]
  }
  return [...scheduledHandlers]
}

/**
 * Clear all registered handlers (used for testing)
 */
export function clearScheduledHandlers(): void {
  scheduledHandlers = []
}

/**
 * Common cron expressions mapped to friendly names
 */
export const CRON_PRESETS = {
  hourly: '0 * * * *',
  daily: '0 0 * * *',
  weekly: '0 0 * * 0',
} as const

/**
 * Get the friendly name for a cron expression (if known)
 */
export function getCronName(cron: string): string | undefined {
  for (const [name, expression] of Object.entries(CRON_PRESETS)) {
    if (expression === cron) {
      return name
    }
  }
  return undefined
}

/**
 * Get the cron expression for a friendly name
 */
export function getCronExpression(name: keyof typeof CRON_PRESETS): string {
  return CRON_PRESETS[name]
}
