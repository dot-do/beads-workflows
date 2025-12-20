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
} from './types.js'

export {
  isValidStatus,
  isValidType,
  isValidPriority,
  isIssue,
  isEpic,
} from './types.js'

// Reader
export { readIssuesFromJsonl, findBeadsDir, parseJsonlLine } from './reader.js'
export type { JsonlIssue } from './reader.js'

// Writer
export { writeIssue, closeIssue, updateIssue, createIssue, runBd } from './writer.js'

// JSX Components (render to markdown)
export { Issues, Epic, Stats } from './components/index.js'
export type {
  IssuesReadyProps,
  IssuesBlockedProps,
  IssuesListProps,
  EpicProgressProps,
  EpicChildrenProps,
  StatsProps,
} from './components/index.js'
