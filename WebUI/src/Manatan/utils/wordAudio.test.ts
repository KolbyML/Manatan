import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveFirstAvailableWordAudioSource } from './wordAudioSourceResolver';
import type { WordAudioSource } from '../types';

test('word audio source resolver short-circuits once a source has a URL', async () => {
    const calls: WordAudioSource[] = [];
    const sources: WordAudioSource[] = ['jpod101', 'language-pod-101', 'jisho'];

    const resolved = await resolveFirstAvailableWordAudioSource(sources, async (source) => {
        calls.push(source);
        if (source === 'language-pod-101') {
            return 'https://example.com/audio.mp3';
        }
        return null;
    });

    assert.deepEqual(calls, ['jpod101', 'language-pod-101']);
    assert.deepEqual(resolved, {
        source: 'language-pod-101',
        url: 'https://example.com/audio.mp3',
    });
});

test('word audio source resolver does not fan out requests in parallel', async () => {
    const sources: WordAudioSource[] = ['jpod101', 'language-pod-101', 'jisho'];
    let inFlight = 0;
    let maxInFlight = 0;

    const resolved = await resolveFirstAvailableWordAudioSource(sources, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        inFlight -= 1;
        return null;
    });

    assert.equal(resolved, null);
    assert.equal(maxInFlight, 1);
});
