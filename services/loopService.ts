import { apiFetch } from './api';
import { LoopDefinition, LoopExecutionWithTraces } from '../types';

interface LoopPayload {
    schedule: string;
    prompt: string;
    enabled: boolean;
}

interface LogQuery {
    loopId?: string;
    limit?: number;
    includeTraces?: boolean;
}

export const loopService = {
    async list(): Promise<LoopDefinition[]> {
        const res = await apiFetch('/loops');
        if (!res.ok) throw new Error('Failed to fetch loops');
        const data = await res.json();
        return data.loops || [];
    },

    async get(id: string): Promise<LoopDefinition | null> {
        const res = await apiFetch(`/loops/${encodeURIComponent(id)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to fetch loop');
        return await res.json();
    },

    async upsert(id: string, payload: LoopPayload): Promise<LoopDefinition> {
        const res = await apiFetch(`/loops/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to save loop');
        return await res.json();
    },

    async delete(id: string): Promise<void> {
        const res = await apiFetch(`/loops/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete loop');
    },

    async listLogs(params: LogQuery = {}): Promise<LoopExecutionWithTraces[]> {
        const query = new URLSearchParams();
        if (params.loopId) query.set('loopId', params.loopId);
        if (params.limit) query.set('limit', String(params.limit));
        if (params.includeTraces) query.set('includeTraces', 'true');

        const path = `/loops/logs${query.toString() ? `?${query.toString()}` : ''}`;
        const res = await apiFetch(path);
        if (!res.ok) throw new Error('Failed to fetch loop logs');
        const data = await res.json();
        return data.logs || [];
    }
};
