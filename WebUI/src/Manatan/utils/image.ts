export function getDownscaledSize(width: number, height: number, maxWidth?: number, maxHeight?: number) {
    let ratio = 1;
    if (maxWidth && width > maxWidth) ratio = maxWidth / width;
    if (maxHeight && (height * ratio) > maxHeight) ratio = Math.min(ratio, maxHeight / height);
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio)
    };
}


export async function canvasToBase64Webp(
    canvas: OffscreenCanvas,
    quality: number,
    maxWidth?: number,
    maxHeight?: number
): Promise<string | null> {
    try {
        let finalCanvas = canvas;
        const { width, height } = getDownscaledSize(canvas.width, canvas.height, maxWidth, maxHeight);
        
        if (width !== canvas.width || height !== canvas.height) {
            finalCanvas = new OffscreenCanvas(width, height);
            const ctx = finalCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
            }
        }

        const blob = await finalCanvas.convertToBlob({
            type: 'image/webp',
            quality: quality
        });

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to convert canvas to base64 WebP", e);
        return null;
    }
}