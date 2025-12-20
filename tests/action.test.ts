import { describe, expect, test } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'

const WORKFLOW_PATH = join(__dirname, '../.github/workflows/beads-workflows.yml')

describe('GitHub Action workflow', () => {
  test('workflow file exists', async () => {
    const content = await readFile(WORKFLOW_PATH, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  test('has correct name', async () => {
    const content = await readFile(WORKFLOW_PATH, 'utf-8')
    const workflow = YAML.parse(content)
    expect(workflow.name).toBe('beads-workflows')
  })

  describe('triggers', () => {
    test('triggers on push to main when issues.jsonl changes', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.on.push).toBeDefined()
      expect(workflow.on.push.branches).toContain('main')
      expect(workflow.on.push.paths).toContain('.beads/issues.jsonl')
    })

    test('triggers on schedule for hourly, daily, weekly', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.on.schedule).toBeDefined()
      expect(Array.isArray(workflow.on.schedule)).toBe(true)

      const crons = workflow.on.schedule.map((s: { cron: string }) => s.cron)
      expect(crons).toContain('0 * * * *') // hourly
      expect(crons).toContain('0 0 * * *') // daily
      expect(crons).toContain('0 0 * * 0') // weekly
    })

    test('triggers on workflow_dispatch with retry input', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.on.workflow_dispatch).toBeDefined()
      expect(workflow.on.workflow_dispatch.inputs.retry_failed).toBeDefined()
      expect(workflow.on.workflow_dispatch.inputs.retry_failed.type).toBe('boolean')
    })
  })

  describe('jobs', () => {
    test('has run-workflows job', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.jobs['run-workflows']).toBeDefined()
    })

    test('runs on ubuntu-latest', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.jobs['run-workflows']['runs-on']).toBe('ubuntu-latest')
    })

    test('has checkout step', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      const steps = workflow.jobs['run-workflows'].steps
      const checkout = steps.find((s: { uses?: string }) => s.uses?.includes('checkout'))
      expect(checkout).toBeDefined()
    })

    test('has Bun setup step', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      const steps = workflow.jobs['run-workflows'].steps
      const bunSetup = steps.find((s: { uses?: string }) => s.uses?.includes('bun'))
      expect(bunSetup).toBeDefined()
    })

    test('installs beads-workflows', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      const steps = workflow.jobs['run-workflows'].steps
      const install = steps.find(
        (s: { run?: string }) => s.run?.includes('bun add beads-workflows')
      )
      expect(install).toBeDefined()
    })

    test('runs beads-workflows with --once flag', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      const steps = workflow.jobs['run-workflows'].steps
      const run = steps.find((s: { run?: string }) => s.run?.includes('run --once'))
      expect(run).toBeDefined()
      expect(run.run).toContain('beads-workflows')
    })

    test('has permissions to write and push', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      expect(workflow.jobs['run-workflows'].permissions.contents).toBe('write')
    })

    test('commits and pushes workflows.jsonl changes', async () => {
      const content = await readFile(WORKFLOW_PATH, 'utf-8')
      const workflow = YAML.parse(content)

      const steps = workflow.jobs['run-workflows'].steps
      const commit = steps.find(
        (s: { run?: string }) => s.run?.includes('git commit') && s.run?.includes('workflows.jsonl')
      )
      expect(commit).toBeDefined()
    })
  })
})
