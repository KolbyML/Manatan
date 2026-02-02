export const resolvePath = (base: string, relative: string): string => {
    // Handle empty or absolute paths
    if (!relative) return base;
    if (relative.startsWith('/')) {
        console.log(`🔗 [resolvePath] Absolute path: ${relative}`);
        return relative.substring(1);
    }
    if (relative.startsWith('http://') || relative.startsWith('https://')) {
        return relative;
    }

    // Decode URL-encoded strings
    const decodedRelative = decodeURIComponent(relative);

    // Get directory of base file
    const baseDir = base.substring(0, base.lastIndexOf('/'));

    // Split into parts
    const baseParts = baseDir ? baseDir.split('/') : [];
    const relativeParts = decodedRelative.split('/');

    // Build final path
    const resultParts = [...baseParts];

    for (const part of relativeParts) {
        if (part === '.' || part === '') {
            continue;
        } else if (part === '..') {
            if (resultParts.length > 0) {
                resultParts.pop();
            }
        } else {
            resultParts.push(part);
        }
    }

    const result = resultParts.join('/');


    return result;
};