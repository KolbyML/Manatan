import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

interface ReaderZoomContextValue {
    scale: number;
    isZoomed: boolean;
    setScale: (scale: number) => void;
    resetZoom: () => void;
}

const ReaderZoomContext = createContext<ReaderZoomContextValue | null>(null);

export const useReaderZoom = () => {
    const context = useContext(ReaderZoomContext);
    if (!context) {
        throw new Error('useReaderZoom must be used within ReaderZoomProvider');
    }
    return context;
};

export const ReaderZoomProvider = ({ children }: { children: ReactNode }) => {
    const [scale, setScale] = useState(1);

    const resetZoom = useCallback(() => setScale(1), []);

    return (
        <ReaderZoomContext.Provider
            value={{
                scale,
                isZoomed: scale > 1,
                setScale,
                resetZoom
            }}
        >
            {children}
        </ReaderZoomContext.Provider>
    );
};