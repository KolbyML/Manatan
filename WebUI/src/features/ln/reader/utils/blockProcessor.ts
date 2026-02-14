import { Block, BlockIndexMap, ChapterBlockInfo, BlockType } from '../types/block';

// ============================================================================
// Constants
// ============================================================================

const NON_COUNTABLE_REGEX = /[\s\u200B-\u200D\uFEFF\u00A0\t\r\n\p{P}\p{S}]+/gu;

// Primary block selectors (high priority)
const PRIMARY_SELECTORS = [
    'p',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote',
    'pre',
];

// Secondary block selectors (medium priority)
const SECONDARY_SELECTORS = [
    'li',
    'figcaption',
    'caption',
    'th',
    'td',
];

// Container selectors that might contain blocks
const CONTAINER_SELECTORS = [
    'div',
    'section',
    'article',
    'figure',
];

// Elements to skip entirely
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'rt', 'rp', 'ruby']);

// Minimum character length to consider a block "significant"
const SIGNIFICANT_BLOCK_THRESHOLD = 50;

// ============================================================================
// Character Counting
// ============================================================================

/**
 * Get clean character count from text
 * Removes only whitespace, keeps ALL other characters (punctuation, letters, numbers)
 */
export function getCleanCharacterCount(text: string): number {
    if (!text) return 0;
    const clean = text.replace(NON_COUNTABLE_REGEX, '');
    return Array.from(clean).length;
}

/**
 * Get clean text content from an element (excludes ruby annotations)
 */
export function getCleanTextContent(element: Element | Node): string {
    if (element.nodeType === Node.TEXT_NODE) {
        return (element.textContent || '').trim();
    }

    const el = element as Element;
    const clone = el.cloneNode(true) as Element;

    // Remove ruby annotations (rt, rp)
    clone.querySelectorAll('rt, rp').forEach(node => node.remove());

    return (clone.textContent || '').trim();
}

// ============================================================================
// Block Detection
// ============================================================================

interface BlockCandidate {
    element: Element;
    priority: number; // Higher = better
    depth: number;    // DOM depth
}

/**
 * Find all block candidates in a document
 */
function findBlockCandidates(doc: Document): BlockCandidate[] {
    const candidates: BlockCandidate[] = [];
    const seen = new WeakSet<Element>();

    // Helper to add candidate
    const addCandidate = (el: Element, priority: number, depth: number) => {
        if (seen.has(el)) return;
        if (SKIP_TAGS.has(el.tagName.toLowerCase())) return;
        if (el.closest('rt, rp')) return;

        seen.add(el);
        candidates.push({ element: el, priority, depth });
    };

    // Helper to calculate depth
    const getDepth = (el: Element): number => {
        let depth = 0;
        let current: Element | null = el;
        while (current) {
            depth++;
            current = current.parentElement;
        }
        return depth;
    };

    // 1. Find primary selectors (highest priority)
    PRIMARY_SELECTORS.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
            addCandidate(el, 100, getDepth(el));
        });
    });

    // 2. Find secondary selectors
    SECONDARY_SELECTORS.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
            addCandidate(el, 50, getDepth(el));
        });
    });

    // 3. Find divs with text content (but not containers of other blocks)
    doc.querySelectorAll('div').forEach(div => {
        // Skip if already added
        if (seen.has(div)) return;

        // Skip if contains other block elements
        const hasChildBlocks = PRIMARY_SELECTORS.some(sel => div.querySelector(sel));
        if (hasChildBlocks) return;

        // Check if has direct text content
        const text = getCleanTextContent(div);
        if (text.length > 0) {
            addCandidate(div, 30, getDepth(div));
        }
    });

    // 4. Find figure/image containers
    doc.querySelectorAll('figure, div.image-only-chapter, div[class*="image"], div[class*="img"]').forEach(el => {
        if (!seen.has(el)) {
            addCandidate(el, 20, getDepth(el));
        }
    });

    // 5. Find standalone images
    doc.querySelectorAll('img, svg, image').forEach(img => {
        const parent = img.parentElement;
        if (parent && !seen.has(parent)) {
            // Use parent as block
            addCandidate(parent, 10, getDepth(parent));
        }
    });

    return candidates;
}

/**
 * Filter out nested blocks (keep only outermost in each branch)
 */
