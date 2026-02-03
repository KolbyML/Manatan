export interface NavigationOptions {
    isVertical: boolean;
    isRTL: boolean;
    isPaged: boolean;
}

export interface NavigationState {
    currentPage: number;
    totalPages: number;
    currentChapter: number;
    totalChapters: number;
    progress: number;
}

export interface NavigationCallbacks {
    goNext: () => void;
    goPrev: () => void;
    goToStart?: () => void;
    goToEnd?: () => void;
}

export interface TouchState {
    startX: number;
    startY: number;
    startTime: number;
}

export type ClickZone = 'prev' | 'next' | 'center';

/**
 * Create touch state from touch event
 */
export function createTouchState(event: TouchEvent): TouchState {
    return {
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startTime: Date.now(),
    };
}

/**
 * Get click zone based on click position
 */
export function getClickZone(
    event: { clientX: number; clientY: number },
    container: HTMLElement,
    options: NavigationOptions
): ClickZone {
    const { isVertical, isRTL } = options;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const zoneSize = 0.25; // 25% on each edge

    if (isVertical) {
        const leftZone = rect.width * zoneSize;
        const rightZone = rect.width * (1 - zoneSize);

        if (x < leftZone) {
            return isRTL ? 'next' : 'prev';
        }
        if (x > rightZone) {
            return isRTL ? 'prev' : 'next';
        }
        return 'center';
    } else {
        const topZone = rect.height * zoneSize;
        const bottomZone = rect.height * (1 - zoneSize);

        if (y < topZone) return 'prev';
        if (y > bottomZone) return 'next';
        return 'center';
    }
}

/**
 * Handle keyboard navigation
 */
export function handleKeyNavigation(
    event: KeyboardEvent,
    options: NavigationOptions,
    callbacks: NavigationCallbacks
): boolean {
    const { isVertical, isRTL, isPaged } = options;

    // Use event.code for physical key position (consistent across all browsers/keyboards)
    // Fall back to event.key for older browsers
    const keyCode = event.code || event.key;

    switch (keyCode) {
        // Left/Right arrows - use PHYSICAL key position
        case 'ArrowLeft':
        case 'KeyLeft': // Fallback for older browsers
            if (isVertical) {
                // Vertical text: left = forward (RTL) or backward (LTR)
                if (isRTL) callbacks.goNext();
                else callbacks.goPrev();
            } else {
                // Horizontal text: left = backward
                callbacks.goPrev();
            }
            return true;

        case 'ArrowRight':
        case 'KeyRight': // Fallback for older browsers
            if (isVertical) {
                // Vertical text: right = backward (RTL) or forward (LTR)
                if (isRTL) callbacks.goPrev();
                else callbacks.goNext();
            } else {
                // Horizontal text: right = forward
                callbacks.goNext();
            }
            return true;

        // Up/Down arrows
        case 'ArrowDown':
        case 'KeyDown': // Fallback for older browsers
            if (isVertical) {
                // Vertical text: down scrolls within column, not page navigation
                if (!isPaged) return false; // Let browser handle
                callbacks.goNext();
                return true;
            } else {
                // Horizontal: down = next
                if (!isPaged) return false; // Let browser handle continuous scroll
                callbacks.goNext();
                return true;
            }

        case 'ArrowUp':
        case 'KeyUp': // Fallback for older browsers
            if (isVertical) {
                if (!isPaged) return false;
                callbacks.goPrev();
                return true;
            } else {
                if (!isPaged) return false;
                callbacks.goPrev();
                return true;
            }

        case 'PageDown':
            callbacks.goNext();
            return true;

        case 'PageUp':
            callbacks.goPrev();
            return true;

        case 'Space':
        case ' ': // Handle both code and key for spacebar
            if (!event.shiftKey) callbacks.goNext();
            else callbacks.goPrev();
            return true;

        case 'Home':
            callbacks.goToStart?.();
            return true;

        case 'End':
            callbacks.goToEnd?.();
            return true;
    }

    return false;
}

/**
 * Handle mouse wheel navigation
 */
export function handleWheelNavigation(
    event: WheelEvent,
    options: NavigationOptions,
    callbacks: NavigationCallbacks
): boolean {
    const { isVertical, isRTL, isPaged } = options;

    // In continuous mode, let natural scroll happen
    if (!isPaged) return false;

    const delta = isVertical
        ? event.deltaX !== 0
            ? event.deltaX
            : event.deltaY
        : event.deltaY;

    if (Math.abs(delta) < 20) return false;

    if (isVertical && isRTL) {
        if (delta > 0) callbacks.goPrev();
        else callbacks.goNext();
    } else if (isVertical) {
        if (delta > 0) callbacks.goNext();
        else callbacks.goPrev();
    } else {
        if (delta > 0) callbacks.goNext();
        else callbacks.goPrev();
    }

    return true;
}

