import { QuickFixClient } from '@JoMe92/quickfix-renderer/client.js';
import QuickFixWorker from './worker?worker';

export type { QuickFixAdjustments } from '@JoMe92/quickfix-renderer/quickfix_renderer.js';

export const createQuickFixClient = (): QuickFixClient => {
    return new QuickFixClient(new QuickFixWorker());
};
