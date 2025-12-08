
import { SymbolDef, VectorSearchResult } from '../types';
import { getApiUrl } from './config';

const getHeaders = () => {
    const key = localStorage.getItem('signalzero_api_key') || '';
    return {
        'Content-Type': 'application/json',
        'x-api-key': key
    };
};

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
            const res = await fetch(`${getApiUrl()}/symbols/search?${params.toString()}`, {
                headers: getHeaders()
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error("Vector search failed", e);
            return [];
        }
    },

    async resetCollection(): Promise<boolean> {
        return true;
    }
};
