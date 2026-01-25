import { TraceData } from '../types';
import { apiFetch } from './api';

export const traceService = {
  async list(since?: number): Promise<TraceData[]> {
    const url = since ? `/traces?since=${since}` : '/traces';
    const res = await apiFetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch traces: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async get(id: string): Promise<TraceData | null> {
      const res = await apiFetch(`/traces/${id}`);
      if (!res.ok) return null;
      return await res.json();
  }
};
