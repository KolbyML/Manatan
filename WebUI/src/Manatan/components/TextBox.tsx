import React, { useCallback, useRef, useState, useLayoutEffect, useEffect, memo } from 'react';
import { COLOR_THEMES, OcrBlock } from '@/Manatan/types';
import { useOCR } from '@/Manatan/context/OCRContext';
import { cleanPunctuation, lookupYomitan } from '@/Manatan/utils/api';
import { isNoSpaceLanguage } from '@/Manatan/utils/language';
import { updateLastCard } from '@/Manatan/utils/anki';
import { CropperModal } from '@/Manatan/components/CropperModal';
import { createPortal } from 'react-dom';
import { makeToast } from '@/base/utils/Toast';

const calculateFontSize = (text: string, w: number, h: number, isVertical: boolean, settings: any) => {
    const lines = text.split('\n');
    const lineCount = lines.length || 1;
    const maxLineLength = Math.max(...lines.map((l) => l.length)) || 1;
    let size = 16;
    const safeW = w * 0.85;
    const safeH = h * 0.85;

    if (isVertical) {
        const maxFontSizeByWidth = safeW / lineCount;
        const maxFontSizeByHeight = safeH / maxLineLength;
        size = Math.min(maxFontSizeByWidth, maxFontSizeByHeight);
        size *= settings.fontMultiplierVertical;
    } else {
        const maxFontSizeByHeight = safeH / lineCount;
        const maxFontSizeByWidth = safeW / maxLineLength;
        size = Math.min(maxFontSizeByHeight, maxFontSizeByWidth);
        size *= settings.fontMultiplierHorizontal;
    }
    
    // Lower minimum font size for mobile to prevent overflow in small bubbles
    const minSize = settings.mobileMode ? 5 : 10;
    return Math.max(minSize, Math.min(size, 200));
};

