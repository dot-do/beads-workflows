/**
 * Handler scanner for .beads/on.*.ts files
 * Scans for convention-based event handlers
 */

import { readdir } from 'fs/promises'
import { join, basename } from 'path'

/**
 * Handler info returned by scanner
 */
export interface HandlerInfo {
  event: string
  path: string
  filename: string
}

/**
 * Scanner instance
 */
export interface Scanner {
  scan(): Promise<HandlerInfo[]>
  getHandlers(): Map<string, HandlerInfo>
}

/**
 * Create a handler scanner for a beads directory
 */
export function createScanner(beadsDir: string): Scanner {
  const handlers = new Map<string, HandlerInfo>()

  return {
    async scan(): Promise<HandlerInfo[]> {
      handlers.clear()

      try {
        const files = await readdir(beadsDir)

        for (const file of files) {
          // Match on.*.ts or on.*.js
          const match = file.match(/^on\.(.+)\.(ts|js)$/)
          if (match) {
            const eventName = match[1]
            const info: HandlerInfo = {
              event: eventName,
              path: join(beadsDir, file),
              filename: file,
            }
            handlers.set(eventName, info)
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
  }
}
