import { LNHighlight } from '@/lib/storage/AppStorage';

export function injectHighlightsIntoHtml(
    html: string,
    highlights: LNHighlight[]
): string {
    if (highlights.length === 0) {
        return html;
    }

    const highlightsByBlock = new Map<string, LNHighlight[]>();
    for (const h of highlights) {
        const list = highlightsByBlock.get(h.blockId) ?? [];
        list.push(h);
        highlightsByBlock.set(h.blockId, list);
    }

    let result = html;

    for (const [blockId, blockHighlights] of highlightsByBlock) {
        const blockStart = result.indexOf(`data-block-id="${blockId}"`);
        if (blockStart === -1) continue;

        const blockEnd = result.indexOf('>', blockStart);
        if (blockEnd === -1) continue;

        const beforeBlock = result.slice(0, blockEnd + 1);
        const afterBlock = result.slice(blockEnd + 1);

        let blockContent = afterBlock;

        for (const hl of blockHighlights) {
            const { text, id } = hl;
            
            const searchText = text.slice(0, 50);
            const textIndex = blockContent.indexOf(searchText);
            
            if (textIndex !== -1) {
                const before = blockContent.slice(0, textIndex);
                const matched = blockContent.slice(textIndex, textIndex + text.length);
                const after = blockContent.slice(textIndex + text.length);
                
                blockContent = before + `<mark class="highlight" data-highlight-id="${id}">${matched}</mark>` + after;
            }
        }

        result = beforeBlock + blockContent;
    }

    return result;
}
