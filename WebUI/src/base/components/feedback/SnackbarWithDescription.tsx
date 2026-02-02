/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { closeSnackbar, CustomContentProps, SnackbarContent, VariantType } from 'notistack';
import { ForwardedRef, Fragment, memo } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { extractGraphqlExceptionInfo } from '@/lib/HelperFunctions.ts';
import { TranslationKey } from '@/base/Base.types.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';

const MAX_DESCRIPTION_LENGTH = 200;

const SNACKBAR_VARIANT_TO_TRANSLATION_KEY: Record<VariantType, TranslationKey> = {
    default: 'global.label.info',
    info: 'global.label.info',
    success: 'global.label.success',
    warning: 'global.label.warning',
    error: 'global.label.error',
};

export const SnackbarWithDescription = memo(
    ({
        id,
        message,
        description,
        variant,
        action,
        ref,
    }: CustomContentProps & {
        description?: string;
        ref?: ForwardedRef<HTMLDivElement>;
    }) => {
        const { t } = useTranslation();
        const theme = useTheme();

        const severity = variant === 'default' ? 'info' : variant;
        const finalAction = typeof action === 'function' ? action(id) : action;

        const { isGraphqlException, graphqlError, graphqlStackTrace } = extractGraphqlExceptionInfo(description);

        const finalDescription = isGraphqlException ? graphqlError : description;
        const isDescriptionTooLong = (finalDescription?.length ?? 0) > MAX_DESCRIPTION_LENGTH;
        const actualDescription = isDescriptionTooLong
            ? finalDescription?.slice(0, MAX_DESCRIPTION_LENGTH)
            : finalDescription;

        // Logic check: Do we need a bold Title, or just body text?
        const hasDescription = !!actualDescription?.length;

        // Helper to determine if we can use ghost text (must be string)
        const isMessageString = typeof message === 'string';

        return (
            <SnackbarContent ref={ref}>
                <Alert
                    elevation={1}
                    severity={severity}
                    action={finalAction}
                    sx={{
                        wordBreak: 'break-word',
                        minWidth: '300px',
                        [theme.breakpoints.down(MediaQuery.MOBILE_WIDTH)]: {
                            maxWidth: '100vw',
                        },
                        [theme.breakpoints.between(MediaQuery.MOBILE_WIDTH, MediaQuery.TABLET_WIDTH)]: {
                            maxWidth: '75vw',
                        },
                        [theme.breakpoints.up(MediaQuery.TABLET_WIDTH)]: {
                            maxWidth: '50vw',
                        },
                    }}
                    onClose={() => closeSnackbar(id)}
                >
                    {/* --- TITLE / MESSAGE AREA --- */}
                    {hasDescription ? (
                        /* Case A: We have a description, so 'message' acts as a Title */
                        <AlertTitle
                            className={isMessageString ? "yomitan-ghost-text" : "no-yomitan-select"}
                            data-text={isMessageString ? message : undefined}
                        >
                            {/* If it's a string, hide children (ghost text handles it). If component, render normally. */}
                            {isMessageString ? null : message}
                        </AlertTitle>
                    ) : (
                        /* Case B: No description, 'message' is just the body */
                        <span
                            className={isMessageString ? "yomitan-ghost-text" : "no-yomitan-select"}
                            data-text={isMessageString ? message : undefined}
                        >
                            {isMessageString ? null : message}
                        </span>
                    )}

                    {/* --- DESCRIPTION AREA --- */}
                    {hasDescription && (
                        <span 
                            className="yomitan-ghost-text"
                            data-text={actualDescription}
                            style={{ display: 'block', marginTop: '4px' }} 
                        />
                    )}

                    {/* --- SHOW MORE BUTTON --- */}
                    {isDescriptionTooLong || (isGraphqlException && graphqlStackTrace) ? (
                        <Button
                            onClick={() => {
                                Confirmation.show({
                                    title:
                                        typeof message === 'string'
                                            ? message
                                            : t(SNACKBAR_VARIANT_TO_TRANSLATION_KEY[variant]),
                                    message: description ?? '',
                                    actions: {
                                        cancel: { show: false },
                                        confirm: { title: t('global.label.close') },
                                    },
                                }).catch(
                                    defaultPromiseErrorHandler(
                                        `SnackbarWithDescription: ${id} - ${message} - ${description}`,
                                    ),
                                );
                            }}
                            size="small"
                        >
                            {/* Fix button text as well just in case */}
                            <span className="yomitan-ghost-text" data-text={t('global.button.show_more')} />
                        </Button>
                    ) : (
                        ''
                    )}
                </Alert>
            </SnackbarContent>
        );
    },
);
