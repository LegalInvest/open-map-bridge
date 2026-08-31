import { normalizeViewState, type ViewState } from '@omb/temporal-source';

export interface ViewSync {
  subscribe(id: string, listener: (state: ViewState) => void): () => void;
  publish(originId: string, state: ViewState): void;
  current(): ViewState | null;
}

export function createViewSync(): ViewSync {
  const listeners = new Map<string, (state: ViewState) => void>();
  let current: ViewState | null = null;
  return {
    subscribe(id, listener) {
      listeners.set(id, listener);
      if (current) listener(structuredClone(current));
      return () => listeners.delete(id);
    },
    publish(originId, state) {
      const normalized = normalizeViewState(state);
      current = structuredClone(normalized);
      for (const [id, listener] of listeners) {
        if (id !== originId) listener(structuredClone(normalized));
      }
    },
    current() {
      return current ? structuredClone(current) : null;
    },
  };
}