function filterNestedBlocks(candidates: BlockCandidate[]): BlockCandidate[] {
    const result: BlockCandidate[] = [];

    // Sort by depth (shallowest first)
    const sorted = [...candidates].sort((a, b) => a.depth - b.depth);

    const covered = new WeakSet<Element>();

    for (const candidate of sorted) {
        // Check if this element is inside an already-covered element
        let isNested = false;
        let parent = candidate.element.parentElement;

        while (parent) {
            if (covered.has(parent)) {
                isNested = true;
                break;
            }
            parent = parent.parentElement;
        }

        if (!isNested) {
            result.push(candidate);
            covered.add(candidate.element);
        }
    }

    return result;
}

/**
 * Sort blocks in document order
 */
function sortInDocumentOrder(candidates: BlockCandidate[]): BlockCandidate[] {
    return candidates.sort((a, b) => {
        const position = a.element.compareDocumentPosition(b.element);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
    });
}

// ============================================================================
// Main Processing
// ============================================================================

/**
 * Check if an element contains images
 */
function hasImages(element: Element): boolean {
    return element.querySelector('img, svg, image') !== null ||
        element.tagName.toLowerCase() === 'img';
}

/**
 * Check if an element has furigana
 */
function hasFurigana(element: Element): boolean {
    return element.querySelector('ruby, rt') !== null;
}

/**
 * Generate a CSS selector path for an element
 */
function getElementPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
            selector += `#${current.id}`;
        } else if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => c);
            if (classes.length > 0) {
                selector += `.${classes[0]}`;
            }
        }

        // Add nth-of-type for uniqueness
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                c => c.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
            }
        }

        parts.unshift(selector);
        current = current.parentElement;
    }

    return parts.join(' > ');
}

/**
 * Process chapter HTML to inject block IDs and build index map
 */
