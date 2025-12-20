/**
 * Handler scanner for .beads/on.*.ts and every.*.ts files
 * Scans for convention-based event and schedule handlers
 */

import { readdir } from 'fs/promises'
import { join } from 'path'

/**
 * Schedule name to cron expression mapping
 */
const SCHEDULE_CRONS: Record<string, string> = {
  hour: '0 * * * *',
  day: '0 0 * * *',
  week: '0 0 * * 0',
}

/**
 * Schedule name to event name mapping
 */
const SCHEDULE_EVENTS: Record<string, string> = {
  hour: 'schedule.hourly',
  day: 'schedule.daily',
  week: 'schedule.weekly',
}

/**
 * Handler info returned by scanner
 */
export interface HandlerInfo {
  event: string
  path: string
  filename: string
  cron?: string
}

/**
 * Scanner instance
 */
export interface Scanner {
  scan(): Promise<HandlerInfo[]>
  getHandlers(): Map<string, HandlerInfo>
  getScheduleHandlers(): HandlerInfo[]
}

/**
 * Create a handler scanner for a beads directory
 */
export function createScanner(beadsDir: string): Scanner {
  const handlers = new Map<string, HandlerInfo>()
  const scheduleHandlers: HandlerInfo[] = []

  return {
    async scan(): Promise<HandlerInfo[]> {
      handlers.clear()
      scheduleHandlers.length = 0

      try {
        const files = await readdir(beadsDir)

        for (const file of files) {
          // Match on.*.ts or on.*.js (event handlers)
          const eventMatch = file.match(/^on\.(.+)\.(ts|js)$/)
          if (eventMatch) {
            const eventName = eventMatch[1]
            const info: HandlerInfo = {
              event: eventName,
              path: join(beadsDir, file),
              filename: file,
            }
            handlers.set(eventName, info)
            continue
          }

          // Match every.*.ts or every.*.js (schedule handlers)
          const scheduleMatch = file.match(/^every\.(.+)\.(ts|js)$/)
          if (scheduleMatch) {
            const scheduleName = scheduleMatch[1]
            const cron = SCHEDULE_CRONS[scheduleName]
            const event = SCHEDULE_EVENTS[scheduleName]

            if (cron && event) {
              const info: HandlerInfo = {
                event,
                path: join(beadsDir, file),
                filename: file,
                cron,
              }
              handlers.set(event, info)
              scheduleHandlers.push(info)
            }
          }
        }
      } catch {
        // Directory might not exist
      }

      return Array.from(handlers.values())
    },

    getHandlers(): Map<string, HandlerInfo> {
      return new Map(handlers)
    },

    getScheduleHandlers(): HandlerInfo[] {
      return [...scheduleHandlers]
    },
  }
}
