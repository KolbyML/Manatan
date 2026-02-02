import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getStitchedAndCroppedImg, getCroppedImg } from '@/Manatan/utils/cropper';
import { makeToast } from '@/base/utils/Toast';

interface CropperModalProps {
    imageSrc?: string;
    spreadData?: { leftSrc: string; rightSrc: string };
    onComplete: (croppedImage: string) => void;
    onCancel: () => void;
    quality: number;
}

export const CropperModal: React.FC<CropperModalProps> = ({ 
    imageSrc, 
    spreadData,
    onComplete, 
    onCancel,
    quality 
}) => {
    // Default crop is 80% of the image, centered
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        x: 10,
        y: 10,
        width: 80,
        height: 80
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    
    const [wrapperRef, setWrapperRef] = useState<HTMLDivElement | null>(null);
    
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const totalImages = spreadData ? 2 : 1;
    const isLoading = imagesLoaded < totalImages;

    const imgLeftRef = useRef<HTMLImageElement>(null);
    const imgRightRef = useRef<HTMLImageElement>(null);
    const singleImgRef = useRef<HTMLImageElement>(null);

    const onImageLoad = () => {
        setImagesLoaded(prev => prev + 1);
    };

    const onImageError = () => {
        makeToast('Failed to load image for cropping', 'error');
        onCancel(); 
    };

    // Initialize crop once all images are ready
    React.useEffect(() => {
        if (!isLoading && wrapperRef && !completedCrop) {
            const { width, height } = wrapperRef.getBoundingClientRect();
            
            // Initialize completedCrop immediately with the default percentage crop converted to pixels
            // This allows the Confirm button to work without moving the selection
            const initialPixelCrop: PixelCrop = {
                unit: 'px',
                x: (crop.x / 100) * width,
                y: (crop.y / 100) * height,
                width: (crop.width / 100) * width,
                height: (crop.height / 100) * height
            }
            setCompletedCrop(initialPixelCrop);
        }
    }, [isLoading, wrapperRef, crop, completedCrop]);

    const handleConfirm = async () => {
        if (!completedCrop) return;

        onCancel();

        try {
            let croppedImage: string | null = null;

            if (spreadData && imgLeftRef.current && imgRightRef.current) {
                const scaleX = imgLeftRef.current.naturalWidth / imgLeftRef.current.width;
                const scaleY = imgLeftRef.current.naturalHeight / imgLeftRef.current.height;

                const pixelCrop = {
                    x: completedCrop.x * scaleX,
                    y: completedCrop.y * scaleY,
                    width: completedCrop.width * scaleX,
                    height: completedCrop.height * scaleY
                };

                croppedImage = await getStitchedAndCroppedImg(
                    spreadData.leftSrc,
                    spreadData.rightSrc,
                    pixelCrop,
                    quality
                );

            } else if (singleImgRef.current && imageSrc) {
                const scaleX = singleImgRef.current.naturalWidth / singleImgRef.current.width;
                const scaleY = singleImgRef.current.naturalHeight / singleImgRef.current.height;

                const pixelCrop = {
                    x: completedCrop.x * scaleX,
                    y: completedCrop.y * scaleY,
                    width: completedCrop.width * scaleX,
                    height: completedCrop.height * scaleY
                };

                croppedImage = await getCroppedImg(
                    imageSrc, 
                    pixelCrop, 
                    quality,
                    0
                );
            }

            if (croppedImage) {
                onComplete(croppedImage);
            }

        } catch (err: any) {
            makeToast('Failed to crop image', 'error', err.message)
        }
    };

    const renderImages = () => {
        const commonProps = {
            crossOrigin: "anonymous" as const,
            onLoad: onImageLoad,
            onError: onImageError,
        };

        const baseStyle: React.CSSProperties = {
            maxHeight: 'calc(60vh - 40px)',
            display: 'block',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.2s',
        };

        if (spreadData) {
            return (
                <>
                    <img
                        ref={imgLeftRef}
                        src={spreadData.leftSrc}
                        alt="Left crop preview"
                        style={{ ...baseStyle, maxWidth: '50%' }}
                        {...commonProps}
                    />
                    <img
                        ref={imgRightRef}
                        src={spreadData.rightSrc}
                        alt="Right crop preview"
                        style={{ ...baseStyle, maxWidth: '50%' }}
                        {...commonProps}
                    />
                </>
            );
        }

        return (
            <img
                ref={singleImgRef}
                src={imageSrc}
                alt="Crop preview"
                style={{ ...baseStyle, maxWidth: '100%' }}
                {...commonProps}
            />
        );
    };

    return (
        <div className="ocr-modal-overlay" onClick={onCancel}>
            <div 
                className="ocr-modal"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '90vw', 
                    maxHeight: '90vh',
                    width: 'fit-content',
                    pointerEvents: 'auto',
                    position: 'relative',
                }}
            >
                <div className="ocr-modal-header">
                    <h2>Crop Image</h2>
                </div>
                <div
                    className="ocr-modal-content"
                    style={{
                        position: 'relative', 
                        height: '60vh', 
                        minHeight: '400px',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'auto',
                        backgroundColor: '#111'
                    }}
                >
                    {isLoading && (
                        <div style={{ position: 'absolute', zIndex: 10 }}>
                             <div className="ocr-spinner">
                                <svg className="circular" viewBox="25 25 50 50">
                                    <circle className="path" cx="50" cy="50" r="20" fill="none" strokeWidth="4" strokeMiterlimit="10"/>
                                </svg>
                            </div>
                        </div>
                    )}

                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                    >
                        <div 
                            ref={setWrapperRef}
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'row',
                                justifyContent: 'center',
                            }}
                        >
                            {renderImages()}
                        </div>
                    </ReactCrop>
                </div>
                <div className="ocr-modal-footer">
                    <button type="button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleConfirm} disabled={isLoading}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};