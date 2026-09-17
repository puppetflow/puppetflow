import { useEffect } from 'react';

// Clears drag state even when the pointer is released outside a local target.
export function useGlobalDragReset(callback: () => void) {
    useEffect(() => {
        document.addEventListener('dragend', callback);
        document.addEventListener('drop', callback);
        window.addEventListener('blur', callback);
        return () => {
            document.removeEventListener('dragend', callback);
            document.removeEventListener('drop', callback);
            window.removeEventListener('blur', callback);
        };
    }, [callback]);
}
