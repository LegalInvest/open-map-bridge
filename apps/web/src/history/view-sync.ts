import { normalizeViewState, type ViewState } from '@omb/temporal-source';

export interface ViewSync {
  subscribe(id: string, listener: (state: ViewState) => void): () => void;
  publish(originId: string, state: ViewState): void;
}

export function createViewSync(): ViewSync {
  const listeners = new Map<string, (state: ViewState) => void>();
  return {
    subscribe(id, listener) {
      listeners.set(id, listener);
      return () => listeners.delete(id);
    },
    publish(originId, state) {
      const normalized = normalizeViewState(state);
      for (const [id, listener] of listeners) {
        if (id !== originId) listener(structuredClone(normalized));
      }
    },
  };
}
