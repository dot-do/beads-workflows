/**
 * Workflows API for tracking workflow executions
 * Reads and writes .beads/workflows.jsonl
 */

import { readFile, appendFile, access } from 'fs/promises'
import { join } from 'path'

/**
 * Workflow record types
 */
export type WorkflowType = 'issue' | 'schedule' | 'manual'
export type WorkflowStatus = 'success' | 'failed'
export type WorkflowTrigger = 'push' | 'schedule' | 'workflow_dispatch' | 'daemon'

/**
 * Base workflow record
 */
export interface WorkflowRecordBase {
  type: WorkflowType
  status: WorkflowStatus
  handler: string
  trigger: WorkflowTrigger
  commit: string
  duration: number
  triggered_at?: string
  error?: string
}

/**
 * Issue workflow record
 */
export interface IssueWorkflowRecord extends WorkflowRecordBase {
  type: 'issue'
  issue: string
  event: string
}

/**
 * Schedule workflow record
 */
export interface ScheduleWorkflowRecord extends WorkflowRecordBase {
  type: 'schedule'
  cron: string
}

/**
 * Manual workflow record
 */
export interface ManualWorkflowRecord extends WorkflowRecordBase {
  type: 'manual'
  issue?: string
  event?: string
}

/**
 * Union of all workflow record types
 */
export type WorkflowRecord = IssueWorkflowRecord | ScheduleWorkflowRecord | ManualWorkflowRecord

/**
 * Input for recording a workflow execution
 */
export type RecordInput = Omit<WorkflowRecord, 'triggered_at'>

/**
 * Filter options for listing workflows
 */
export interface ListFilter {
  issue?: string
  status?: WorkflowStatus
  type?: WorkflowType
}

/**
 * Retry info returned when marking for retry
 */
export interface RetryInfo {
  issue: string
  event: string
  handler: string
  error?: string
}

/**
 * Workflows API instance
 */
export interface WorkflowsApi {
  record(input: RecordInput): Promise<void>
  wasExecuted(issue: string, event: string): Promise<boolean>
  list(filter?: ListFilter): Promise<WorkflowRecord[]>
  listFailed(): Promise<WorkflowRecord[]>
  retry(issue: string, event: string): Promise<RetryInfo | null>
}

/**
 * Create a Workflows API instance
 */
export function Workflows(beadsDir: string): WorkflowsApi {
  const workflowsPath = join(beadsDir, 'workflows.jsonl')

  async function readRecords(): Promise<WorkflowRecord[]> {
    try {
      await access(workflowsPath)
      const content = await readFile(workflowsPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      return lines.map((line) => JSON.parse(line) as WorkflowRecord)
    } catch {
      return []
    }
  }

  return {
    async record(input: RecordInput): Promise<void> {
      const record: WorkflowRecord = {
        ...input,
        triggered_at: new Date().toISOString(),
      } as WorkflowRecord

      const line = JSON.stringify(record) + '\n'
      await appendFile(workflowsPath, line)
    },

    async wasExecuted(issue: string, event: string): Promise<boolean> {
      const records = await readRecords()

      return records.some(
        (r) =>
          r.type === 'issue' &&
          (r as IssueWorkflowRecord).issue === issue &&
          (r as IssueWorkflowRecord).event === event &&
          r.status === 'success'
      )
    },

    async list(filter?: ListFilter): Promise<WorkflowRecord[]> {
      let records = await readRecords()

      if (filter?.issue) {
        records = records.filter(
          (r) => r.type === 'issue' && (r as IssueWorkflowRecord).issue === filter.issue
        )
      }

      if (filter?.status) {
        records = records.filter((r) => r.status === filter.status)
      }

      if (filter?.type) {
        records = records.filter((r) => r.type === filter.type)
      }

      return records
    },

    async listFailed(): Promise<WorkflowRecord[]> {
      const records = await readRecords()
      return records.filter((r) => r.status === 'failed')
    },

    async retry(issue: string, event: string): Promise<RetryInfo | null> {
      const records = await readRecords()

      const failedRecord = records.find(
        (r) =>
          r.type === 'issue' &&
          (r as IssueWorkflowRecord).issue === issue &&
          (r as IssueWorkflowRecord).event === event &&
          r.status === 'failed'
      ) as IssueWorkflowRecord | undefined

      if (!failedRecord) {
        return null
      }

      return {
        issue: failedRecord.issue,
        event: failedRecord.event,
        handler: failedRecord.handler,
        error: failedRecord.error,
      }
    },
  }
}
