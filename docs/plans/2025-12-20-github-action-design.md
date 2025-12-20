# GitHub Action for beads-workflows

## Overview

Enable workflow execution in GitHub Actions alongside the local daemon. Both are first-class - some teams use the daemon, others use CI, some use both.

## Triggers

The GitHub Action supports three trigger types:

```yaml
name: beads-workflows
on:
  push:
    branches: [main]
    paths: ['.beads/issues.jsonl']
  schedule:
    - cron: '0 * * * *'   # hourly
    - cron: '0 0 * * *'   # daily
    - cron: '0 0 * * 0'   # weekly
  workflow_dispatch:
    inputs:
      retry_failed:
        type: boolean
        description: 'Retry all failed workflows'
```

- **Push**: React to issue changes (diff-based detection)
- **Schedule**: Time-based workflows (Priya's hourly reviews, daily digests)
- **Manual**: Debug/recovery, retry failed executions

## State Tracking

### workflows.jsonl

Execution history is stored in `.beads/workflows.jsonl` and committed to the repo:

```jsonl
{"type":"issue","issue":"bw-123","event":"created","status":"success","handler":"on.issue.created.ts","triggered_at":"2025-01-01T10:00:00Z","duration":142,"commit":"abc123","trigger":"push"}
{"type":"issue","issue":"bw-456","event":"closed","status":"failed","handler":"on.issue.closed.ts","error":"bd command failed","triggered_at":"2025-01-01T10:00:05Z","duration":89,"commit":"abc123","trigger":"push"}
{"type":"schedule","cron":"0 * * * *","status":"success","handler":"every.hour.ts","triggered_at":"2025-01-01T11:00:00Z","duration":5230,"commit":"def456","trigger":"schedule"}
```

**Fields:**
- `type`: "issue" | "schedule" | "manual"
- `status`: "success" | "failed"
- `trigger`: "push" | "schedule" | "workflow_dispatch" | "daemon"
- `commit`: Git SHA when executed
- `handler`: Which file ran
- `duration`: Execution time in milliseconds
- `error`: Error message (if failed)

Both the daemon and GitHub Action write to this file, providing coordination and audit trail.

## Handler Files

### Issue Event Handlers

Convention-based files in `.beads/`:

- `on.issue.created.ts`
- `on.issue.updated.ts`
- `on.issue.closed.ts`
- `on.issue.ready.ts`
- `on.issue.blocked.ts`

### Scheduled Handlers

**File-based (common intervals):**

| File | Cron |
|------|------|
| `every.hour.ts` | `0 * * * *` |
| `every.day.ts` | `0 0 * * *` |
| `every.week.ts` | `0 0 * * 0` |

**API-based (custom crons):**

```typescript
// .beads/schedules.ts
import { every } from 'beads-workflows'

every('*/15 * * * *', async ({ issues, epics }) => {
  // Every 15 minutes
})

every('0 9 * * 1-5', async ({ issues }) => {
  // 9am on weekdays
})
```

## SDK Additions

### Workflows API

```typescript
import { Workflows } from 'beads-workflows'

const workflows = Workflows('.beads')

// Check if event already processed (idempotency)
const executed = await workflows.wasExecuted('bw-123', 'created')

// Record execution
await workflows.record({
  type: 'issue',
  issue: 'bw-123',
  event: 'created',
  status: 'success',
  handler: 'on.issue.created.ts',
  trigger: 'push',
  commit: 'abc123',
  duration: 142,
})

// Get failed executions
const failed = await workflows.listFailed()

// Retry a specific event
await workflows.retry('bw-123', 'closed')
```

### Diff API

```typescript
import { diff } from 'beads-workflows'

const changes = await diff({
  before: previousContent,
  after: currentContent,
})

// Returns:
// {
//   created: [{ id: 'bw-123', ... }],
//   updated: [{ id: 'bw-456', before: {...}, after: {...} }],
//   closed: [{ id: 'bw-789', ... }],
// }
```

### Every API

```typescript
import { every } from 'beads-workflows'

every('0 * * * *', async (ctx) => {
  const { issues, epics } = ctx
  // Handler logic
})
```

## CLI Commands

```bash
# Run workflows
beads-workflows run                    # watch mode (daemon)
beads-workflows run --once             # single pass, exit (used by GitHub Action)

# Retry failed
beads-workflows retry bw-123 closed    # retry specific event
beads-workflows retry --all-failed     # retry all failed

# List workflow history
beads-workflows list                   # recent executions
beads-workflows list --failed          # only failures
beads-workflows list --issue bw-123    # for specific issue
```

## GitHub Action Implementation

### Workflow Steps

1. Checkout repo
2. Setup Bun
3. Install beads-workflows
4. Detect trigger type:
   - **Push**: Diff `issues.jsonl` between HEAD~1 and HEAD
   - **Schedule**: Get cron from `github.event.schedule`
   - **Manual**: Check for retry flag
5. Execute matching handlers
6. Commit updated `workflows.jsonl`
7. Push

### Change Detection (Push)

```bash
git show HEAD~1:.beads/issues.jsonl > /tmp/before.jsonl
beads-workflows run --once --before /tmp/before.jsonl
```

### Failure Handling

- Failures are recorded in `workflows.jsonl` with `status: "failed"` and `error` message
- Other handlers continue to execute
- Failed events can be retried via `beads-workflows retry` or manual workflow dispatch

## Handler Access

Handlers have full read/write access:
- `issues.list()`, `issues.ready()`, `issues.create()`, etc.
- `epics.list()`, `epics.progress()`, etc.
- `bd` CLI available for advanced operations

Changes made by handlers are committed along with `workflows.jsonl`.
