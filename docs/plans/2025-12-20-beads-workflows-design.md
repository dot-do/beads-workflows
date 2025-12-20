# beads-workflows Design Document

**Date:** 2025-12-20
**Status:** Approved
**Repo:** https://github.com/dot-do/beads-workflows

## Overview

beads-workflows is a workflow engine + TypeScript SDK for the beads issue tracker. It enables convention-based automation where dropping `.ts` files in `.beads/` triggers automatic execution on issue events.

## Goals

1. **Zero-import handlers** - Write workflow scripts with globals, no boilerplate
2. **TypeScript SDK** - Programmatic access via `{ issues, epics, on }` exports
3. **Hybrid I/O** - Fast reads from JSONL, safe writes via `bd` CLI
4. **Background daemon** - Watches for changes, executes handlers automatically
5. **Convention-based** - `.beads/on.*.ts` files define workflows

## API Design

### Imports

```typescript
// Default - auto-detects .beads
import { issues, epics, on } from 'beads-workflows'

// Custom location
import { Beads } from 'beads-workflows'
const project = Beads({ path: '~/other/.beads' })
```

### Issues API

```typescript
const ready = await issues.ready()
const issue = await issues.get('proj-123')
const bugs = await issues.list({ type: 'bug', status: 'open' })

await issues.create({ title: 'New task', type: 'task', priority: 2 })
await issues.update('proj-123', { status: 'in_progress' })
await issues.close('proj-123')
```

### Epics API

```typescript
const epic = await epics.get('proj-100')
const children = await epics.children('proj-100')
const progress = await epics.progress('proj-100')  // { total: 5, closed: 3 }
```

### Event Hooks (Fluent API)

```typescript
on.issue.created(issue => { })
on.issue.ready(issue => { })
on.issue.closed(issue => { })
on.issue.unblocked(issue => { })
on.epic.completed(epic => { })
```

### Convention Handlers

```
.beads/
├── on.issue.ready.ts
├── on.issue.closed.ts
└── on.epic.completed.ts
```

**Example `.beads/on.issue.ready.ts`:**
```typescript
// No imports - globals injected
console.log(`Ready: ${issue.id} - ${issue.title}`)
```

## Architecture

```
src/
├── index.ts       # Exports { issues, epics, on, Beads }
├── types.ts       # Issue, Epic, Changes interfaces
├── reader.ts      # JSONL parsing
├── writer.ts      # bd CLI wrapper
├── watcher.ts     # File watching + events
├── hooks.ts       # Fluent on.* API
├── issues.ts      # issues.* methods
├── epics.ts       # epics.* methods
├── beads.ts       # Beads factory
├── scanner.ts     # on.*.ts file discovery
├── runtime.ts     # Global injection
├── cli.ts         # npx beads-workflows
└── commands/
    └── init.ts    # Init command
```

### Hybrid I/O Strategy

| Operation | Method | Why |
|-----------|--------|-----|
| Read issues | Parse JSONL directly | Fast, no subprocess |
| Create/Update/Close | Call `bd` CLI | Daemon sync, race safety |

### Event Flow

1. Watcher detects new line in `issues.jsonl`
2. Parse event (created, closed, status change, etc.)
3. Check if event unblocks other issues
4. Emit typed events to registered handlers
5. Execute matching `.beads/on.*.ts` handlers

## Implementation Plan

### Phase 1: Core SDK (13 tasks)

1. **bw-2l8** - types.ts (foundational)
2. **bw-4wl** - JSONL reader
3. **bw-bpc** - bd CLI wrapper
4. **bw-0rq** - File watcher
5. **bw-0al** - Fluent hooks API
6. **bw-ai1** - issues.* API
7. **bw-qgn** - epics.* API
8. **bw-nes** - Beads factory
9. **bw-26t** - Handler scanner
10. **bw-ngv** - Global injection
11. **bw-v0y** - CLI daemon
12. **bw-6kv** - Init command
13. **bw-gau** - index.ts exports

### Dependency Graph

```
types (bw-2l8)
  ├── reader (bw-4wl)
  │     ├── watcher (bw-0rq) ──┐
  │     └── issues (bw-ai1) ───┼── beads (bw-nes) ── index (bw-gau)
  ├── writer (bw-bpc) ─────────┤
  ├── hooks (bw-0al) ──────────┘
  ├── scanner (bw-26t)
  │     └── runtime (bw-ngv) ──┐
  └── init (bw-6kv)            ├── cli (bw-v0y)
                               │
         watcher (bw-0rq) ─────┘
```

## Testing Strategy

TDD approach for each module:

1. Write failing tests first
2. Implement minimal code to pass
3. Refactor

### Test Fixtures

- Sample `issues.jsonl` with various events
- Mock `bd` CLI responses
- Temp directories for handler tests

## CLI

```bash
# Start daemon
npx beads-workflows

# With options
npx beads-workflows --path ~/project/.beads --verbose

# Initialize
npx beads-workflows init
```

## Future Phases

### Phase 2: Orchestrator Integration

- Terminal UI for multiple Claude Code instances
- Sidebar navigation between agents
- Dispatch on `issue.ready` events

### Phase 3: Cloudflare Sandbox

- Run Claude Code in isolated containers
- Parallel execution of issues

### Phase 4: Agent SDK + Durable Objects

- Serverless execution via MCP
- Query issues from db.sb database

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Hybrid I/O (read JSONL, write via bd) | Fast reads, safe writes |
| Fluent `on.*` API | Cleaner than `on('event', ...)` |
| Zero-import handlers | Minimal boilerplate |
| Global injection | Enables simple handler files |
| Bun runtime | Fast, native TypeScript |
