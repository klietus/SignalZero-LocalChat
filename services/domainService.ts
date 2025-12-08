
import { SymbolDef } from '../types';
import { getApiUrl } from './config';

const getHeaders = () => {
    const key = localStorage.getItem('signalzero_api_key') || '';
    return {
        'Content-Type': 'application/json',
        'x-api-key': key
    };
};

export const domainService = {
  
  async listDomains(): Promise<string[]> {
    const res = await fetch(`${getApiUrl()}/domains`, { headers: getHeaders() });
    if (!res.ok) return [];
    const domains = await res.json();
    return domains.map((d: any) => d.id);
  },

  async hasDomain(domainId: string): Promise<boolean> {
    const res = await fetch(`${getApiUrl()}/domains/${domainId}/exists`, { headers: getHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return data.exists;
  },

  async isEnabled(domainId: string): Promise<boolean> {
    const res = await fetch(`${getApiUrl()}/domains/${domainId}/enabled`, { headers: getHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled;
  },

  async toggleDomain(domainId: string, enabled: boolean): Promise<void> {
    await fetch(`${getApiUrl()}/domains/${domainId}/toggle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ enabled })
    });
  },

  async updateDomainMetadata(domainId: string, metadata: { name?: string, description?: string, invariants?: string[] }): Promise<void> {
    await fetch(`${getApiUrl()}/domains/${domainId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(metadata)
    });
  },

  async deleteDomain(domainId: string): Promise<void> {
    await fetch(`${getApiUrl()}/domains/${domainId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
  },

  async clearAll(): Promise<void> {
    await fetch(`${getApiUrl()}/admin/clear-all`, {
        method: 'POST',
        headers: getHeaders()
    });
  },

  async deleteSymbol(domainId: string, symbolId: string, cascade: boolean = true): Promise<void> {
    await fetch(`${getApiUrl()}/domains/${domainId}/symbols/${symbolId}?cascade=${cascade}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
  },

  async propagateRename(domainId: string, oldId: string, newId: string): Promise<void> {
     await fetch(`${getApiUrl()}/domains/${domainId}/symbols/rename`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ oldId, newId })
    });
  },

  async getSymbols(domainId: string): Promise<SymbolDef[]> {
    const res = await fetch(`${getApiUrl()}/domains/${domainId}/symbols`, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
  },

  async upsertSymbol(domainId: string, symbol: SymbolDef): Promise<void> {
    // Ensure domain ID is set on symbol
    symbol.symbol_domain = domainId;
    await fetch(`${getApiUrl()}/domains/${domainId}/symbols`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(symbol)
    });
  },

  async bulkUpsert(domainId: string, symbols: SymbolDef[]): Promise<void> {
    const cleaned = symbols.map(s => ({...s, symbol_domain: domainId}));
    await fetch(`${getApiUrl()}/domains/${domainId}/symbols/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(cleaned)
    });
  },

  async processRefactorOperation(updates: { old_id: string, symbol_data: SymbolDef }[]): Promise<{ count: number, renamedIds: string[] }> {
      const res = await fetch(`${getApiUrl()}/symbols/refactor`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ updates })
      });
      if (!res.ok) throw new Error("Refactor failed");
      // The API spec doesn't return details, so we infer success
      return { count: updates.length, renamedIds: [] }; 
  },

  async compressSymbols(newSymbol: SymbolDef, oldIds: string[]): Promise<{ newId: string, removedIds: string[] }> {
      const res = await fetch(`${getApiUrl()}/symbols/compress`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ newSymbol, oldIds })
      });
      if (!res.ok) throw new Error("Compression failed");
      return { newId: newSymbol.id, removedIds: oldIds };
  },

  async query(domainId: string, tag?: string, limit: number = 20, lastId?: string): Promise<any> {
    // NOTE: The API doesn't support complex cursor pagination query yet, 
    // so we fetch all for the domain and filter client side to maintain UI compatibility
    // until the API is updated.
    const symbols = await this.getSymbols(domainId);
    
    let filtered = symbols;
    if (tag) {
        filtered = filtered.filter(s => s.symbol_tag?.includes(tag));
    }

    // Simple slice for pagination simulation
    let startIndex = 0;
    if (lastId) {
        const idx = filtered.findIndex(s => s.id === lastId);
        if (idx !== -1) startIndex = idx + 1;
    }
    
    const paged = filtered.slice(startIndex, startIndex + limit);

    return {
        items: paged,
        total: filtered.length,
        source: 'api_proxy'
    };
  },

  async findById(id: string): Promise<SymbolDef | null> {
    const res = await fetch(`${getApiUrl()}/symbols/${id}`, { headers: getHeaders() });
    if (!res.ok) return null;
    return await res.json();
  },

  async getMetadata(): Promise<any[]> {
     const res = await fetch(`${getApiUrl()}/domains`, { headers: getHeaders() });
     if (!res.ok) return [];
     const domains = await res.json();
     
     // Hydrate with counts - API listDomains returns basic info usually, 
     // but the UI expects 'count'. We might need to fetch symbols length if the API doesn't provide it.
     // For performance, we'll assume the API /domains endpoint returns what's needed or we do parallel fetches.
     // The provided spec for /domains returns Domain object which doesn't have count.
     // We will fetch counts.
     
     const enhanced = await Promise.all(domains.map(async (d: any) => {
         const syms = await this.getSymbols(d.id);
         return {
             ...d,
             count: syms.length,
             lastUpdated: Date.now() // API doesn't give this
         };
     }));
     
     return enhanced;
  }
};
