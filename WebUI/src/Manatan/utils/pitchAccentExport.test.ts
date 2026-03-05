import assert from 'node:assert/strict';
import test from 'node:test';

import { renderAnkiPitchAccents } from '@/Manatan/utils/pitchAccentExport.ts';

test('renderAnkiPitchAccents returns empty string when there is no pitch data', () => {
    assert.equal(renderAnkiPitchAccents([], 'さき'), '');
    assert.equal(renderAnkiPitchAccents(undefined, 'さき'), '');
});

test('renderAnkiPitchAccents matches Yomitan style by omitting dictionary labels and numeric notation', () => {
    const html = renderAnkiPitchAccents(
        [
            {
                reading: 'すでに',
                pitches: [{ position: 1, tags: ['adj'] }],
                dictionaryName: 'アクセント辞典',
            },
        ],
        'すでに',
    );

    assert.ok(html.includes('す'));
    assert.ok(html.includes('で'));
    assert.ok(html.includes('に'));
    assert.ok(!html.includes('アクセント辞典'));
    assert.ok(!html.includes('[1]'));
    assert.ok(!html.includes('adj'));
    assert.ok(html.includes('class="pronunciation-text"'));
    assert.ok(html.includes('class="pronunciation-mora"'));
    assert.ok(!html.includes('style='));
});

test('renderAnkiPitchAccents renders multiple accent entries as an ordered list', () => {
    const html = renderAnkiPitchAccents(
        [
            { reading: 'さき', pitches: [{ position: 1 }] },
            { reading: 'みさき', pitches: [{ position: 2 }] },
        ],
        'さき',
    );

    assert.ok(html.startsWith('<ol>'));
    assert.equal(html.split('<li>').length - 1, 2);
    assert.ok(html.includes('さ'));
    assert.ok(html.includes('み'));
});

test('renderAnkiPitchAccents supports H/L pattern downstep rendering', () => {
    const html = renderAnkiPitchAccents(
        [
            {
                reading: 'さぎ',
                pitches: [{ pattern: 'HL', position: 0 }],
            },
        ],
        'さぎ',
    );

    assert.ok(html.includes('さ'));
    assert.ok(html.includes('ぎ'));
    assert.ok(html.includes('data-pitch="high"'));
    assert.ok(html.includes('data-pitch-next="low"'));
});

test('renderAnkiPitchAccents uses fallback reading when pitch reading is missing', () => {
    const html = renderAnkiPitchAccents(
        [
            {
                pitches: [{ position: 0 }],
            },
        ],
        'みさき',
    );

    assert.ok(html.includes('み'));
    assert.ok(html.includes('さ'));
    assert.ok(html.includes('き'));
});

test('renderAnkiPitchAccents includes Yomitan-style nasal/devoice markers and original-text attrs', () => {
    const html = renderAnkiPitchAccents(
        [
            {
                reading: 'がく',
                pitches: [{ position: 1, nasal: [1], devoice: [2] }],
            },
        ],
        'がく',
    );

    assert.ok(html.includes('class="pronunciation-nasal-diacritic"'));
    assert.ok(html.includes('class="pronunciation-nasal-indicator"'));
    assert.ok(html.includes('class="pronunciation-devoice-indicator"'));
    assert.ok(html.includes('data-original-text="が"'));
});
