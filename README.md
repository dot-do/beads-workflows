# beads-workflows

Workflow engine + TypeScript SDK for the [beads](https://github.com/beads-org/beads) issue tracker.

## Features

- **JSX Components** - Render issues as markdown tables for [agents.mdx](https://github.com/dot-do/agents.mdx)
- **Zero-import handlers** - Write workflow scripts with globals, no boilerplate
- **Convention-based** - Drop `.ts` files in `.beads/` to define workflows
- **TypeScript SDK** - Programmatic access to issues, epics, and events
- **Hybrid I/O** - Fast reads from JSONL/SQLite, safe writes via `bd` CLI
- **Background daemon** - Watches for changes, executes handlers automatically

## Quick Start

```bash
# Install
npm install beads-workflows

# Initialize in a beads project
npx beads-workflows init

# Start the workflow daemon
npx beads-workflows
```

## Convention-Based Workflows

Drop handler files in `.beads/` - they execute automatically when events fire:

```
.beads/
├── issues.jsonl
├── config.yaml
├── global.d.ts              # Generated - provides types for handlers
├── on.issue.ready.ts        # Runs when issue has no blockers
├── on.issue.closed.ts       # Runs when issue is closed
├── on.issue.created.ts      # Runs when issue is created
└── on.epic.completed.ts     # Runs when all epic children close
```

### Example: `.beads/on.issue.ready.ts`

```typescript
// No imports needed - globals are injected
console.log(`Ready to work: ${issue.id} - ${issue.title}`)

if (issue.priority === 0) {
  notify(`P0 issue ready: ${issue.title}`)
}
```

### Example: `.beads/on.issue.closed.ts`

```typescript
// issue and changes are globals
log(`Closed: ${issue.id}`)

if (issue.type === 'bug') {
  notify(`Bug fixed: ${issue.title}`)
}
```

### Example: `.beads/on.epic.completed.ts`

```typescript
// epic and children are globals
log(`Epic complete: ${epic.id}`)
log(`Completed ${children.length} tasks`)

notify(`Epic "${epic.title}" is done!`)
```

## JSX Components

Components that render beads data as markdown. Use with [agents.mdx](https://github.com/dot-do/agents.mdx) for dynamic agent context.

```typescript
import { Issues, Epic, Stats } from 'beads-workflows'

// In AGENTS.mdx or programmatically:
const ready = await Issues.Ready({ limit: 10, priority: 'P0,P1' })
const blocked = await Issues.Blocked()
const progress = await Epic.Progress({ id: 'proj-100' })
const stats = await Stats({ detailed: true })
```

### `<Issues.Ready />`

Show issues ready to work (no open blockers).

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `limit` | number | 10 | Max issues to show |
| `priority` | string | - | Filter by priority (e.g., "P0,P1") |
| `assignee` | string | - | Filter by assignee |

**Output:**

```markdown
### Ready to Work

| ID | Priority | Type | Title | Updated |
|:---|:---------|:-----|:------|:--------|
| `proj-123` | P1 | task | Implement user auth | 2d ago |
```

### `<Issues.Blocked />`

Show blocked issues with their blockers.

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `limit` | number | 10 | Max issues to show |

### `<Issues.List />`

List issues with filters.

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `status` | string | "open" | Filter: open, in_progress, closed, all |
| `type` | string | - | Filter: task, bug, feature, epic |
| `priority` | string | - | Filter by priority |
| `assignee` | string | - | Filter by assignee |
| `limit` | number | 20 | Max issues to show |

### `<Epic.Progress />`

Show epic completion progress.

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `id` | string | - | Specific epic ID |
| `all` | boolean | false | Show all epics (including closed) |

**Output:**

```markdown
### Epic Progress

**User Authentication** (`proj-100`)
[████████░░░░░░░░░░░░] 8/20 (40%)
```

### `<Epic.Children />`

List children of an epic.

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `id` | string | required | Epic ID |
| `limit` | number | 20 | Max children to show |

### `<Stats />`

Project statistics summary.

| Prop | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `detailed` | boolean | false | Show priority/type breakdown |

**Output:**

```markdown
### Project Stats

**15 open** · 3 in progress · 42 closed · 60 total

**Ready:** 12 · **Blocked:** 3
```

---

## TypeScript SDK

For programmatic access:

```typescript
import { issues, epics, on } from 'beads-workflows'

// Query issues
const ready = await issues.ready()
const issue = await issues.get('proj-123')
const bugs = await issues.list({ type: 'bug', status: 'open' })

// Mutate issues (calls bd CLI for safety)
await issues.create({ title: 'New task', type: 'task', priority: 2 })
await issues.update('proj-123', { status: 'in_progress' })
await issues.close('proj-123')

// Query epics
const epic = await epics.get('proj-100')
const children = await epics.children('proj-100')
const progress = await epics.progress('proj-100')  // { total: 5, closed: 3 }

// Subscribe to events
on.issue.created(issue => console.log(`Created: ${issue.id}`))
on.issue.ready(issue => console.log(`Ready: ${issue.id}`))
on.issue.closed(issue => console.log(`Closed: ${issue.id}`))
on.issue.unblocked(issue => console.log(`Unblocked: ${issue.id}`))
on.epic.completed(epic => console.log(`Epic done: ${epic.id}`))
```

### Custom Beads Location

```typescript
import { Beads } from 'beads-workflows'

// Create instance for a specific project
const project = Beads({ path: '~/other-project/.beads' })

const ready = await project.issues.ready()
project.on.issue.closed(issue => {
  console.log(`Closed in other project: ${issue.id}`)
})

// Work with multiple projects
const projectA = Beads({ path: '~/project-a/.beads' })
const projectB = Beads({ path: '~/project-b/.beads' })
```

## CLI

```bash
# Start workflow daemon (watches .beads, runs handlers)
npx beads-workflows

# With options
npx beads-workflows --path ~/projects/myapp/.beads
npx beads-workflows --verbose

# Initialize in current project
npx beads-workflows init

# Check status
npx beads-workflows status
```

## Available Events

| Event | Globals | Triggered When |
|-------|---------|----------------|
| `on.issue.created` | `issue` | New issue created |
| `on.issue.updated` | `issue`, `changes` | Issue modified |
| `on.issue.closed` | `issue` | Issue closed |
| `on.issue.reopened` | `issue` | Closed issue reopened |
| `on.issue.started` | `issue` | Status → in_progress |
| `on.issue.ready` | `issue` | No blockers, can work |
| `on.issue.blocked` | `issue`, `blocker` | Gained a blocker |
| `on.issue.unblocked` | `issue` | All blockers resolved |
| `on.dep.added` | `issue`, `dependency` | Dependency added |
| `on.dep.removed` | `issue`, `dependency` | Dependency removed |
| `on.epic.completed` | `epic`, `children` | All children closed |
| `on.epic.progress` | `epic`, `progress` | Child closed/opened |
| `on.sync` | `events` | After git sync |

## Global Helpers

Available in all handler files:

```typescript
// Logging
log(message: string): void

// Notifications (configurable destination)
notify(message: string): Promise<void>

// Dispatch to external system
dispatch(issue: Issue): Promise<void>

// Execute bd commands
bd(command: string, args?: string[]): Promise<string>
```

## Architecture

```
beads-workflows
├── Reads directly from .beads/issues.jsonl (fast queries)
├── Writes via bd CLI (ensures daemon sync, race condition safety)
├── Watches issues.jsonl for changes
├── Parses events, executes matching on.*.ts handlers
└── Injects globals before running handler code
```

## Types

```typescript
interface Issue {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'closed'
  type: 'task' | 'bug' | 'feature' | 'epic'
  priority: 0 | 1 | 2 | 3 | 4
  assignee?: string
  labels?: string[]
  created: Date
  updated: Date
  closed?: Date
  dependsOn: string[]
  blocks: string[]
  parent?: string
  children?: string[]
}

interface Epic extends Issue {
  type: 'epic'
  children: string[]
}

interface Changes {
  [field: string]: { from: any; to: any }
}

interface Progress {
  total: number
  closed: number
  percentage: number
}
```

## License

MIT
