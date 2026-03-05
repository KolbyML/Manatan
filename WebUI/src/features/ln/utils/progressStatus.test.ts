import assert from 'node:assert/strict';
import test from 'node:test';

import {
    NOVEL_COMPLETE_PROGRESS_THRESHOLD_PERCENT,
    isNovelProgressComplete,
} from '@/features/ln/utils/progressStatus.ts';

test('marks novels complete when progress reaches threshold', () => {
    assert.equal(isNovelProgressComplete(NOVEL_COMPLETE_PROGRESS_THRESHOLD_PERCENT), true);
    assert.equal(isNovelProgressComplete(100), true);
});

test('keeps novels in-progress below completion threshold', () => {
    assert.equal(isNovelProgressComplete(NOVEL_COMPLETE_PROGRESS_THRESHOLD_PERCENT - 0.1), false);
    assert.equal(isNovelProgressComplete(42), false);
});

test('handles missing or invalid progress safely', () => {
    assert.equal(isNovelProgressComplete(undefined), false);
    assert.equal(isNovelProgressComplete(null), false);
    assert.equal(isNovelProgressComplete(Number.NaN), false);
});
