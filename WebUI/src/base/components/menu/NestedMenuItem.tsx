/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * src: https://github.com/webzep/mui-nested-menu/blob/main/packages/mui-nested-menu/src/components/NestedMenuItem.tsx (2024-04-20 01:42)
 *
 * with a few changes to fix a bug on mobile devices where opening the sub menu immediately triggered the on click of the underlying menu item
 */

import Menu, { MenuProps as MuiMenuProps } from '@mui/material/Menu';
import { MenuItemProps as MuiMenuItemProps } from '@mui/material/MenuItem';
import {
    ElementType,
    HTMLAttributes,
    KeyboardEvent,
    FocusEvent,
    MouseEvent,
    ReactNode,
    RefAttributes,
    useRef,
    useState,
    Ref,
} from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import Box from '@mui/material/Box';

import { OverridableComponent } from '@mui/material/OverridableComponent';
import { SvgIconTypeMap } from '@mui/material/SvgIcon';
import { useMergedRef } from '@mantine/hooks';
import { IconMenuItem } from '@/base/components/menu/IconMenuItem.tsx';
import { getOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

export type NestedMenuItemProps = Omit<MuiMenuItemProps, 'button'> & {
    parentMenuOpen: boolean;
    component?: ElementType;
    label?: string;
    renderLabel?: () => ReactNode;
    RightIcon?: OverridableComponent<SvgIconTypeMap> & { muiName: string };
    LeftIcon?: OverridableComponent<SvgIconTypeMap> & { muiName: string };
    children?: ReactNode;
    className?: string;
    tabIndex?: number;
    disabled?: boolean;
    ContainerProps?: HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>;
    MenuProps?: Partial<Omit<MuiMenuProps, 'children'>>;
    button?: true | undefined;
    ref?: Ref<HTMLLIElement | null>;
};

export const NestedMenuItem = ({ ref, ...props }: NestedMenuItemProps) => {
    const {
        parentMenuOpen,
        label,
        renderLabel,
        RightIcon = getOptionForDirection(ChevronRightIcon, ChevronLeftIcon),
        LeftIcon,
        children,
        className,
        tabIndex: tabIndexProp,
        ContainerProps: ContainerPropsProp = {},
        MenuProps,
        ...MenuItemProps
    } = props;

    const isTouchDevice = MediaQuery.useIsTouchDevice();

    const { ref: containerRefProp, ...ContainerProps } = ContainerPropsProp;

    const menuItemRef = useRef<HTMLLIElement | null>(null);
    const mergedMenuItemRef = useMergedRef(ref, menuItemRef);

    const containerRef = useRef<HTMLElement>(null);
    const mergedContainerRef = useMergedRef(containerRefProp, containerRef);

    const menuContainerRef = useRef<HTMLDivElement | null>(null);

    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

    const changeMenuOpenState = (open: boolean) => {
        if (isSubMenuOpen === open) {
            return;
        }

        if (props.disabled) {
            setIsSubMenuOpen(false);
            return;
        }

        setIsSubMenuOpen(open);
    };

    const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
        if (isTouchDevice) {
            return;
        }

        changeMenuOpenState(true);

        if (ContainerProps.onMouseEnter) {
            ContainerProps.onMouseEnter(e);
        }
    };
    const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
        changeMenuOpenState(false);

        if (ContainerProps.onMouseLeave) {
            ContainerProps.onMouseLeave(e);
        }
    };

    // Check if any immediate children are active
    const isSubmenuFocused = () => {
        const active = containerRef.current?.ownerDocument.activeElement ?? null;
        if (menuContainerRef.current == null) {
            return false;
        }
        for (const child of menuContainerRef.current.children) {
            if (child === active) {
                return true;
            }
        }

        return false;
    };

    const handleFocus = (e: FocusEvent<HTMLElement>) => {
        if (isTouchDevice) {
            return;
        }

        if (e.target === containerRef.current) {
            changeMenuOpenState(true);
        }

        if (ContainerProps.onFocus) {
            ContainerProps.onFocus(e);
        }
    };

    const handleClick = (e: MouseEvent<HTMLElement>) => {
        changeMenuOpenState(!isSubMenuOpen);

        if (ContainerProps.onClick) {
            ContainerProps.onClick(e);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            return;
        }

        if (isSubmenuFocused()) {
            e.stopPropagation();
        }

        const active = containerRef.current?.ownerDocument.activeElement;

        if (e.key === 'ArrowLeft' && isSubmenuFocused()) {
            containerRef.current?.focus();
        }

        if (e.key === 'ArrowRight' && e.target === containerRef.current && e.target === active) {
            const firstChild = menuContainerRef.current?.children[0] as HTMLDivElement;
            firstChild?.focus();
        }
    };

    const open = isSubMenuOpen && parentMenuOpen;

    // Root element must have a `tabIndex` attribute for keyboard navigation
    let tabIndex;
    if (!props.disabled) {
        tabIndex = tabIndexProp !== undefined ? tabIndexProp : -1;
    }

    return (
        <Box
            {...ContainerProps}
            ref={mergedContainerRef}
            onFocus={handleFocus}
            onClick={handleClick}
            tabIndex={tabIndex}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onKeyDown={handleKeyDown}
        >
            <IconMenuItem
                MenuItemProps={MenuItemProps}
                className={className}
                ref={mergedMenuItemRef}
                LeftIcon={LeftIcon}
                RightIcon={RightIcon}
                label={label}
                renderLabel={renderLabel}
            />

            <Menu
                // Set pointer events to 'none' to prevent the invisible Popover div
                // from capturing events for clicks and hovers
                style={{ pointerEvents: 'none' }}
                anchorEl={menuItemRef.current}
                anchorOrigin={{
                    horizontal: getOptionForDirection('right', 'left'),
                    vertical: 'top',
                }}
                transformOrigin={{
                    horizontal: getOptionForDirection('left', 'right'),
                    vertical: 'top',
                }}
                open={open}
                autoFocus={false}
                disableAutoFocus
                disableEnforceFocus
                onClose={() => {
                    changeMenuOpenState(false);
                }}
                {...MenuProps}
            >
                <Box ref={menuContainerRef} style={{ pointerEvents: 'auto' }}>
                    {children}
                </Box>
            </Menu>
        </Box>
    );
};
