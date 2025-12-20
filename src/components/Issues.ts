/**
 * Issues components - render issue data as markdown tables
 */

import { readIssuesFromJsonl, findBeadsDir } from '../reader.js'
import type { Issue, IssueStatus, IssueType, Priority } from '../types.js'

export interface IssueProps {
  id: string
}

export interface IssuesReadyProps {
  limit?: number
  priority?: string
  assignee?: string
}

export interface IssuesBlockedProps {
  limit?: number
}

export interface IssuesListProps {
  status?: IssueStatus | 'all'
  type?: IssueType
  priority?: string
  assignee?: string
  limit?: number
}

function formatPriority(p: Priority): string {
  return `P${p}`
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function renderTable(issues: Issue[], title: string): string {
  if (issues.length === 0) {
    return `### ${title}\n\n_No issues found_\n`
  }

  const lines: string[] = [
    `### ${title}\n`,
    '| ID | Priority | Type | Title | Updated |',
    '|:---|:---------|:-----|:------|:--------|',
  ]

  for (const issue of issues) {
    const row = [
      `\`${issue.id}\``,
      formatPriority(issue.priority),
      issue.type,
      issue.title.slice(0, 50) + (issue.title.length > 50 ? '...' : ''),
      formatRelativeTime(issue.updated),
    ]
    lines.push(`| ${row.join(' | ')} |`)
  }

  lines.push('')
  return lines.join('\n')
}

function parsePriorityFilter(filter: string): Priority[] {
  return filter
    .split(',')
    .map(p => p.trim().replace(/^P/i, ''))
    .map(p => parseInt(p, 10))
    .filter(p => !isNaN(p) && p >= 0 && p <= 4) as Priority[]
}

async function loadIssues(): Promise<Issue[]> {
  const beadsDir = await findBeadsDir(process.cwd())
  if (!beadsDir) return []

  try {
    return await readIssuesFromJsonl(beadsDir)
  } catch {
    return []
  }
}

async function Ready(props: IssuesReadyProps = {}): Promise<string> {
  const { limit = 10, priority, assignee } = props

  const allIssues = await loadIssues()

  let ready = allIssues.filter(issue => {
    if (issue.status !== 'open') return false

    for (const depId of issue.dependsOn) {
      const dep = allIssues.find(i => i.id === depId)
      if (dep && dep.status !== 'closed') {
        return false
      }
    }

    return true
  })

  if (priority) {
    const priorities = parsePriorityFilter(priority)
    ready = ready.filter(i => priorities.includes(i.priority))
  }

  if (assignee) {
    ready = ready.filter(i => i.assignee === assignee)
  }

  ready.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.updated.getTime() - a.updated.getTime()
  })

  ready = ready.slice(0, limit)

  return renderTable(ready, 'Ready to Work')
}

async function Blocked(props: IssuesBlockedProps = {}): Promise<string> {
  const { limit = 10 } = props

  const allIssues = await loadIssues()

  let blocked = allIssues.filter(issue => {
    if (issue.status !== 'open') return false

    for (const depId of issue.dependsOn) {
      const dep = allIssues.find(i => i.id === depId)
      if (dep && dep.status !== 'closed') {
        return true
      }
    }

    return false
  })

  blocked.sort((a, b) => a.priority - b.priority)
  blocked = blocked.slice(0, limit)

  if (blocked.length === 0) {
    return ''
  }

  const lines: string[] = [
    '### Blocked Issues\n',
    '| ID | Priority | Title | Blocked By |',
    '|:---|:---------|:------|:-----------|',
  ]

  for (const issue of blocked) {
    const openBlockers = issue.dependsOn
      .filter(depId => {
        const dep = allIssues.find(i => i.id === depId)
        return dep && dep.status !== 'closed'
      })
      .map(id => `\`${id}\``)
      .join(', ')

    const row = [
      `\`${issue.id}\``,
      formatPriority(issue.priority),
      issue.title.slice(0, 40) + (issue.title.length > 40 ? '...' : ''),
      openBlockers,
    ]
    lines.push(`| ${row.join(' | ')} |`)
  }

  lines.push('')
  return lines.join('\n')
}

async function List(props: IssuesListProps = {}): Promise<string> {
  const { status = 'open', type, priority, assignee, limit = 20 } = props

  let issues = await loadIssues()

  if (status !== 'all') {
    issues = issues.filter(i => i.status === status)
  }

  if (type) {
    issues = issues.filter(i => i.type === type)
  }

  if (priority) {
    const priorities = parsePriorityFilter(priority)
    issues = issues.filter(i => priorities.includes(i.priority))
  }

  if (assignee) {
    issues = issues.filter(i => i.assignee === assignee)
  }

  issues.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.updated.getTime() - a.updated.getTime()
  })

  issues = issues.slice(0, limit)

  const title = status === 'all' ? 'All Issues' : `Issues (${status})`
  return renderTable(issues, title)
}

/**
 * Single issue by ID
 */
export async function Issue(props: IssueProps): Promise<string> {
  const { id } = props

  const allIssues = await loadIssues()
  const issue = allIssues.find(i => i.id === id)

  if (!issue) {
    return `> Issue \`${id}\` not found\n`
  }

  const lines: string[] = [
    `### ${issue.title}`,
    '',
    `**ID:** \`${issue.id}\` · **Status:** ${issue.status} · **Priority:** P${issue.priority} · **Type:** ${issue.type}`,
    '',
  ]

  if (issue.description) {
    lines.push(issue.description)
    lines.push('')
  }

  if (issue.assignee) {
    lines.push(`**Assignee:** ${issue.assignee}`)
  }

  if (issue.dependsOn.length > 0) {
    const deps = issue.dependsOn.map(d => `\`${d}\``).join(', ')
    lines.push(`**Depends on:** ${deps}`)
  }

  if (issue.blocks.length > 0) {
    const blocks = issue.blocks.map(b => `\`${b}\``).join(', ')
    lines.push(`**Blocks:** ${blocks}`)
  }

  lines.push('')
  return lines.join('\n')
}

// Default Issues function (was List)
export async function Issues(props: IssuesListProps = {}): Promise<string> {
  return List(props)
}

// Attach sub-components as properties
Issues.Ready = Ready
Issues.Blocked = Blocked
