/**
 * bd CLI wrapper for mutations
 * Ensures consistency with daemon sync and race condition safety
 */

import type { IssueType, IssueStatus, Priority } from './types'

/**
 * Options for creating an issue
 */
export interface CreateOptions {
  title: string
  type: IssueType
  priority: Priority
  description?: string
  assignee?: string
  labels?: string[]
}

/**
 * Options for updating an issue
 */
export interface UpdateOptions {
  status?: IssueStatus
  priority?: Priority
  assignee?: string
  title?: string
  description?: string
  labels?: string[]
}

/**
 * Result from bd command execution
 */
export interface CommandResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/**
 * Build arguments for bd create command
 */
export function buildCreateCommand(options: CreateOptions): string[] {
  const args = ['create', '--json']

  args.push(`--title=${options.title}`)
  args.push(`--type=${options.type}`)
  args.push(`--priority=${options.priority}`)

  if (options.description) {
    args.push(`--description=${options.description}`)
  }

  if (options.assignee) {
    args.push(`--assignee=${options.assignee}`)
  }

  return args
}

/**
 * Build arguments for bd update command
 */
export function buildUpdateCommand(issueId: string, options: UpdateOptions): string[] {
  const args = ['update', issueId, '--json']

  if (options.status) {
    args.push(`--status=${options.status}`)
  }

  if (options.priority !== undefined) {
    args.push(`--priority=${options.priority}`)
  }

  if (options.assignee) {
    args.push(`--assignee=${options.assignee}`)
  }

  if (options.title) {
    args.push(`--title=${options.title}`)
  }

  if (options.description) {
    args.push(`--description=${options.description}`)
  }

  return args
}

/**
 * Build arguments for bd close command
 */
export function buildCloseCommand(issueId: string, reason?: string): string[] {
  const args = ['close', issueId, '--json']

  if (reason) {
    args.push(`--reason=${reason}`)
  }

  return args
}

/**
 * Parse JSON output from bd command
 */
export function parseJsonOutput(output: string): CommandResult {
  const trimmed = output.trim()

  if (!trimmed) {
    return { success: false, error: 'Empty output' }
  }

  // bd may output status message before JSON
  // Look for JSON starting with { or [
  const lines = trimmed.split('\n')
  let jsonLine: string | undefined

  for (const line of lines) {
    const l = line.trim()
    if (l.startsWith('{') || l.startsWith('[')) {
      jsonLine = l
      break
    }
  }

  if (!jsonLine) {
    return { success: false, error: `Failed to parse: ${trimmed.slice(0, 100)}` }
  }

  try {
    const data = JSON.parse(jsonLine)
    return { success: true, data }
  } catch {
    return { success: false, error: `Failed to parse: ${jsonLine.slice(0, 100)}` }
  }
}

/**
 * Execute a bd command
 */
export async function execBd(
  args: string[],
  options: { cwd?: string } = {}
): Promise<CommandResult> {
  const proc = Bun.spawn(['bd', ...args], {
    cwd: options.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    return {
      success: false,
      error: stderr || stdout || `Exit code: ${exitCode}`,
    }
  }

  return parseJsonOutput(stdout)
}

/**
 * Create a new issue
 */
export async function createIssue(
  options: CreateOptions,
  execOptions: { cwd?: string } = {}
): Promise<CommandResult> {
  const args = buildCreateCommand(options)
  return execBd(args, execOptions)
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  issueId: string,
  options: UpdateOptions,
  execOptions: { cwd?: string } = {}
): Promise<CommandResult> {
  const args = buildUpdateCommand(issueId, options)
  return execBd(args, execOptions)
}

/**
 * Close an issue
 */
export async function closeIssue(
  issueId: string,
  reason?: string,
  execOptions: { cwd?: string } = {}
): Promise<CommandResult> {
  const args = buildCloseCommand(issueId, reason)
  return execBd(args, execOptions)
}
