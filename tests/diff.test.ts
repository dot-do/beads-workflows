import { describe, expect, test } from 'bun:test'
import { diff, type DiffResult } from '../src/diff'

describe('diff', () => {
  describe('diff function', () => {
    test('returns empty result for identical content', async () => {
      const content = '{"id":"bw-1","title":"Test","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'

      const result = await diff({ before: content, after: content })

      expect(result.created).toEqual([])
      expect(result.updated).toEqual([])
      expect(result.closed).toEqual([])
    })

    test('detects created issue', async () => {
      const before = ''
      const after = '{"id":"bw-1","title":"New","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.created.length).toBe(1)
      expect(result.created[0].id).toBe('bw-1')
      expect(result.updated).toEqual([])
      expect(result.closed).toEqual([])
    })

    test('detects multiple created issues', async () => {
      const before = ''
      const after = [
        '{"id":"bw-1","title":"First","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
        '{"id":"bw-2","title":"Second","status":"open","priority":1,"issue_type":"bug","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
      ].join('\n') + '\n'

      const result = await diff({ before, after })

      expect(result.created.length).toBe(2)
      expect(result.created.map((i) => i.id).sort()).toEqual(['bw-1', 'bw-2'])
    })

    test('detects closed issue', async () => {
      const before = '{"id":"bw-1","title":"Test","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'
      const after = '{"id":"bw-1","title":"Test","status":"closed","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z","closed_at":"2025-01-02T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.created).toEqual([])
      expect(result.updated).toEqual([])
      expect(result.closed.length).toBe(1)
      expect(result.closed[0].id).toBe('bw-1')
    })

    test('detects updated issue (status change)', async () => {
      const before = '{"id":"bw-1","title":"Test","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'
      const after = '{"id":"bw-1","title":"Test","status":"in_progress","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.created).toEqual([])
      expect(result.updated.length).toBe(1)
      expect(result.updated[0].id).toBe('bw-1')
      expect(result.updated[0].before.status).toBe('open')
      expect(result.updated[0].after.status).toBe('in_progress')
      expect(result.closed).toEqual([])
    })

    test('detects updated issue (priority change)', async () => {
      const before = '{"id":"bw-1","title":"Test","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'
      const after = '{"id":"bw-1","title":"Test","status":"open","priority":0,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.updated.length).toBe(1)
      expect(result.updated[0].before.priority).toBe(2)
      expect(result.updated[0].after.priority).toBe(0)
    })

    test('detects updated issue (title change)', async () => {
      const before = '{"id":"bw-1","title":"Old Title","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'
      const after = '{"id":"bw-1","title":"New Title","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.updated.length).toBe(1)
      expect(result.updated[0].before.title).toBe('Old Title')
      expect(result.updated[0].after.title).toBe('New Title')
    })

    test('handles mixed changes', async () => {
      const before = [
        '{"id":"bw-1","title":"Existing","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
        '{"id":"bw-2","title":"Will Close","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
      ].join('\n') + '\n'

      const after = [
        '{"id":"bw-1","title":"Updated","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}',
        '{"id":"bw-2","title":"Will Close","status":"closed","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}',
        '{"id":"bw-3","title":"New","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-02T10:00:00Z","updated_at":"2025-01-02T10:00:00Z"}',
      ].join('\n') + '\n'

      const result = await diff({ before, after })

      expect(result.created.length).toBe(1)
      expect(result.created[0].id).toBe('bw-3')

      expect(result.updated.length).toBe(1)
      expect(result.updated[0].id).toBe('bw-1')

      expect(result.closed.length).toBe(1)
      expect(result.closed[0].id).toBe('bw-2')
    })

    test('handles empty before (initial commit)', async () => {
      const before = ''
      const after = '{"id":"bw-1","title":"First","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}\n'

      const result = await diff({ before, after })

      expect(result.created.length).toBe(1)
    })

    test('ignores unchanged issues in snapshot format', async () => {
      // In JSONL snapshot format, the same issue appears multiple times
      // Only the last occurrence matters
      const before = [
        '{"id":"bw-1","title":"V1","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
        '{"id":"bw-1","title":"V2","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T11:00:00Z"}',
      ].join('\n') + '\n'

      const after = [
        '{"id":"bw-1","title":"V1","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T10:00:00Z"}',
        '{"id":"bw-1","title":"V2","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T11:00:00Z"}',
        '{"id":"bw-1","title":"V3","status":"open","priority":2,"issue_type":"task","created_at":"2025-01-01T10:00:00Z","updated_at":"2025-01-01T12:00:00Z"}',
      ].join('\n') + '\n'

      const result = await diff({ before, after })

      expect(result.updated.length).toBe(1)
      expect(result.updated[0].before.title).toBe('V2')
      expect(result.updated[0].after.title).toBe('V3')
    })
  })
})
