/**
 * beads-workflows
 *
 * Workflow engine + TypeScript SDK + JSX components for beads issue tracker
 */

// Types
export type {
  Issue,
  Epic,
  IssueStatus,
  IssueType,
  Priority,
  Changes,
  IssueEvent,
  BeadsConfig,
} from './types'

export {
  isValidStatus,
  isValidType,
  isValidPriority,
  isIssue,
  isEpic,
} from './types'

// Reader
export { readIssuesFromJsonl, findBeadsDir, parseJsonlLine } from './reader'
export type { JsonlIssue } from './reader'

// Writer
export { writeIssue, closeIssue, updateIssue, createIssue, runBd } from './writer'

// JSX Components (render to markdown)
export { Issues, Epic, Stats } from './components'
export type {
  IssuesReadyProps,
  IssuesBlockedProps,
  IssuesListProps,
  EpicProgressProps,
  EpicChildrenProps,
  StatsProps,
} from './components'
