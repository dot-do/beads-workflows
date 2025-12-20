/**
 * Epic components - render epic progress and children as markdown
 */

import { readIssuesFromJsonl, findBeadsDir } from '../reader.js'
import type { Issue, Epic as EpicType } from '../types.js'

export interface EpicProgressProps {
  id?: string
  all?: boolean
}

export interface EpicChildrenProps {
  id: string
  limit?: number
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

function renderProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
}

function getEpicChildren(epic: Issue, allIssues: Issue[]): Issue[] {
  return allIssues.filter(i => i.parent === epic.id)
}

function calculateProgress(children: Issue[]): { total: number; closed: number; percentage: number } {
  const total = children.length
  const closed = children.filter(c => c.status === 'closed').length
  const percentage = total > 0 ? Math.round((closed / total) * 100) : 0
  return { total, closed, percentage }
}

async function Progress(props: EpicProgressProps = {}): Promise<string> {
  const { id, all = false } = props

  const issues = await loadIssues()

  let epics = issues.filter(i => i.type === 'epic')

  if (id) {
    epics = epics.filter(e => e.id === id)
  }

  if (!all && !id) {
    epics = epics.filter(e => e.status !== 'closed')
  }

  if (epics.length === 0) {
    if (id) {
      return `> Epic \`${id}\` not found\n`
    }
    return ''
  }

  const lines: string[] = ['### Epic Progress\n']

  for (const epic of epics) {
    const children = getEpicChildren(epic, issues)
    const { total, closed, percentage } = calculateProgress(children)
    const bar = renderProgressBar(percentage)

    lines.push(`**${epic.title}** (\`${epic.id}\`)`)
    lines.push(`${bar} ${closed}/${total} (${percentage}%)`)
    lines.push('')
  }

  return lines.join('\n')
}

async function Children(props: EpicChildrenProps): Promise<string> {
  const { id, limit = 20 } = props

  const issues = await loadIssues()

  const epic = issues.find(i => i.id === id)
  if (!epic) {
    return `> Epic \`${id}\` not found\n`
  }

  let children = getEpicChildren(epic, issues)

  children.sort((a, b) => {
    if (a.status === 'closed' && b.status !== 'closed') return 1
    if (a.status !== 'closed' && b.status === 'closed') return -1
    return a.priority - b.priority
  })

  children = children.slice(0, limit)

  if (children.length === 0) {
    return `### ${epic.title}\n\n_No child issues_\n`
  }

  const lines: string[] = [
    `### ${epic.title}\n`,
    '| Status | ID | Priority | Title |',
    '|:-------|:---|:---------|:------|',
  ]

  for (const child of children) {
    const status = child.status === 'closed' ? '✓' : child.status === 'in_progress' ? '→' : '○'
    const row = [
      status,
      `\`${child.id}\``,
      `P${child.priority}`,
      child.title.slice(0, 45) + (child.title.length > 45 ? '...' : ''),
    ]
    lines.push(`| ${row.join(' | ')} |`)
  }

  lines.push('')
  return lines.join('\n')
}

export const Epic = {
  Progress,
  Children,
}
