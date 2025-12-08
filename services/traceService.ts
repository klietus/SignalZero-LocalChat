import { TraceData } from '../types';
import { apiFetch } from './api';

export const traceService = {
  async list(): Promise<TraceData[]> {
    const res = await apiFetch('/traces');
    if (!res.ok) {
      throw new Error(`Failed to fetch traces: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }
};
