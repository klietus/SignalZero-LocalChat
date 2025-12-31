import { apiFetch } from './api';
import { ContextMessage, ContextSession } from '../types';

export const contextService = {
    async list(): Promise<ContextSession[]> {
        const res = await apiFetch('/contexts');
        if (!res.ok) {
            throw new Error('Failed to fetch contexts');
        }
        const data = await res.json();
        return data.contexts || [];
    },

    async getHistory(id: string): Promise<{ session: ContextSession; history: ContextMessage[] }> {
        const res = await apiFetch(`/contexts/${encodeURIComponent(id)}/history`);
        if (!res.ok) {
            throw new Error('Failed to fetch context history');
        }
        return res.json();
    }
};
