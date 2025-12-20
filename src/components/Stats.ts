/**
 * Stats component - project statistics as markdown
 */

import { readIssuesFromJsonl, findBeadsDir } from '../reader.js'
import type { Issue } from '../types.js'

export interface StatsProps {
  detailed?: boolean
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

export async function Stats(props: StatsProps = {}): Promise<string> {
  const { detailed = false } = props

  const issues = await loadIssues()

  if (issues.length === 0) {
    return '### Project Stats\n\n_No issues found_\n'
  }

  const total = issues.length
  const open = issues.filter(i => i.status === 'open').length
  const inProgress = issues.filter(i => i.status === 'in_progress').length
  const closed = issues.filter(i => i.status === 'closed').length

  const ready = issues.filter(issue => {
    if (issue.status !== 'open') return false
    for (const depId of issue.dependsOn) {
      const dep = issues.find(i => i.id === depId)
      if (dep && dep.status !== 'closed') return false
    }
    return true
  }).length

  const blocked = open - ready

  const byPriority = {
    P0: issues.filter(i => i.priority === 0 && i.status !== 'closed').length,
    P1: issues.filter(i => i.priority === 1 && i.status !== 'closed').length,
    P2: issues.filter(i => i.priority === 2 && i.status !== 'closed').length,
    P3: issues.filter(i => i.priority === 3 && i.status !== 'closed').length,
    P4: issues.filter(i => i.priority === 4 && i.status !== 'closed').length,
  }

  const byType = {
    task: issues.filter(i => i.type === 'task' && i.status !== 'closed').length,
    bug: issues.filter(i => i.type === 'bug' && i.status !== 'closed').length,
    feature: issues.filter(i => i.type === 'feature' && i.status !== 'closed').length,
    epic: issues.filter(i => i.type === 'epic' && i.status !== 'closed').length,
  }

  const lines: string[] = ['### Project Stats\n']

  lines.push(`**${open} open** · ${inProgress} in progress · ${closed} closed · ${total} total\n`)
  lines.push(`**Ready:** ${ready} · **Blocked:** ${blocked}\n`)

  if (detailed) {
    lines.push('**By Priority:**')
    const priorityParts: string[] = []
    if (byPriority.P0 > 0) priorityParts.push(`P0: ${byPriority.P0}`)
    if (byPriority.P1 > 0) priorityParts.push(`P1: ${byPriority.P1}`)
    if (byPriority.P2 > 0) priorityParts.push(`P2: ${byPriority.P2}`)
    if (byPriority.P3 > 0) priorityParts.push(`P3: ${byPriority.P3}`)
    if (byPriority.P4 > 0) priorityParts.push(`P4: ${byPriority.P4}`)
    lines.push(priorityParts.join(' · ') || '_None_')
    lines.push('')

    lines.push('**By Type:**')
    const typeParts: string[] = []
    if (byType.task > 0) typeParts.push(`Tasks: ${byType.task}`)
    if (byType.bug > 0) typeParts.push(`Bugs: ${byType.bug}`)
    if (byType.feature > 0) typeParts.push(`Features: ${byType.feature}`)
    if (byType.epic > 0) typeParts.push(`Epics: ${byType.epic}`)
    lines.push(typeParts.join(' · ') || '_None_')
    lines.push('')
  }

  return lines.join('\n')
}
