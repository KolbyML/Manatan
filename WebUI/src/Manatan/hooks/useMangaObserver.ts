import { useEffect, useState } from 'react';
import { useOCR } from '@/Manatan/context/OCRContext';

export const useMangaObserver = () => {
    const { settings } = useOCR();
    const [images, setImages] = useState<HTMLImageElement[]>([]);

    useEffect(() => {
        const { imageContainerSelectors: selectors } = settings.site;

        const scan = () => {
            const found: HTMLImageElement[] = [];

            selectors.forEach((sel) => {
                const nodes = document.querySelectorAll(sel);
                nodes.forEach((node) => {
                    if (node instanceof HTMLImageElement) found.push(node);
                    else node.querySelectorAll('img').forEach((img) => found.push(img));
                });
            });

            if (found.length === 0) {
                document.querySelectorAll('img[src*="/chapter/"]').forEach((img) => {
                    if (img instanceof HTMLImageElement && img.naturalHeight > 400) found.push(img);
                });
            }

            const unique = Array.from(new Set(found)).filter((img) => {
                if (!img.isConnected || img.naturalHeight <= 200) return false;
                
                if (img.src.includes('thumbnail')) return false;

                // Exclude cropper images
                if (img.closest('.ReactCrop')) {
                    return false;
                }

                return true;
            });

            setImages((prev) => {
                if (prev.length === unique.length && prev.every((img, i) => img.src === unique[i].src)) return prev;
                return unique;
            });
        };

        scan();

        const observer = new MutationObserver((mutations) => {
            if (mutations.some((m) => m.addedNodes.length > 0 || m.attributeName === 'src')) scan();
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

        return () => observer.disconnect();
    }, [settings.site, settings.debugMode]);

    return images;
};
