# beads-workflows

Workflow engine + TypeScript SDK for the [beads](https://github.com/beads-ai/beads) issue tracker.

## Installation

```bash
bun add beads-workflows
```

## Quick Start

```typescript
import { Beads } from 'beads-workflows'

const beads = await Beads()

// List ready issues
const ready = await beads.issues.ready()

// Create and close issues
await beads.issues.create({ title: 'New task', type: 'task' })
await beads.issues.close('bw-123')
```

## Event Handlers

Drop handler files in `.beads/` - they execute when issues change:

```typescript
// .beads/on.issue.created.ts
export default async ({ issue, beads }) => {
  console.log(`New issue: ${issue.title}`)
}

// .beads/on.issue.closed.ts
export default async ({ issue, beads }) => {
  // Auto-close epic when all children done
  for (const epicId of issue.blocks) {
    const progress = await beads.epics.progress(epicId)
    if (progress.percentage === 100) {
      await beads.issues.close(epicId)
    }
  }
}
```

## Scheduled Handlers

```typescript
// .beads/every.hour.ts - runs hourly
export default async ({ issues }) => {
  const stale = issues.filter(i => /* stale check */)
  console.log(`Found ${stale.length} stale issues`)
}

// .beads/every.day.ts - runs daily
// .beads/every.week.ts - runs weekly
```

Or use the `every()` API for custom crons:

```typescript
import { every } from 'beads-workflows'

every('0 9 * * 1-5', async ({ issues }) => {
  console.log('Good morning!')
})
```

## CLI

```bash
# Watch mode (daemon)
beads-workflows run

# Single pass
beads-workflows run --once

# View execution history
beads-workflows list
beads-workflows list --failed

# Retry failed
beads-workflows retry bw-123 closed
beads-workflows retry --all-failed
```

## GitHub Action

Runs workflows on push, schedule, or manual trigger:

```yaml
name: beads-workflows
on:
  push:
    branches: [main]
    paths: ['.beads/issues.jsonl']
  schedule:
    - cron: '0 * * * *'   # hourly
    - cron: '0 0 * * *'   # daily
```

See [GitHub Action docs](docs/github-action.mdx) for full setup.

## APIs

| API | Description |
|-----|-------------|
| `Beads()` | Main factory with issues/epics access |
| `issues.list()` | Query issues with filters |
| `issues.ready()` | Issues with no blockers |
| `issues.create()` | Create new issues |
| `epics.progress()` | Epic completion tracking |
| `Workflows()` | Execution history and retry |
| `diff()` | Change detection between commits |
| `every()` | Register scheduled handlers |

## Documentation

Full documentation in [`docs/`](docs/):

- [Getting Started](docs/index.mdx)
- [Issues API](docs/issues.mdx)
- [Epics API](docs/epics.mdx)
- [Event Handlers](docs/handlers.mdx)
- [Scheduled Handlers](docs/schedule.mdx)
- [CLI Reference](docs/cli.mdx)
- [GitHub Action](docs/github-action.mdx)

## License

MIT
