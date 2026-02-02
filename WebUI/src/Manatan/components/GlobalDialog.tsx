import React from 'react';
import { createPortal } from 'react-dom';
import { useOCR } from '@/Manatan/context/OCRContext';

export const GlobalDialog: React.FC = () => {
    const { dialogState, closeDialog } = useOCR();
    const { isOpen, type, title, message, onConfirm, onCancel } = dialogState;
    const extraAction = (dialogState as any).extraAction as
        | { label: string; onClick: () => void; closeOnClick?: boolean }
        | undefined;
    
    // Support custom button text without changing global types yet
    const confirmText = (dialogState as any).confirmText || (type === 'confirm' ? 'Confirm' : 'OK');
    const cancelText = (dialogState as any).cancelText || 'Cancel';

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (type === 'confirm') {
            closeDialog();
            if (onConfirm) onConfirm();
            return;
        }

        if (onConfirm) {
            onConfirm();
            // Auto-close for everything except progress bars
            if (type !== 'progress') closeDialog();
        } else {
            closeDialog();
        }
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        closeDialog();
    };

    const handleExtraAction = () => {
        const shouldClose = extraAction?.closeOnClick !== false;
        if (shouldClose) {
            closeDialog();
        }
        extraAction?.onClick();
    };

    const handleOverlayClick = () => {
        // Only allow clicking background to close Alerts
        if (type === 'alert') closeDialog();
    };

    return createPortal(
        <div className="ocr-global-dialog-overlay" onClick={handleOverlayClick}>
            <div className="ocr-global-dialog" onClick={e => e.stopPropagation()}>
                {title && <h3>{title}</h3>}
                
                {type === 'progress' && (
                    <div className="ocr-dialog-spinner" />
                )}

                <div className="ocr-dialog-content">
                    {typeof message === 'string' ? <p>{message}</p> : message}
                </div>

                <div className="ocr-dialog-actions">
                    {type === 'confirm' && (
                        extraAction ? (
                            <button type="button" className="ocr-dialog-btn-secondary" onClick={handleExtraAction}>
                                {extraAction.label}
                            </button>
                        ) : null
                    )}
                    {type === 'confirm' && (
                        <button type="button" className="ocr-dialog-btn-cancel" onClick={handleCancel}>
                            {cancelText}
                        </button>
                    )}
                    
                    {/* Hide button for progress type */}
                    {type !== 'progress' && (
                        <button type="button" className="ocr-dialog-btn-confirm" onClick={handleConfirm}>
                            {confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
