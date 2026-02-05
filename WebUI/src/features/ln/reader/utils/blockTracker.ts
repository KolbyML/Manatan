
export interface BlockTrackerOptions {
    /** Vertical writing mode (Japanese RTL) */
    isVertical: boolean;

    /** Paged mode (vs continuous scroll) */
    isPaged: boolean;

    /** Callback when active block changes */
    onActiveBlockChange: (blockId: string, element: Element) => void;

    /** Optional: Callback for any intersection change (for debugging) */
    onIntersectionChange?: (entries: IntersectionObserverEntry[]) => void;
}

export interface BlockVisibility {
    blockId: string;
    element: Element;
    ratio: number;
    isVisible: boolean;
}

export class BlockTracker {
    private observer: IntersectionObserver | null = null;
    private activeBlockId: string | null = null;
    private visibilityMap: Map<string, BlockVisibility> = new Map();
    private isRunning: boolean = false;

    constructor(
        private container: HTMLElement,
        private options: BlockTrackerOptions
    ) { }

    /**
     * Start tracking blocks in the container
     */
    start(): void {
        this.stop();
        this.isRunning = true;

        // Configure root margin based on reading direction
        // For vertical: track blocks near the right edge (reading start)
        // For horizontal: track blocks near the top edge (reading start)
        const rootMargin = this.options.isVertical
            ? '0px 0px 0px -85%'  // Only count blocks in rightmost 15%
            : '0px 0px -85% 0px'; // Only count blocks in topmost 15%

        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: this.options.isPaged ? null : this.container,
                rootMargin,
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
            }
        );

        // Observe all blocks in container
        const blocks = this.container.querySelectorAll('[data-block-id]');
        blocks.forEach(block => {
            this.observer?.observe(block);
        });

        console.log(`[BlockTracker] Started tracking ${blocks.length} blocks`);
    }

    /**
     * Stop tracking and clean up
     */
    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.visibilityMap.clear();
        this.activeBlockId = null;
        this.isRunning = false;
    }

    /**
     * Handle intersection changes
     */
    private handleIntersection(entries: IntersectionObserverEntry[]): void {
        // Update visibility map
        entries.forEach(entry => {
            const blockId = entry.target.getAttribute('data-block-id');
            if (!blockId) return;

            this.visibilityMap.set(blockId, {
                blockId,
                element: entry.target,
                ratio: entry.intersectionRatio,
                isVisible: entry.isIntersecting,
            });
        });

        // Optional debug callback
        this.options.onIntersectionChange?.(entries);

        // Find the best (most visible) block
        const bestBlock = this.findBestVisibleBlock();

        if (bestBlock && bestBlock.blockId !== this.activeBlockId) {
            this.activeBlockId = bestBlock.blockId;
            this.options.onActiveBlockChange(bestBlock.blockId, bestBlock.element);
        }
    }

    /**
     * Find the most visible block at reading position
     */
    private findBestVisibleBlock(): BlockVisibility | null {
        let best: BlockVisibility | null = null;
        let bestScore = -1;

        this.visibilityMap.forEach(visibility => {
            if (!visibility.isVisible) return;

            // Score is based on intersection ratio
            // Could add more sophisticated scoring based on position
            const score = visibility.ratio;

            if (score > bestScore) {
                bestScore = score;
                best = visibility;
            }
        });

        return best;
    }

    /**
     * Get current active block ID
     */
    getCurrentBlockId(): string | null {
        return this.activeBlockId;
    }

    /**
     * Get current active block element
     */
    getCurrentBlockElement(): Element | null {
        if (!this.activeBlockId) return null;
        return this.container.querySelector(`[data-block-id="${this.activeBlockId}"]`);
    }

    /**
     * Force update - useful after layout changes
     */
    refresh(): void {
        if (!this.isRunning) return;

        // Re-observe all blocks (in case new ones were added)
        const blocks = this.container.querySelectorAll('[data-block-id]');
        blocks.forEach(block => {
            this.observer?.observe(block);
        });
    }

    /**
     * Manually set active block (for restoration)
     */
    setActiveBlock(blockId: string): boolean {
        const element = this.container.querySelector(`[data-block-id="${blockId}"]`);
        if (element) {
            this.activeBlockId = blockId;
            return true;
        }
        return false;
    }

    /**
     * Get all visible blocks (for debugging)
     */
    getVisibleBlocks(): BlockVisibility[] {
        return Array.from(this.visibilityMap.values())
            .filter(v => v.isVisible)
            .sort((a, b) => b.ratio - a.ratio);
    }

    /**
     * Check if tracker is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}

/**
 * Create a simple block tracker for one-time position detection
 * Useful for getting current position without continuous tracking
 */
export function detectCurrentBlock(
    container: HTMLElement,
    isVertical: boolean
): { blockId: string; element: Element } | null {
    const blocks = container.querySelectorAll('[data-block-id]');
    if (blocks.length === 0) return null;

    const containerRect = container.getBoundingClientRect();

    // Reading position: right edge for vertical, top edge for horizontal
    const readingEdge = isVertical
        ? containerRect.right - 50  // 50px from right edge
        : containerRect.top + 50;   // 50px from top

    let bestBlock: Element | null = null;
    let bestDistance = Infinity;

    blocks.forEach(block => {
        const rect = block.getBoundingClientRect();

        // Check if block is in viewport
        const isVisible = isVertical
            ? rect.right > containerRect.left && rect.left < containerRect.right
            : rect.bottom > containerRect.top && rect.top < containerRect.bottom;

        if (!isVisible) return;

        // Calculate distance to reading edge
        const blockEdge = isVertical ? rect.right : rect.top;
        const distance = Math.abs(blockEdge - readingEdge);

        if (distance < bestDistance) {
            bestDistance = distance;
            bestBlock = block;
        }
    });

    if (bestBlock) {
        const blockId = bestBlock.getAttribute('data-block-id');
        if (blockId) {
            return { blockId, element: bestBlock };
        }
    }

    return null;
}