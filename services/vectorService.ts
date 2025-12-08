import { SymbolDef, VectorSearchResult } from '../types';
import { apiFetch } from './api';

export const vectorService = {
    // Operations are now server-side implicit hooks on upsert/delete.
    // Client-side methods are no-ops or simple wrappers.

    async indexSymbol(symbol: SymbolDef): Promise<boolean> {
        // No-op: Server indexes on upsert
        return true;
    },

    async indexBatch(symbols: SymbolDef[]): Promise<number> {
        // No-op: Server indexes on upsert
        return symbols.length;
    },

    async deleteSymbol(symbolId: string): Promise<boolean> {
        // No-op: Server deletes on domain symbol delete
        return true;
    },

    async search(query: string, nResults: number = 5): Promise<VectorSearchResult[]> {
        try {
            const params = new URLSearchParams({ q: query, limit: nResults.toString() });
            const res = await apiFetch(`/symbols/search?${params.toString()}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            // Logging handled by apiFetch
            return [];
        }
    },

    async resetCollection(): Promise<boolean> {
        return true;
    }
};