export const TextBox: React.FC<{
    block: OcrBlock;
    index: number;
    imgSrc: string;
    spreadData?: { leftSrc: string; rightSrc: string };
    containerWidth: number;
    containerHeight: number;
    onUpdate: (idx: number, txt: string) => void;
    onMerge: (src: number, target: number) => void;
    onDelete: (idx: number) => void;
    parentVisible?: boolean; 
}> = memo(({ block, index, imgSrc, spreadData, containerWidth, containerHeight, onUpdate, onMerge, onDelete, parentVisible = true }) => {
    const { 
        settings,
        setSettings,
        mergeAnchor,
        setMergeAnchor,
        setDictPopup,
        dictPopup,
        wasPopupClosedRecently,
        showDialog,
        showProgress,
        closeDialog,
    } = useOCR();
    const [isEditing, setIsEditing] = useState(false);
    const [isActive, setIsActive] = useState(false); 
    const [isLocalHover, setIsLocalHover] = useState(false); 
    const [fontSize, setFontSize] = useState(16);
    const [showCropper, setShowCropper] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<number | null>(null);
    const longPressTriggered = useRef(false);
    const touchStartPoint = useRef<{ x: number; y: number } | null>(null);

    const justActivated = useRef(false);
    const dictPopupRef = useRef(dictPopup.visible);
    useEffect(() => { dictPopupRef.current = dictPopup.visible; }, [dictPopup.visible]);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    useEffect(() => {
        if (!contextMenu) {
            return;
        }
        const handleClose = () => setContextMenu(null);
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setContextMenu(null);
            }
        };
        window.addEventListener('resize', handleClose);
        window.addEventListener('scroll', handleClose, true);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('resize', handleClose);
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu]);

    const prefersVertical =
        settings.yomitanLanguage === 'japanese'
        || settings.yomitanLanguage === 'chinese'
        || settings.yomitanLanguage === 'cantonese';
    const trimmedText = block.text.replace(/\s+/g, '');
    const charCount = trimmedText.length;
    const verticalByGeometry = prefersVertical
        && (charCount <= 1
            ? block.tightBoundingBox.height > block.tightBoundingBox.width * 0.8
            : block.tightBoundingBox.height > block.tightBoundingBox.width);
    const isVertical = block.forcedOrientation
        ? block.forcedOrientation === 'vertical'
        : verticalByGeometry;

    const adj = settings.boundingBoxAdjustment || 0;

    // --- COLOR THEME LOGIC ---
    const theme = COLOR_THEMES[settings.colorTheme] || COLOR_THEMES.white;
    const isDarkTheme = settings.colorTheme === 'dark';
    const isWhiteTheme = settings.colorTheme === 'white';

    // Background Color Logic
    const bgColor = isDarkTheme 
        ? '#1a1d21' 
        : (isWhiteTheme ? '#ffffff' : theme.background);

    // Active Background Logic
    // Dark Theme: slightly lighter dark
    // Other Themes: Theme background (or white if White theme)
    const activeBgColor = isDarkTheme 
        ? '#2d3436' 
        : (isWhiteTheme ? '#ffffff' : theme.background);

    // Border Logic
    // White/Dark themes: use a neutral gray border unless active
    // Colored themes: Always use accent color for border (as per request to not use gray)
    const borderColor = (isWhiteTheme || isDarkTheme) 
        ? theme.accent 
        : theme.accent;

    const handleMouseUpFix = (e: React.MouseEvent) => {
        if (settings.mobileMode) return; 

        const wrapper = document.querySelector('.reader-zoom-wrapper');
        if (wrapper) {
            const event = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.clientX,
                clientY: e.clientY,
                buttons: 0
            });
            wrapper.dispatchEvent(event);
        }
    };

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const preventBrowserZoom = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        element.addEventListener('wheel', preventBrowserZoom, { passive: false });
        return () => element.removeEventListener('wheel', preventBrowserZoom);
    }, []);

    useLayoutEffect(() => {
        if (!ref.current) return;
        const pxW = block.tightBoundingBox.width * containerWidth;
        const pxH = block.tightBoundingBox.height * containerHeight;

        if (!isEditing) {
            const displayTxt = cleanPunctuation(block.text, !isNoSpaceLanguage(settings.yomitanLanguage)).replace(/\u200B/g, '\n');
            setFontSize(calculateFontSize(displayTxt, pxW + adj, pxH + adj, isVertical, settings));
        }
    }, [block, containerWidth, containerHeight, settings, isEditing, isVertical]);

    let displayContent = isEditing ? block.text : cleanPunctuation(block.text, !isNoSpaceLanguage(settings.yomitanLanguage));
    displayContent = displayContent.replace(/\u200B/g, '\n');

    useLayoutEffect(() => {
        const selection = window.getSelection();
        if (!selection) return;

        if (!dictPopup.visible) {
            if (isActive) selection.removeAllRanges();
            return;
        }

        const highlight = dictPopup.highlight;
        if (!highlight || highlight.imgSrc !== imgSrc || highlight.index !== index) {
            return;
        }

        const node = ref.current?.firstChild;

        if (node && node.nodeType === Node.TEXT_NODE) {
            try {
                const range = document.createRange();
                const start = Math.max(0, Math.min(highlight.startChar, node.textContent?.length || 0));
                const end = Math.max(0, Math.min(start + highlight.length, node.textContent?.length || 0));
                
                range.setStart(node, start);
                range.setEnd(node, end);
                
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                // Silently fail
            }
        }
    }, [dictPopup.visible, dictPopup.highlight, imgSrc, index, displayContent, isActive]);

    useEffect(() => {
        if (!isActive || !settings.mobileMode) return;
        
        const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Element;
            if (dictPopupRef.current || wasPopupClosedRecently()) return;
            if (target && (target.closest('.yomitan-popup') || target.closest('.yomitan-backdrop'))) {
                return; 
            }
            if (ref.current && !ref.current.contains(target as Node)) {
                setIsActive(false);
                setIsEditing(false);
            }
        };

        document.addEventListener('touchstart', handleGlobalClick);
        document.addEventListener('mousedown', handleGlobalClick);
        return () => {
            document.removeEventListener('touchstart', handleGlobalClick);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [isActive, settings.mobileMode, wasPopupClosedRecently]);

    useEffect(() => {
        if (!isActive && !isEditing && settings.mobileMode) {
             const raw = ref.current?.innerText || '';
             if (raw !== displayContent) {
                 onUpdate(index, raw.replace(/\n/g, '\u200B'));
             }
        }
    }, [isActive, isEditing, settings.mobileMode, index, onUpdate, displayContent]);

    const getTargetField = useCallback((type: 'Image' | 'Sentence') => {
        if (settings.ankiFieldMap) {
            const mapped = Object.keys(settings.ankiFieldMap).find(key => settings.ankiFieldMap![key] === type);
            if (mapped) return mapped;
        }
        return '';
    }, [settings.ankiFieldMap]);

    const getCleanSentence = useCallback(() => {
        const isNoSpace = isNoSpaceLanguage(settings.yomitanLanguage);
        const preserveSpaces = !isNoSpace;
        const joiner = isNoSpace ? '' : ' ';
        let content = cleanPunctuation(block.text, preserveSpaces);
        content = content.replace(/[\u200B\u000b\f\r\n]+/g, joiner);
        content = content.replace(/[\u0000-\u001f\u007f]/g, '');
        if (!isNoSpace) {
            content = content.replace(/\s{2,}/g, ' ').trim();
        }
        return content;
    }, [block.text, settings.yomitanLanguage]);

    const copyTextToClipboard = useCallback(async (text: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                makeToast('Copied to clipboard.', { variant: 'success', autoHideDuration: 1500 });
                return;
            }
        } catch (err) {
            console.warn('Clipboard write failed', err);
        }
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            makeToast('Copied to clipboard.', { variant: 'success', autoHideDuration: 1500 });
        } catch (err) {
            console.warn('Clipboard fallback failed', err);
            makeToast('Could not copy to clipboard.', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }, []);

    const handleCopySentence = useCallback(async () => {
        const content = getCleanSentence();
        if (!content) {
            makeToast('Nothing to copy.', 'warning');
            return;
        }
        await copyTextToClipboard(content);
        closeContextMenu();
    }, [closeContextMenu, copyTextToClipboard, getCleanSentence]);

    const handleCopyScreenshot = useCallback(async () => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imgSrc;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Image load failed'));
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Canvas unavailable');
            }
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error('Image conversion failed'));
                    }
                }, 'image/png');
            });
            const ClipboardItemCtor = (window as any).ClipboardItem;
            if (!navigator.clipboard?.write || !ClipboardItemCtor) {
                throw new Error('Clipboard image copy not supported');
            }
            await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
            makeToast('Screenshot copied to clipboard.', { variant: 'success', autoHideDuration: 1500 });
        } catch (err) {
            console.warn('Copy screenshot failed', err);
            makeToast('Could not copy screenshot.', 'error');
        } finally {
            closeContextMenu();
        }
    }, [closeContextMenu, imgSrc]);

    const updateAnkiCard = useCallback(async (croppedImage?: string) => {
        try {
            showProgress('Updating Anki card...');

            const imgField = getTargetField('Image');
            const sentField = getTargetField('Sentence');

            await updateLastCard(
                settings.ankiConnectUrl || 'http://127.0.0.1:8765',
                croppedImage ? undefined : imgSrc,
                getCleanSentence(),
                imgField || '',
                sentField || '',
                settings.ankiImageQuality || 0.92,
                croppedImage,
                undefined,
                undefined,
                settings.ankiDownscaleMaxWidth,
                settings.ankiDownscaleMaxHeight
            );

            closeDialog();
            makeToast('Anki card updated successfully!', { variant: 'success', autoHideDuration: 1500 });
        } catch (err: any) {
            closeDialog();
            makeToast('Failed to update Anki card', 'error', err.message);
        }
    }, [closeDialog, getCleanSentence, getTargetField, imgSrc, settings.ankiConnectUrl, settings.ankiImageQuality, showProgress]);

    const confirmAnkiUpdate = useCallback((action: () => void) => {
        if (settings.skipAnkiUpdateConfirm) {
            action();
            return;
        }
        showDialog({
            type: 'confirm',
            title: 'Update Anki Card?',
            message: 'This will overwrite the image and text of the last added card in Anki.',
            confirmText: 'Update',
            cancelText: 'Cancel',
            extraAction: settings.enableYomitan
                ? undefined
                : {
                    label: "Don't show again",
                    onClick: () => {
                        setSettings((prev) => ({ ...prev, skipAnkiUpdateConfirm: true }));
                        action();
                    },
                },
            onConfirm: action,
        });
    }, [setSettings, settings.enableYomitan, settings.skipAnkiUpdateConfirm, showDialog]);

    const handleAnkiRequest = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!settings.ankiConnectEnabled) {
            makeToast('AnkiConnect integration is disabled in settings.', 'warning');
            return;
        }

        if (settings.ankiEnableCropper) {
            setShowCropper(true);
        } else {
            confirmAnkiUpdate(() => {
                void updateAnkiCard();
            });
        }
    };

    const handleCropperComplete = async (croppedImage: string) => {
        setShowCropper(false);
        confirmAnkiUpdate(() => {
            void updateAnkiCard(croppedImage);
        });
    };

    const clearLongPressTimer = () => {
        if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!settings.mobileMode) return;
        const touch = e.touches[0];
        if (!touch) return;
        touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
        longPressTriggered.current = false;
        clearLongPressTimer();
        longPressTimer.current = window.setTimeout(() => {
            longPressTriggered.current = true;
            setContextMenu({ x: touch.clientX, y: touch.clientY });
            setIsActive(true);
            justActivated.current = true;
            setTimeout(() => {
                justActivated.current = false;
            }, 500);
        }, 550);

        if (!isActive) {
            setIsActive(true);
            justActivated.current = true;
            setTimeout(() => {
                justActivated.current = false;
            }, 500);
            if (e.cancelable) e.preventDefault();
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!settings.mobileMode || !touchStartPoint.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        const dx = touch.clientX - touchStartPoint.current.x;
        const dy = touch.clientY - touchStartPoint.current.y;
        if (Math.hypot(dx, dy) > 12) {
            clearLongPressTimer();
            touchStartPoint.current = null;
            longPressTriggered.current = false;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!settings.mobileMode) return;
        clearLongPressTimer();
        touchStartPoint.current = null;
        if (longPressTriggered.current) {
            if (e.cancelable) e.preventDefault();
            longPressTriggered.current = false;
        }
    };

    const handleInteract = async (e: React.MouseEvent) => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && !dictPopup.visible) return;

        if (isEditing) return;
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();

        const isDelete = settings.deleteModifierKey === 'Alt' ? e.altKey : e.ctrlKey;
        const isMerge = settings.mergeModifierKey === 'Control' ? e.ctrlKey : e.altKey;

        if (isDelete) {
            e.preventDefault();
            onDelete(index);
        } else if (isMerge) {
            e.preventDefault();
            if (!mergeAnchor) setMergeAnchor({ imgSrc, index });
            else {
                if (mergeAnchor.imgSrc === imgSrc && mergeAnchor.index !== index) onMerge(mergeAnchor.index, index);
                setMergeAnchor(null);
            }
        } else {
            if (settings.mobileMode) {
                if (!isActive) {
                    setIsActive(true);
                    return;
                }
                if (justActivated.current) {
                    return;
                }
            }

            if (!settings.enableYomitan) return;

            let charOffset = 0;
            let range: Range | null = null;
            
            // FIX: Robust hit-testing to fix "Next Character" scanning issue.
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                    charOffset = range.startOffset;
                    
                    // If caret is > 0, check if we clicked on the *previous* character
                    if (charOffset > 0) {
                        const checkRange = document.createRange();
                        checkRange.setStart(range.startContainer, charOffset - 1);
                        checkRange.setEnd(range.startContainer, charOffset);
                        const rect = checkRange.getBoundingClientRect();
                        
                        // If click is inside the previous character's box, effectively select IT.
                        if (e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            charOffset -= 1;
                        }
                    }
                }
            } else if ((document as any).caretPositionFromPoint) {
                // Fallback for Firefox
                const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
                if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
                    charOffset = pos.offset;
                    if (charOffset > 0) {
                        const checkRange = document.createRange();
                        checkRange.setStart(pos.offsetNode, charOffset - 1);
                        checkRange.setEnd(pos.offsetNode, charOffset);
                        const rect = checkRange.getBoundingClientRect();
                        
                        if (e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            charOffset -= 1;
                        }
                    }
                }
            }

            const rawContent = cleanPunctuation(block.text, !isNoSpaceLanguage(settings.yomitanLanguage));
            const cleanContent = rawContent.replace(/[\u200B\n\r]+/g, '');

            const encoder = new TextEncoder();
            const prefix = rawContent.substring(0, charOffset);
            
            const ignoredLength = (prefix.match(/[\u200B\n\r]/g) || []).length;
            const adjustedOffset = Math.max(0, charOffset - ignoredLength);

            const byteIndex = encoder.encode(cleanContent.substring(0, adjustedOffset)).length;

            setDictPopup({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                results: [],
                isLoading: true,
                systemLoading: false,
                highlight: undefined,
                context: { imgSrc, sentence: cleanContent, spreadData }
            });

            // Pass the resultGroupingMode setting here
            const results = await lookupYomitan(
                cleanContent,
                byteIndex,
                settings.resultGroupingMode,
                settings.yomitanLanguage
            );

            if (results === 'loading') {
                 setDictPopup(prev => ({ ...prev, results: [], isLoading: false, systemLoading: true }));
            } else {
                setDictPopup(prev => ({ 
                    ...prev, 
                    results: results, 
                    isLoading: false, 
                    systemLoading: false, 
                    highlight: { imgSrc, index, startChar: charOffset, length: (results && results[0]?.matchLen) || 1 }
                }));
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); }
        if (e.key === 'Delete') { e.preventDefault(); onDelete(index); }
    };

    const handleCopy = (e: React.ClipboardEvent) => {
        if (isEditing) return;

        e.preventDefault();
        const selection = window.getSelection();
        if (!selection) return;

        const cleanText = selection.toString().replace(/(\r\n|\n|\r)/gm, "");
        e.clipboardData.setData('text/plain', cleanText);
    };

    const isMergedTarget = mergeAnchor?.imgSrc === imgSrc && mergeAnchor?.index === index;
    const isLookingUp = dictPopup.visible && dictPopup.highlight?.imgSrc === imgSrc && dictPopup.highlight?.index === index;

    const classes = ['gemini-ocr-text-box', isVertical ? 'vertical' : '', isEditing ? 'editing' : '', isMergedTarget ? 'merge-target' : '', isActive ? 'mobile-active' : '', isLookingUp ? 'active-lookup' : ''].filter(Boolean).join(' ');

    const shouldBeVisible = !settings.soloHoverMode || parentVisible || isLocalHover || isEditing || isActive || isLookingUp;
    const menuPosition = contextMenu && typeof window !== 'undefined'
        ? {
            x: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)),
            y: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 96)),
        }
        : null;

    return (
        <>
            <div
                ref={ref}
                role="button"
                tabIndex={settings.mobileMode ? -1 : 0}
                onKeyDown={handleKeyDown}
                className={classes}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onDoubleClick={() => {
                    if (settings.enableDoubleClickEdit) {
                        setIsEditing(true);
                    }
                }}
                onContextMenu={(e) => {
                    if (settings.enableYomitan) {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY });
                        return;
                    }
                    if (settings.ankiConnectEnabled && !e.shiftKey) {
                        handleAnkiRequest(e);
                    }
                }}
                onCopy={handleCopy}
                
                onBlur={() => {
                    if (settings.mobileMode) return;
                    setIsEditing(false);
                    setIsActive(false); 
                    const raw = ref.current?.innerText || '';
                    if (raw !== displayContent) onUpdate(index, raw.replace(/\n/g, '\u200B'));
                }}
                onClick={handleInteract}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                
                onMouseEnter={() => setIsLocalHover(true)}
                onMouseLeave={() => setIsLocalHover(false)}
                
                onMouseUp={handleMouseUpFix}
                onMouseDown={(e) => {
                    if (!settings.mobileMode) {
                        e.stopPropagation();
                    }
                }}

                style={{
                    left: `calc(${block.tightBoundingBox.x * 100}% - ${adj / 2}px)`,
                    top: `calc(${block.tightBoundingBox.y * 100}% - ${adj / 2}px)`,
                    minWidth: `calc(${block.tightBoundingBox.width * 100}% + ${adj}px)`,
                    minHeight: `calc(${block.tightBoundingBox.height * 100}% + ${adj}px)`,
                    width: 'fit-content',
                    height: 'fit-content',
                    fontSize: `${fontSize}px`,
                    color: 'var(--ocr-text-color)',
                    whiteSpace: 'pre',
                    overflow: isEditing ? 'auto' : 'visible', 
                    touchAction: 'pan-y', 
                    
                    // Style Overrides
                    backgroundColor: isActive ? activeBgColor : bgColor,
                    border: `1px solid ${isActive ? theme.accent : borderColor}`,
                    outline: isActive ? `2px solid ${theme.accent}` : 'none',
                    borderRadius: '3px',
                    
                    lineHeight: isVertical ? '1.5' : '1.1',
                    
                    opacity: shouldBeVisible ? 1 : 0,
                    transition: 'opacity 0.2s',
                }}
            >
                {displayContent}
            </div>
            {menuPosition && createPortal(
                <>
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 2147483646,
                            backgroundColor: 'transparent',
                            touchAction: 'none',
                            cursor: 'default',
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation();
                            closeContextMenu();
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            closeContextMenu();
                        }}
                        onTouchStart={(event) => {
                            if (event.cancelable) event.preventDefault();
                            event.stopPropagation();
                        }}
                        onTouchEnd={(event) => {
                            if (event.cancelable) event.preventDefault();
                            event.stopPropagation();
                            closeContextMenu();
                        }}
                    />
                    <div
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: menuPosition.y,
                            left: menuPosition.x,
                            zIndex: 2147483647,
                            background: '#1a1d21',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.45)',
                            padding: '6px',
                            minWidth: '200px',
                        }}
                    >
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                void handleCopyScreenshot();
                                closeContextMenu();
                            }}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                        >
                            Copy screenshot to clipboard
                        </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            void handleCopySentence();
                            closeContextMenu();
                        }}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        Copy sentence to clipboard
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete(index);
                            closeContextMenu();
                        }}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#ff6b6b',
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        Delete textbox
                    </button>
                </div>
                </>,
                document.body
            )}
            {showCropper && createPortal(
                <CropperModal
                    imageSrc={imgSrc}
                    spreadData={spreadData}
                    onComplete={handleCropperComplete}
                    onCancel={() => setShowCropper(false)}
                    quality={settings.ankiImageQuality || 0.92}
                    downscaleMaxWidth={settings.ankiDownscaleMaxWidth}
                    downscaleMaxHeight={settings.ankiDownscaleMaxHeight}
                />,
                document.body
            )}
        </>
    );
});
