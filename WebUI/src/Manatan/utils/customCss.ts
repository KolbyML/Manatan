export const buildScopedCustomCss = (rawCss: string | undefined, selector: string): string => {
    const css = rawCss?.trim();
    if (!css) {
        return '';
    }

    if (css.includes('{')) {
        return css;
    }

    return `${selector} {\n${css}\n}`;
};
