import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyPerEntryHarmonicMean,
    getHarmonicMeanFrequencyFromFrequencies,
    getLowestFrequencyFromFrequencies,
    HARMONIC_MEAN_DICTIONARY_NAME,
} from '@/Manatan/utils/frequency.ts';

test('getLowestFrequencyFromFrequencies returns the minimum numeric frequency', () => {
    const frequencies = [
        { dictionaryName: 'Jiten', value: '110963 (そらめ)' },
        { dictionaryName: 'JPDB', value: '125156 (そらめ)' },
        { dictionaryName: 'CC100', value: '74334 (そらめ)' },
        { dictionaryName: 'Invalid', value: 'N/A' },
    ];

    assert.equal(getLowestFrequencyFromFrequencies(frequencies), '74334');
});

test('getHarmonicMeanFrequencyFromFrequencies ignores invalid and non-positive values', () => {
    const frequencies = [
        { dictionaryName: 'A', value: '100 rank' },
        { dictionaryName: 'B', value: '200 rank' },
        { dictionaryName: 'Zero', value: '0 rank' },
        { dictionaryName: 'Invalid', value: 'N/A' },
    ];

    assert.equal(getHarmonicMeanFrequencyFromFrequencies(frequencies), '133'); // floor(2 / (1/100 + 1/200))
});

test('getHarmonicMeanFrequencyFromFrequencies follows Yomitan leading-digit parsing', () => {
    const frequencies = [
        { dictionaryName: 'A', value: '100 valid' },
        { dictionaryName: 'B', value: 'prefix 200 invalid' },
        { dictionaryName: 'C', value: '300' },
    ];

    // Yomitan only parses digits at start of display value.
    // So B should be ignored here.
    assert.equal(getHarmonicMeanFrequencyFromFrequencies(frequencies), '150');
});

test('getHarmonicMeanFrequencyFromFrequencies uses only the first consecutive frequency per dictionary', () => {
    const frequencies = [
        { dictionaryName: 'A', value: '100' },
        { dictionaryName: 'A', value: '9999' },
        { dictionaryName: 'B', value: '400' },
    ];

    // Mirrors Yomitan previousDictionary logic.
    assert.equal(getHarmonicMeanFrequencyFromFrequencies(frequencies), '160');
});

test('applyPerEntryHarmonicMean computes harmonic value per entry (not global across results)', () => {
    const entries = [
        {
            id: 'entry-1',
            frequencies: [
                { dictionaryName: 'A', value: '100' },
                { dictionaryName: 'B', value: '400' },
            ],
        },
        {
            id: 'entry-2',
            frequencies: [
                { dictionaryName: 'A', value: '1000' },
                { dictionaryName: 'B', value: '2000' },
            ],
        },
    ];

    const processed = applyPerEntryHarmonicMean(entries);

    assert.deepEqual(processed[0].frequencies, [{ dictionaryName: HARMONIC_MEAN_DICTIONARY_NAME, value: '160' }]);
    assert.deepEqual(processed[1].frequencies, [{ dictionaryName: HARMONIC_MEAN_DICTIONARY_NAME, value: '1333' }]);
});

test('applyPerEntryHarmonicMean keeps entries with unusable frequencies stable', () => {
    const entries = [
        {
            id: 'entry-1',
            frequencies: [
                { dictionaryName: 'A', value: 'N/A' },
                { dictionaryName: 'B', value: '0' },
            ],
        },
        {
            id: 'entry-2',
            frequencies: [],
        },
    ];

    const processed = applyPerEntryHarmonicMean(entries);
    assert.equal(processed[0], entries[0]);
    assert.equal(processed[1], entries[1]);
});