export function processChapterHTML(
    html: string,
    chapterIndex: number
): {
    processedHtml: string;
    blockMap: BlockIndexMap[];
    chapterBlockInfo: ChapterBlockInfo;
} {
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all block candidates
    let candidates = findBlockCandidates(doc);

    // Filter out nested blocks
    candidates = filterNestedBlocks(candidates);

    // Sort in document order
    candidates = sortInDocumentOrder(candidates);

    // Build blocks array
    const blocks: Block[] = [];
    let totalChars = 0;
    let blockOrder = 0;

    for (const candidate of candidates) {
        const el = candidate.element;

        // Get clean text (without ruby annotations)
        const cleanText = getCleanTextContent(el);
        const cleanCharCount = getCleanCharacterCount(cleanText);

        // Determine block type
        const tagName = el.tagName.toLowerCase();
        const blockType: BlockType = PRIMARY_SELECTORS.includes(tagName) ||
            SECONDARY_SELECTORS.includes(tagName)
            ? tagName as BlockType
            : 'div';

        // Generate block ID
        const blockId = `ch${chapterIndex}-b${blockOrder}`;

        // Inject the block ID as a data attribute
        el.setAttribute('data-block-id', blockId);

        // Determine if this is a significant block (for reading progress)
        const isSignificant = cleanCharCount >= SIGNIFICANT_BLOCK_THRESHOLD;
        const containsImages = hasImages(el);
        const containsFurigana = hasFurigana(el);

        // Create block entry
        const block: Block = {
            id: blockId,
            type: blockType,
            order: blockOrder,
            height: 0, // Will be measured at runtime
            cleanCharCount,
            cleanCharStart: totalChars,
        };

        // Store additional metadata (extend the interface if needed)
        (block as any).isSignificant = isSignificant;
        (block as any).hasImages = containsImages;
        (block as any).hasFurigana = containsFurigana;
        (block as any).elementPath = getElementPath(el);
        (block as any).textPreview = cleanText.substring(0, 100);

        blocks.push(block);
        totalChars += cleanCharCount;
        blockOrder++;
    }

    // ========================================================================
    // FALLBACK: If no blocks found, create one for the entire body
    // ========================================================================
    if (blocks.length === 0) {
        const body = doc.body;
        const cleanText = getCleanTextContent(body);
        const cleanCharCount = getCleanCharacterCount(cleanText);
        const containsImages = hasImages(body);

        // Create a wrapper div for the entire content
        const wrapper = doc.createElement('div');
        const blockId = `ch${chapterIndex}-b0`;
        wrapper.setAttribute('data-block-id', blockId);

        // Move all body content into wrapper
        while (body.firstChild) {
            wrapper.appendChild(body.firstChild);
        }
        body.appendChild(wrapper);

        const block: Block = {
            id: blockId,
            type: 'div',
            order: 0,
            height: 0,
            cleanCharCount,
            cleanCharStart: 0,
        };

        (block as any).isSignificant = cleanCharCount >= SIGNIFICANT_BLOCK_THRESHOLD;
        (block as any).hasImages = containsImages;
        (block as any).hasFurigana = hasFurigana(body);
        (block as any).isFallback = true;
        (block as any).textPreview = cleanText.substring(0, 100) || '[No text content]';

        blocks.push(block);
        totalChars = cleanCharCount;

        console.log(`[BlockProcessor] Chapter ${chapterIndex}: No blocks found, created fallback block (${cleanCharCount} chars, hasImages: ${containsImages})`);
    }

    // Log summary
    const significantBlocks = blocks.filter(b => (b as any).isSignificant).length;
    const imageBlocks = blocks.filter(b => (b as any).hasImages).length;

    if (blocks.length > 0) {
        console.log(`[BlockProcessor] Chapter ${chapterIndex}: ${blocks.length} blocks, ${totalChars} chars, ${significantBlocks} significant, ${imageBlocks} with images`);
    }

    // Convert to flat BlockIndexMap format
    const blockIndexMap: BlockIndexMap[] = blocks.map(block => ({
        blockId: block.id,
        startOffset: block.cleanCharStart,
        endOffset: block.cleanCharStart + block.cleanCharCount,
    }));

    // Also return chapter block info for local processing
    const chapterBlockInfo: ChapterBlockInfo = {
        blocks,
        totalChars,
        chapterIndex,
    };

    return {
        processedHtml: doc.body.innerHTML,
        blockMap: blockIndexMap,
        chapterBlockInfo,
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find a block by ID in chapter block info
 */
export function findBlockById(chapterInfo: ChapterBlockInfo, blockId: string): Block | undefined {
    return chapterInfo.blocks.find(b => b.id === blockId);
}

/**
 * Find block containing a specific character offset within the chapter
 */
export function findBlockAtCharOffset(
    chapterInfo: ChapterBlockInfo,
    charOffset: number
): Block | undefined {
    for (const block of chapterInfo.blocks) {
        const blockEnd = block.cleanCharStart + block.cleanCharCount;
        if (charOffset >= block.cleanCharStart && charOffset < blockEnd) {
            return block;
        }
    }

    // If past all blocks, return last block
    if (chapterInfo.blocks.length > 0 && charOffset >= chapterInfo.totalChars) {
        return chapterInfo.blocks[chapterInfo.blocks.length - 1];
    }

    return chapterInfo.blocks[0]; // Return first block as fallback
}

/**
 * Calculate character offset from block ID and local offset
 */
export function calculateCharOffsetFromBlock(
    chapterInfo: ChapterBlockInfo,
    blockId: string,
    localOffset: number
): number {
    const block = findBlockById(chapterInfo, blockId);
    if (!block) return 0;

    return block.cleanCharStart + Math.min(localOffset, block.cleanCharCount);
}

/**
 * Get the first significant block in a chapter
 */
export function getFirstSignificantBlock(chapterInfo: ChapterBlockInfo): Block | undefined {
    return chapterInfo.blocks.find(b => (b as any).isSignificant) || chapterInfo.blocks[0];
}

/**
 * Check if a chapter is image-only
 */
export function isImageOnlyChapter(chapterInfo: ChapterBlockInfo): boolean {
    if (chapterInfo.blocks.length === 0) return false;

    const hasText = chapterInfo.totalChars > 50;
    const hasImages = chapterInfo.blocks.some(b => (b as any).hasImages);

    return !hasText && hasImages;
}

/**
 * Debug: Log block map statistics
 */
export function logBlockMapStats(chapterInfo: ChapterBlockInfo): void {
    const totalBlocks = chapterInfo.blocks.length;
    const significantBlocks = chapterInfo.blocks.filter(b => (b as any).isSignificant).length;
    const imageBlocks = chapterInfo.blocks.filter(b => (b as any).hasImages).length;

    console.log(`[BlockMap Stats] Chapter ${chapterInfo.chapterIndex}:`, {
        totalBlocks,
        significantBlocks,
        imageBlocks,
        totalChars: chapterInfo.totalChars,
    });
}