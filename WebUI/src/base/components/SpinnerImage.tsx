/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState, useEffect, useCallback, useRef, Ref } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import ImageIcon from '@mui/icons-material/Image';
import { SxProps, Theme } from '@mui/material/styles';
import { ImageRequest, requestManager } from '@/lib/requests/RequestManager.ts';
import { Priority } from '@/lib/Queue.ts';
import { applyStyles } from '@/base/utils/ApplyStyles.ts';
import { useIntersectionObserver } from '@/base/hooks/useIntersectionObserver.tsx';
import { noOp } from '@/lib/HelperFunctions.ts';

export interface SpinnerImageProps {
    shouldLoad?: boolean;

    src: string;
    alt: string;

    spinnerStyle?: SxProps<Theme> & { small?: boolean };
    imgStyle?: SxProps<Theme>;
    hideImgStyle?: Omit<SxProps<Theme>, 'accentColor'>;

    onLoad?: () => void;
    onError?: () => void;

    shouldDecode?: boolean;
    useFetchApi?: boolean;
    disableCors?: boolean;
    ignoreQueue?: boolean;

    priority?: Priority;

    retryKeyPrefix?: string;

    ref?: Ref<HTMLImageElement | HTMLDivElement | null>;
}

export const SpinnerImage = ({ ref, ...props }: SpinnerImageProps) => {
    const {
        shouldLoad = true,
        shouldDecode,
        useFetchApi,
        disableCors,
        ignoreQueue,
        src,
        alt,
        onLoad,
        onError,
        spinnerStyle: { small, ...spinnerStyle } = {},
        imgStyle,
        hideImgStyle,
        priority,
        retryKeyPrefix,
    } = props;

    const { t } = useTranslation();

    const loadingIndicatorRef = useRef<HTMLDivElement | null>(null);

    const showMissingImageIcon = !src.length;

    const [imageSourceUrl, setImageSourceUrl] = useState<string>();
    const [imgLoadRetryKey, setImgLoadRetryKey] = useState(0);
    const [isLoading, setIsLoading] = useState<boolean>();
    const [hasError, setHasError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const updateImageState = (loading: boolean, error: boolean = false, aborted: boolean = false) => {
        setIsLoading(loading);
        setHasError(error);

        if (error && !loading && !aborted) {
            onError?.();
        }

        if (!loading && !error && !aborted) {
            onLoad?.();
        }
    };

    useIntersectionObserver(
        loadingIndicatorRef,
        useCallback((entries) => setIsVisible(entries[0].isIntersecting), []),
    );

    useEffect(() => {
        if (showMissingImageIcon || !shouldLoad || !!imageSourceUrl) {
            return () => {};
        }

        let imageRequest: ImageRequest = {
            response: Promise.resolve(''),
            cleanup: noOp,
            abortRequest: noOp,
            fromCache: false,
        };
        const fetchImage = async () => {
            try {
                imageRequest = await requestManager.requestImage(src, {
                    priority,
                    shouldDecode,
                    useFetchApi,
                    disableCors,
                    ignoreQueue,
                });

                if (!imageRequest.fromCache) {
                    updateImageState(true);
                }

                const image = await imageRequest.response;

                updateImageState(false);
                setImageSourceUrl(image);
            } catch (e) {
                const wasAborted =
                    e instanceof Error && (e.name === 'AbortError' || e.message === 'Component was unmounted');
                updateImageState(false, !wasAborted, wasAborted);
            }
        };

        fetchImage().catch(() => {});

        return () => {
            imageRequest.cleanup();
            imageRequest.abortRequest(new Error('Component was unmounted'));
        };
    }, [src, imgLoadRetryKey, retryKeyPrefix, showMissingImageIcon, shouldLoad]);

    return (
        <>
            {showMissingImageIcon ? (
                <Stack
                    ref={ref}
                    sx={{
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: (theme) => theme.palette.background.default,
                        ...spinnerStyle,
                    }}
                >
                    <ImageIcon fontSize="large" />
                </Stack>
            ) : (
                <Box
                    component="img"
                    key={`${src}_${imgLoadRetryKey}_${retryKeyPrefix}`}
                    sx={[
                        ...(Array.isArray(imgStyle) ? (imgStyle ?? []) : [imgStyle]),
                        applyStyles(!imageSourceUrl || isLoading || hasError, {
                            ...hideImgStyle,
                            ...applyStyles(!hideImgStyle, {
                                display: 'none',
                            }),
                        }),
                    ]}
                    ref={ref}
                    crossOrigin={disableCors ? undefined : 'anonymous'}
                    src={imageSourceUrl}
                    alt={alt}
                    draggable={false}
                />
            )}

            {(!!isLoading || (src && !imageSourceUrl) || hasError) && (
                <Stack
                    ref={loadingIndicatorRef}
                    sx={{
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                        ...spinnerStyle,
                    }}
                >
                    <Stack
                        sx={{
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {isVisible && !!isLoading && <CircularProgress thickness={5} />}
                        {hasError && isLoading === false && (
                            <>
                                <BrokenImageIcon />
                                <Button
                                    startIcon={!small && <RefreshIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setImgLoadRetryKey((prevState) => (prevState + 1) % 100);
                                    }}
                                    size={small ? 'small' : 'large'}
                                >
                                    {small ? <RefreshIcon /> : t('global.button.retry')}
                                </Button>
                            </>
                        )}
                    </Stack>
                </Stack>
            )}
        </>
    );
};
