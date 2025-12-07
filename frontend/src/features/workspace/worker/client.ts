import { QuickFixClient } from '@JoMe92/quickfix-renderer/client.js';
import QuickFixWorker from './worker?worker';

export type { QuickFixAdjustments } from '@JoMe92/quickfix-renderer/quickfix_renderer.js';

// Singleton instance mgmt
let sharedInstance: QuickFixClient | null = null;
const GLOBAL_KEY = '__QUICKFIX_SINGLETON__';

export const getQuickFixClient = (): QuickFixClient => {
    if (sharedInstance) return sharedInstance;

    // Check for orphaned instance from previous HMR (zombie cleanup)
    if (typeof window !== 'undefined') {
        const existing = (window as any)[GLOBAL_KEY];
        if (existing) {
            console.log('[QuickFixClient] Disposing orphaned client found on window');
            try {
                existing.dispose();
            } catch (e) {
                console.warn('[QuickFixClient] Failed to dispose orphan:', e);
            }
            (window as any)[GLOBAL_KEY] = null;
        }
    }

    console.log('[QuickFixClient] Creating new worker instance');
    sharedInstance = new QuickFixClient(new QuickFixWorker());

    // Auto-init with error handling & debugging
    console.log('[QuickFixClient] Initializing WASM...');
    const initPromise = sharedInstance.init({});
    console.log('[QuickFixClient] init returned:', initPromise);

    if (initPromise instanceof Promise || (initPromise && typeof (initPromise as any).then === 'function')) {
        initPromise.catch((err) => {
            console.error('[QuickFixClient] Initialization failed:', err);
        });
    } else {
        console.warn('[QuickFixClient] init() did NOT return a Promise!', initPromise);
    }

    if (typeof window !== 'undefined') {
        (window as any)[GLOBAL_KEY] = sharedInstance;
    }

    return sharedInstance;
};

// Vite HMR cleanup
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (sharedInstance) {
            console.log('[QuickFixClient] HMR Dispose: Terminating worker');
            try {
                sharedInstance.dispose();
            } catch (e) {
                console.warn(e);
            }
            sharedInstance = null;
            if (typeof window !== 'undefined') {
                (window as any)[GLOBAL_KEY] = null;
            }
        }
    });
}
