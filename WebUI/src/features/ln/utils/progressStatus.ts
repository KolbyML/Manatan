export const NOVEL_COMPLETE_PROGRESS_THRESHOLD_PERCENT = 99.5;

export function isNovelProgressComplete(totalProgress?: number | null): boolean {
    if (!Number.isFinite(totalProgress)) {
        return false;
    }
    return Number(totalProgress) >= NOVEL_COMPLETE_PROGRESS_THRESHOLD_PERCENT;
}
