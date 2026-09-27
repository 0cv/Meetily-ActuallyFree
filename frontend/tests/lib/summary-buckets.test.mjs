import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSummary } from '../../src/lib/summary-buckets.ts';

test('Home reads the same Key Topics from saved Markdown and JSON summaries', () => {
  const markdown = '## Summary\nThe team agreed on the launch.\n## Key Topics\n- Launch date\n- Budget';
  const expected = ['Launch date', 'Budget'];
  assert.deepEqual(normalizeSummary(markdown).topics, expected);
  assert.deepEqual(normalizeSummary(JSON.stringify({ markdown })).topics, expected);
  assert.deepEqual(normalizeSummary(JSON.stringify(JSON.stringify({ markdown }))).topics, expected);
  assert.deepEqual(normalizeSummary({
    Overview: { title: 'Summary', blocks: [{ content: 'The team agreed on the launch.' }] },
    KeyTopics: { title: 'Key Topics', blocks: expected.map(content => ({ content })) },
  }).topics, expected);
});
