import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import {
  every,
  getScheduledHandlers,
  clearScheduledHandlers,
  type ScheduleHandler,
  type ScheduleContext,
} from '../src/schedule'

const TEST_DIR = '/tmp/beads-schedule-test'
const BEADS_DIR = join(TEST_DIR, '.beads')

describe('schedule', () => {
  beforeEach(async () => {
    await mkdir(BEADS_DIR, { recursive: true })
    clearScheduledHandlers()
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
    clearScheduledHandlers()
  })

  describe('every', () => {
    test('registers a handler for a cron expression', () => {
      const handler: ScheduleHandler = async () => {}

      every('0 * * * *', handler)

      const handlers = getScheduledHandlers()
      expect(handlers.length).toBe(1)
      expect(handlers[0].cron).toBe('0 * * * *')
    })

    test('registers multiple handlers', () => {
      every('0 * * * *', async () => {})
      every('0 0 * * *', async () => {})
      every('0 0 * * 0', async () => {})

      const handlers = getScheduledHandlers()
      expect(handlers.length).toBe(3)
    })

    test('can register multiple handlers for same cron', () => {
      every('0 * * * *', async () => console.log('first'))
      every('0 * * * *', async () => console.log('second'))

      const handlers = getScheduledHandlers()
      expect(handlers.length).toBe(2)
      expect(handlers[0].cron).toBe('0 * * * *')
      expect(handlers[1].cron).toBe('0 * * * *')
    })
  })

  describe('getScheduledHandlers', () => {
    test('returns empty array when no handlers registered', () => {
      const handlers = getScheduledHandlers()
      expect(handlers).toEqual([])
    })

    test('returns copy of handlers array', () => {
      every('0 * * * *', async () => {})

      const handlers1 = getScheduledHandlers()
      const handlers2 = getScheduledHandlers()

      expect(handlers1).not.toBe(handlers2)
      expect(handlers1).toEqual(handlers2)
    })
  })

  describe('clearScheduledHandlers', () => {
    test('removes all registered handlers', () => {
      every('0 * * * *', async () => {})
      every('0 0 * * *', async () => {})

      clearScheduledHandlers()

      const handlers = getScheduledHandlers()
      expect(handlers).toEqual([])
    })
  })

  describe('handler execution', () => {
    test('handler receives context with cron', async () => {
      let receivedCron: string | undefined

      every('0 * * * *', async (ctx) => {
        receivedCron = ctx.cron
      })

      const handlers = getScheduledHandlers()
      const mockContext: ScheduleContext = {
        cron: '0 * * * *',
        triggeredAt: new Date(),
        issues: {} as any,
        epics: {} as any,
      }

      await handlers[0].handler(mockContext)

      expect(receivedCron).toBe('0 * * * *')
    })

    test('handler receives context with triggeredAt', async () => {
      let receivedDate: Date | undefined

      every('0 * * * *', async (ctx) => {
        receivedDate = ctx.triggeredAt
      })

      const handlers = getScheduledHandlers()
      const now = new Date()
      const mockContext: ScheduleContext = {
        cron: '0 * * * *',
        triggeredAt: now,
        issues: {} as any,
        epics: {} as any,
      }

      await handlers[0].handler(mockContext)

      expect(receivedDate).toBe(now)
    })
  })

  describe('cron matching', () => {
    test('getScheduledHandlers filters by cron when provided', () => {
      every('0 * * * *', async () => {})
      every('0 0 * * *', async () => {})
      every('0 * * * *', async () => {})

      const hourlyHandlers = getScheduledHandlers('0 * * * *')
      expect(hourlyHandlers.length).toBe(2)

      const dailyHandlers = getScheduledHandlers('0 0 * * *')
      expect(dailyHandlers.length).toBe(1)
    })
  })
})
