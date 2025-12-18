import { SymbolDef } from '../types';
import { apiFetch } from './api';

export const domainService = {
  
  async listDomains(): Promise<string[]> {
    const res = await apiFetch('/domains');
    if (!res.ok) return [];
    const domains = await res.json();
    return domains.map((d: any) => d.id);
  },

  async hasDomain(domainId: string): Promise<boolean> {
    const res = await apiFetch(`/domains/${domainId}/exists`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.exists;
  },

  async isEnabled(domainId: string): Promise<boolean> {
    const res = await apiFetch(`/domains/${domainId}/enabled`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled;
  },

  async toggleDomain(domainId: string, enabled: boolean): Promise<void> {
    await apiFetch(`/domains/${domainId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
    });
  },

  async updateDomainMetadata(domainId: string, metadata: { name?: string, description?: string, invariants?: string[] }): Promise<void> {
    await apiFetch(`/domains/${domainId}`, {
        method: 'PATCH',
        body: JSON.stringify(metadata)
    });
  },

  async deleteDomain(domainId: string): Promise<void> {
    await apiFetch(`/domains/${domainId}`, {
        method: 'DELETE'
    });
  },

  async clearAll(): Promise<void> {
    await apiFetch('/admin/clear-all', {
        method: 'POST'
    });
  },

  async deleteSymbol(domainId: string, symbolId: string, cascade: boolean = true): Promise<void> {
    await apiFetch(`/domains/${domainId}/symbols/${symbolId}?cascade=${cascade}`, {
        method: 'DELETE'
    });
  },

  async propagateRename(domainId: string, oldId: string, newId: string): Promise<void> {
     await apiFetch(`/domains/${domainId}/symbols/rename`, {
        method: 'POST',
        body: JSON.stringify({ oldId, newId })
    });
  },

  async getSymbols(domainId: string): Promise<SymbolDef[]> {
    const res = await apiFetch(`/domains/${domainId}/symbols`);
    if (!res.ok) return [];
    return await res.json();
  },

  async upsertSymbol(domainId: string, symbol: SymbolDef): Promise<void> {
    // Ensure domain ID is set on symbol
    symbol.symbol_domain = domainId;
    await apiFetch(`/domains/${domainId}/symbols`, {
        method: 'POST',
        body: JSON.stringify(symbol)
    });
  },

  async bulkUpsert(domainId: string, symbols: SymbolDef[]): Promise<void> {
    const cleaned = symbols.map(s => ({...s, symbol_domain: domainId}));
    await apiFetch(`/domains/${domainId}/symbols/bulk`, {
        method: 'POST',
        body: JSON.stringify(cleaned)
    });
  },

  async processRefactorOperation(updates: { old_id: string, symbol_data: SymbolDef }[]): Promise<{ count: number, renamedIds: string[] }> {
      const res = await apiFetch('/symbols/refactor', {
          method: 'POST',
          body: JSON.stringify({ updates })
      });
      if (!res.ok) throw new Error("Refactor failed");
      // The API spec doesn't return details, so we infer success
      return { count: updates.length, renamedIds: [] }; 
  },

  async compressSymbols(newSymbol: SymbolDef, oldIds: string[]): Promise<{ newId: string, removedIds: string[] }> {
      const res = await apiFetch('/symbols/compress', {
          method: 'POST',
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
    const res = await apiFetch(`/symbols/${id}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async getMetadata(): Promise<any[]> {
     const res = await apiFetch('/domains');
     if (!res.ok) return [];
     const domains = await res.json();

     // If server already provides full counts, use them directly
     const hasAllCounts = domains.length > 0 && domains.every((d: any) =>
         typeof d.count === 'number' && typeof d.personaCount === 'number' && typeof d.latticeCount === 'number'
     );

     if (hasAllCounts) {
         return domains.map((d: any) => ({
             ...d,
             lastUpdated: d.lastUpdated || Date.now()
         }));
     }

     // Fallback for servers that don't return counts (or only partial counts)
     const enhanced = await Promise.all(domains.map(async (d: any) => {
         const syms = await this.getSymbols(d.id);
         const counts = syms.reduce((acc, sym) => {
             const kind = sym.kind || 'pattern';
             if (kind === 'persona') acc.personaCount += 1;
             if (kind === 'lattice') acc.latticeCount += 1;
             return acc;
         }, { personaCount: 0, latticeCount: 0 });

         return {
             ...d,
             count: typeof d.count === 'number' ? d.count : syms.length,
             personaCount: typeof d.personaCount === 'number' ? d.personaCount : counts.personaCount,
             latticeCount: typeof d.latticeCount === 'number' ? d.latticeCount : counts.latticeCount,
             lastUpdated: d.lastUpdated || Date.now()
         };
     }));

     return enhanced;
  }
};