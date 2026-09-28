import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speakerColor, speakerColorIndexMap, speakerDot, speakerKey } from '../../src/utils/speakerUtils.ts';

test('renaming speakers retains distinct meeting colors in the transcript and sidebar', () => {
  const before = speakerColorIndexMap(['You', 'Speaker 1', 'Speaker 2', 'Speaker 3']);
  const after = speakerColorIndexMap(['Andrew (You)', 'Dr. Andrea Love', 'AI Guy', 'Guy']);
  assert.equal(new Set(after.values()).size, 3);
  assert.deepEqual([...after.values()], [...before.values()]);
  for (const name of ['Dr. Andrea Love', 'AI Guy', 'Guy']) {
    const index = after.get(speakerKey(name));
    assert.ok(speakerDot(name, index).startsWith('bg-'));
    assert.ok(speakerColor(name, index).startsWith('text-'));
  }
  // The user keeps the theme accent however their label is written.
  assert.equal(speakerDot('Andrew (You)'), 'bg-af-accent');
});