export function handleTouchEnd(
    event: TouchEvent,
    touchStart: TouchState,
    options: NavigationOptions,
    callbacks: NavigationCallbacks
): 'next' | 'prev' | null {
    const { isVertical } = options;

    const deltaX = event.changedTouches[0].clientX - touchStart.startX;
    const deltaY = event.changedTouches[0].clientY - touchStart.startY;
    const deltaTime = Date.now() - touchStart.startTime;

    const minDistance = 50;
    const maxTime = 500;

    if (deltaTime > maxTime) return null;

    if (isVertical) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minDistance) {
            if (deltaX > 0) {
                callbacks.goNext();
                return 'next';
            } else {
                callbacks.goPrev();
                return 'prev';
            }
        }
    } else {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minDistance) {

            if (deltaY > 0) {
                callbacks.goPrev();
                return 'next';
            } else {
                callbacks.goNext();
                return 'prev';
            }
        }
    }

    return null;
}

export function calculateTotalPages(container: HTMLElement, options: NavigationOptions): number {
    const { isVertical } = options;
    const pageSize = isVertical ? container.clientWidth : container.clientHeight;
    if (pageSize <= 0) return 1;
    const scrollSize = isVertical ? container.scrollWidth : container.scrollHeight;
    return Math.max(1, Math.ceil(scrollSize / pageSize));
}

export function getCurrentPage(container: HTMLElement, options: NavigationOptions): number {
    const { isVertical, isRTL } = options;
    const pageSize = isVertical ? container.clientWidth : container.clientHeight;
    if (pageSize <= 0) return 0;
    const maxScroll = isVertical ? container.scrollWidth - container.clientWidth : container.scrollHeight - container.clientHeight;
    const rawScroll = isVertical ? container.scrollLeft : container.scrollTop;
    const effectiveScroll = isVertical && isRTL ? Math.max(0, maxScroll - rawScroll) : rawScroll;
    const totalPages = calculateTotalPages(container, options);
    const page = Math.floor(effectiveScroll / pageSize);
    return Math.min(Math.max(page, 0), Math.max(0, totalPages - 1));
}

export function scrollToPage(container: HTMLElement, page: number, options: NavigationOptions): void {
    const { isVertical, isRTL } = options;
    const totalPages = calculateTotalPages(container, options);
    const maxPage = Math.max(0, totalPages - 1);
    const targetPage = Math.min(Math.max(page, 0), maxPage);
    const pageSize = isVertical ? container.clientWidth : container.clientHeight;
    const target = targetPage * pageSize;
    if (isVertical) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        const left = isRTL ? Math.max(0, maxScroll - target) : target;
        container.scrollTo({ left, behavior: 'smooth' });
    } else {
        container.scrollTo({ top: target, behavior: 'smooth' });
    }
}

export function navigateNext(container: HTMLElement, options: NavigationOptions, currentPage: number): void {
    scrollToPage(container, currentPage + 1, options);
}

export function navigatePrev(container: HTMLElement, options: NavigationOptions, currentPage: number): void {
    scrollToPage(container, currentPage - 1, options);
}

export function navigateToStart(container: HTMLElement, options: NavigationOptions): void {
    scrollToStart(container, options);
}

export function navigateToEnd(container: HTMLElement, options: NavigationOptions): void {
    scrollToEnd(container, options);
}

/**
 * Scroll container to start position
 */
export function scrollToStart(container: HTMLElement, options: NavigationOptions): void {
    const { isVertical, isRTL } = options;

    if (isVertical && isRTL) {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
    } else if (isVertical) {
        container.scrollLeft = 0;
    } else {
        container.scrollTop = 0;
    }
}

/**
 * Scroll container to end position
 */
export function scrollToEnd(container: HTMLElement, options: NavigationOptions): void {
    const { isVertical, isRTL } = options;

    if (isVertical && isRTL) {
        container.scrollLeft = 0;
    } else if (isVertical) {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
    } else {
        container.scrollTop = container.scrollHeight - container.clientHeight;
    }
}

/**
 * Scroll by viewport amount
 */
export function scrollByViewport(
    container: HTMLElement,
    options: NavigationOptions,
    forward: boolean,
    amount: number = 0.85
): void {
    const { isVertical, isRTL } = options;

    if (isVertical) {
        const scrollAmount = container.clientWidth * amount;
        let delta: number;

        if (isRTL) {
            delta = forward ? -scrollAmount : scrollAmount;
        } else {
            delta = forward ? scrollAmount : -scrollAmount;
        }

        container.scrollBy({ left: delta, behavior: 'smooth' });
    } else {
        const scrollAmount = container.clientHeight * amount;
        container.scrollBy({
            top: forward ? scrollAmount : -scrollAmount,
            behavior: 'smooth',
        });
    }
}

/**
 * Calculate reading progress percentage
 */
export function calculateProgress(
    container: HTMLElement,
    options: NavigationOptions
): number {
    const { isVertical, isRTL } = options;

    if (isVertical) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll <= 0) return 100;

        if (isRTL) {
            return Math.round((1 - container.scrollLeft / maxScroll) * 100);
        } else {
            return Math.round((container.scrollLeft / maxScroll) * 100);
        }
    } else {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 0) return 100;
        return Math.round((container.scrollTop / maxScroll) * 100);
    }
}
