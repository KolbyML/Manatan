/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback } from 'react';
import { SpinnerImage, SpinnerImageProps } from '@/base/components/SpinnerImage.tsx';
import { IReaderSettings, ReaderCustomFilter, ReaderPagerProps } from '@/features/reader/Reader.types.ts';
import {
    getImageMarginStyling,
    getImagePlaceholderStyling,
    getReaderImageStyling,
} from '@/features/reader/viewer/pager/ReaderPager.utils.tsx';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { NavbarContextType } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useReaderScrollbarStore } from '@/features/reader/stores/ReaderStore.ts';

const getCustomFilterString = (customFilter: ReaderCustomFilter): string =>
    Object.keys(customFilter)
        .map((key) => {
            const filter = key as keyof ReaderCustomFilter;
            const value = customFilter[filter];

            switch (filter) {
                case 'brightness':
                case 'contrast':
                case 'saturate':
                    return (value as ReaderCustomFilter['brightness' | 'contrast' | 'saturate']).enabled
                        ? `${filter}(${(value as ReaderCustomFilter['brightness' | 'contrast' | 'saturate']).value / 100})`
                        : '';
                case 'hue':
                    return (value as ReaderCustomFilter['hue']).enabled
                        ? `hue-rotate(${(value as ReaderCustomFilter['brightness' | 'contrast' | 'saturate']).value}deg)`
                        : '';
                case 'rgba':
                    return '';
                case 'sepia':
                case 'grayscale':
                case 'invert':
                    return value ? `${filter}(${Number(value)})` : '';
                default:
                    throw new Error(`Unexpected "CustomFilter" (${filter})`);
            }
        })
        .join(' ');

const BaseReaderPage = ({
    pageIndex,
    pagesIndex,
    isPrimaryPage,
    display,
    doublePage = false,
    position,
    marginTop,
    shouldLoad,
    readingMode,
    customFilter,
    pageScaleMode,
    shouldStretchPage,
    readerWidth,
    onLoad,
    onError,
    setRef,
    readerNavBarWidth,
    isLoaded,
    ...props
}: Omit<SpinnerImageProps, 'spinnerStyle' | 'imgStyle' | 'onLoad' | 'onError'> &
    Pick<IReaderSettings, 'readingMode' | 'customFilter' | 'pageScaleMode' | 'shouldStretchPage' | 'readerWidth'> &
    Pick<NavbarContextType, 'readerNavBarWidth'> & {
        pageIndex: number;
        pagesIndex: number;
        isPrimaryPage: boolean;
        display: boolean;
        doublePage?: boolean;
        position?: 'left' | 'right';
        marginTop?: number;
        onLoad: ReaderPagerProps['onLoad'];
        onError: ReaderPagerProps['onError'];
        setRef?: (pagesIndex: number, ref: HTMLElement | null) => void;
        isLoaded?: boolean;
    }) => {
    const { src } = props;

    const isTabletWidth = MediaQuery.useIsTabletWidth();
    const scrollbar = useReaderScrollbarStore((state) => state.scrollbar);

    const handleLoad = useCallback(
        () => onLoad?.(pagesIndex, src, isPrimaryPage),
        [onLoad, pagesIndex, src, isPrimaryPage],
    );
    const handleError = useCallback(() => onError?.(pageIndex, src), [onError, pageIndex, src]);
    const updateRef = useCallback((element: HTMLElement | null) => setRef?.(pagesIndex, element), [pagesIndex, setRef]);

    if (!display && !shouldLoad) {
        return null;
    }

    return (
        <SpinnerImage
            {...props}
            onLoad={handleLoad}
            onError={handleError}
            shouldLoad={shouldLoad}
            shouldDecode
            ref={updateRef}
            spinnerStyle={{
                backgroundColor: 'background.paper',
                ...getImagePlaceholderStyling(
                    readingMode,
                    shouldStretchPage,
                    pageScaleMode,
                    readerWidth,
                    readerNavBarWidth + scrollbar.ySize,
                    scrollbar.xSize,
                    doublePage,
                    isTabletWidth,
                ),
                ...applyStyles(!display, {
                    display: 'none',
                }),
                ...getImageMarginStyling(doublePage, position),
            }}
            imgStyle={{
                ...getReaderImageStyling(
                    readingMode,
                    shouldStretchPage,
                    pageScaleMode,
                    doublePage,
                    readerWidth,
                    readerNavBarWidth + scrollbar.ySize,
                    scrollbar.xSize,
                ),
                filter: getCustomFilterString(customFilter),
                objectFit: 'contain',
                objectPosition: position,
                userSelect: 'none',
                ...getImageMarginStyling(doublePage, position),
                ...applyStyles(marginTop !== undefined, {
                    mt: `${marginTop}px`,
                }),
                display: 'block',
                ...applyStyles(!display, {
                    display: 'none',
                }),
                ...applyStyles(!isLoaded, {
                    margin: 'unset',
                }),
            }}
            hideImgStyle={{
                visibility: 'hidden',
                minWidth: 0,
                minHeight: 0,
                width: 0,
                height: 0,
            }}
        />
    );
};

export const ReaderPage = memo(BaseReaderPage);
