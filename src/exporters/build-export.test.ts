import { describe, expect, it } from 'vitest';

import { buildExport } from './build-export.js';
import type { RecordingTimeline } from '../types/index.js';

function timeline(overrides: Partial<RecordingTimeline> = {}): RecordingTimeline {
  return {
    events: [],
    environment: {
      userAgent: 'test-agent',
      viewport: { width: 1280, height: 800 },
      url: 'https://example.test/dashboard',
      recordedAt: '2026-01-01T00:00:00.000Z'
    },
    metadata: {
      startedAt: '2026-01-01T00:00:00.000Z',
      stoppedAt: '2026-01-01T00:00:05.000Z',
      durationMs: 5000,
      eventCount: 0
    },
    ...overrides
  };
}

describe('buildExport', () => {
  it('produces every file the documented Export Format requires', () => {
    const bundle = buildExport(timeline());
    expect(Object.keys(bundle.files).sort()).toEqual(
      [
        'actions.json',
        'console.json',
        'environment.json',
        'metadata.json',
        'network.json',
        'report.md',
        'runtime.json',
        'screenshots/README.md',
        'session.json'
      ].sort()
    );
  });

  it('routes each event into its own category file plus the combined session', () => {
    const bundle = buildExport(
      timeline({
        events: [
          {
            sequence: 1,
            timestamp: 0,
            elapsedMs: 0,
            category: 'action',
            detail: { name: 'page-resize', detail: {} }
          },
          {
            sequence: 2,
            timestamp: 10,
            elapsedMs: 10,
            category: 'console',
            detail: { severity: 'error', arguments: ['boom'] }
          },
          {
            sequence: 3,
            timestamp: 20,
            elapsedMs: 20,
            category: 'network',
            detail: {
              method: 'GET',
              url: '/api/data',
              startTime: 0,
              finishTime: 5,
              durationMs: 5,
              status: 500,
              responseSize: null,
              failed: true
            }
          },
          {
            sequence: 4,
            timestamp: 30,
            elapsedMs: 30,
            category: 'runtime',
            detail: {
              kind: 'exception',
              message: 'unexpected',
              triggeredBySequence: 1
            }
          }
        ]
      })
    );

    expect(JSON.parse(bundle.files['actions.json']!)).toHaveLength(1);
    expect(JSON.parse(bundle.files['console.json']!)).toHaveLength(1);
    expect(JSON.parse(bundle.files['network.json']!)).toHaveLength(1);
    expect(JSON.parse(bundle.files['runtime.json']!)).toHaveLength(1);
    expect(JSON.parse(bundle.files['session.json']!).events).toHaveLength(4);
  });

  it('lists runtime errors and their triggering action in the Markdown report', () => {
    const bundle = buildExport(
      timeline({
        events: [
          {
            sequence: 1,
            timestamp: 0,
            elapsedMs: 0,
            category: 'action',
            detail: { name: 'widget-resize', detail: {} }
          },
          {
            sequence: 2,
            timestamp: 10,
            elapsedMs: 10,
            category: 'runtime',
            detail: { kind: 'exception', message: 'boom', triggeredBySequence: 1 }
          }
        ]
      })
    );

    expect(bundle.files['report.md']).toContain('boom');
    expect(bundle.files['report.md']).toContain('triggered by action #1');
  });

  it('reports no errors and no failures when the session is clean', () => {
    const bundle = buildExport(timeline());
    expect(bundle.files['report.md']).toContain('_No runtime errors._');
    expect(bundle.files['report.md']).toContain('_No failed requests._');
  });

  describe('screenshots', () => {
    it('writes a captured screenshot as its own binary file, named by sequence', () => {
      const bundle = buildExport(
        timeline({
          events: [
            {
              sequence: 7,
              timestamp: 0,
              elapsedMs: 0,
              category: 'action',
              detail: { name: 'widget-resize', detail: {} },
              screenshot: 'data:image/png;base64,AAA'
            }
          ]
        })
      );

      expect(bundle.binaryFiles['screenshots/event-7.png']).toBe(
        'data:image/png;base64,AAA'
      );
      expect(bundle.files['screenshots/README.md']).toBeUndefined();
    });

    it('links the screenshot from the report timeline', () => {
      const bundle = buildExport(
        timeline({
          events: [
            {
              sequence: 7,
              timestamp: 0,
              elapsedMs: 0,
              category: 'action',
              detail: { name: 'widget-resize', detail: {} },
              screenshot: 'data:image/png;base64,AAA'
            }
          ]
        })
      );

      expect(bundle.files['report.md']).toContain('./screenshots/event-7.png');
    });

    it('falls back to a README noting none were captured when no event has a screenshot', () => {
      const bundle = buildExport(
        timeline({
          events: [
            {
              sequence: 1,
              timestamp: 0,
              elapsedMs: 0,
              category: 'action',
              detail: { name: 'widget-resize', detail: {} }
            }
          ]
        })
      );

      expect(Object.keys(bundle.binaryFiles)).toHaveLength(0);
      expect(bundle.files['screenshots/README.md']).toContain('No screenshots');
    });
  });
});
