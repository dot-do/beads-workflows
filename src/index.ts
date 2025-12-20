/**
 * beads-workflows
 *
 * Workflow engine + TypeScript SDK for beads issue tracker
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
export {
  buildCreateCommand,
  buildUpdateCommand,
  buildCloseCommand,
  parseJsonOutput,
  execBd,
  createIssue,
  updateIssue,
  closeIssue,
} from './writer'
export type { CreateOptions, UpdateOptions, CommandResult } from './writer'

// Hooks
export { createHooks } from './hooks'
export type { Hooks } from './hooks'

// Issues API
export { createIssuesApi } from './issues'
export type { IssuesApi, ListFilter } from './issues'

// Epics API
export { createEpicsApi } from './epics'
export type { EpicsApi, EpicProgress, EpicFilter } from './epics'

// Beads factory
export { Beads, autoDetectBeads } from './beads'
export type { BeadsOptions, BeadsInstance } from './beads'

// JSX Components (render to markdown for agents.mdx)
export {
  Issue as IssueComponent,
  Issues as IssuesComponent,
  Epic as EpicComponent,
  Epics as EpicsComponent,
  Stats,
} from './components/index.js'
export type {
  IssueProps,
  IssuesReadyProps,
  IssuesBlockedProps,
  IssuesListProps,
  EpicProps,
  EpicsProps,
  EpicProgressProps,
  EpicChildrenProps,
  StatsProps,
} from './components/index.js'
