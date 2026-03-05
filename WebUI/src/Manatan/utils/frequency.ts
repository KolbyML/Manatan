export type FrequencyLike = {
    dictionaryName?: string;
    dictionary?: string;
    value?: string | null;
    frequency?: number | null;
};

type EntryWithFrequencies = {
    frequencies?: FrequencyLike[] | null;
};

export const HARMONIC_MEAN_DICTIONARY_NAME = 'Harmonic Mean';

const parseLeadingPositiveInt = (value: string | null | undefined): number | null => {
    if (!value) {
        return null;
    }
    const match = value.match(/^\d+/);
    if (match === null) {
        return null;
    }
    const parsed = parseInt(match[0], 10);
    return parsed > 0 ? parsed : null;
};

const getYomitanFrequencyNumbers = (frequencies: FrequencyLike[] | null | undefined): number[] => {
    if (!frequencies?.length) {
        return [];
    }

    const results: number[] = [];
    let previousDictionary: string | undefined;

    for (const frequency of frequencies) {
        const dictionary = frequency.dictionaryName ?? frequency.dictionary;
        const isDuplicateDictionary = Boolean(dictionary && dictionary === previousDictionary);
        if (!isDuplicateDictionary) {
            previousDictionary = dictionary;

            const parsedDisplay = parseLeadingPositiveInt(frequency.value);
            if (parsedDisplay !== null) {
                results.push(parsedDisplay);
            } else {
                const rawFrequency = typeof frequency.frequency === 'number' ? frequency.frequency : null;
                if (rawFrequency !== null && Number.isFinite(rawFrequency) && rawFrequency > 0) {
                    results.push(rawFrequency);
                }
            }
        }
    }

    return results;
};

export const calculateHarmonicMeanFromNumbers = (numbers: number[]): number | null => {
    if (!numbers.length) {
        return null;
    }
    const sumOfReciprocals = numbers.reduce((sum, value) => sum + 1 / value, 0);
    return Math.floor(numbers.length / sumOfReciprocals);
};

export const calculateHarmonicMeanFromFrequencies = (
    frequencies: FrequencyLike[] | null | undefined,
): number | null => {
    const numbers = getYomitanFrequencyNumbers(frequencies);
    return calculateHarmonicMeanFromNumbers(numbers);
};

export const getLowestFrequencyFromFrequencies = (frequencies: FrequencyLike[] | null | undefined): string => {
    if (!frequencies?.length) {
        return '';
    }
    const numbers = frequencies
        .map((frequency) => {
            const cleaned = frequency.value?.replace?.(/[^\d]/g, '') ?? '';
            return parseInt(cleaned, 10);
        })
        .filter((value) => Number.isFinite(value));
    if (!numbers.length) {
        return '';
    }
    return Math.min(...numbers).toString();
};

export const getHarmonicMeanFrequencyFromFrequencies = (frequencies: FrequencyLike[] | null | undefined): string => {
    const harmonicMean = calculateHarmonicMeanFromFrequencies(frequencies);
    return harmonicMean === null ? '' : harmonicMean.toString();
};

export const applyPerEntryHarmonicMean = <T extends EntryWithFrequencies>(entries: T[]): T[] =>
    entries.map((entry) => {
        const harmonicMean = calculateHarmonicMeanFromFrequencies(entry.frequencies);
        if (harmonicMean === null) {
            return entry;
        }
        return {
            ...entry,
            frequencies: [{ dictionaryName: HARMONIC_MEAN_DICTIONARY_NAME, value: harmonicMean.toString() }],
        };
    });
