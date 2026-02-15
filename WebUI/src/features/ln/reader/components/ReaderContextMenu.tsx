import React from 'react';

interface ReaderContextMenuProps {
    visible: boolean;
    x: number;
    y: number;
    onHighlight: () => void;
    onCopy?: () => void;
    onClose: () => void;
}

export const ReaderContextMenu: React.FC<ReaderContextMenuProps> = ({
    visible,
    x,
    y,
    onHighlight,
    onCopy,
    onClose,
}) => {
    if (!visible) return null;

    const handleAction = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999,
                }}
                onClick={onClose}
            />
            <div
                style={{
                    position: 'fixed',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    borderRadius: '8px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    minWidth: '140px',
                }}
            >
                <button
                    type="button"
                    onClick={() => handleAction(onHighlight)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                >
                    <span style={{ color: '#FFEB3B' }}>●</span>
                    Highlight
                </button>
                
                {onCopy && (
                    <button
                        type="button"
                        onClick={() => handleAction(onCopy)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            color: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                    >
                        <span>📋</span>
                        Copy
                    </button>
                )}
            </div>
        </>
    );
};
