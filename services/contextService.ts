import { apiFetch } from './api';
import { ContextMessage, ContextSession, ContextHistoryGroup } from '../types';

export const contextService = {
    async list(): Promise<ContextSession[]> {
        const res = await apiFetch('/contexts');
        if (!res.ok) {
            throw new Error('Failed to fetch contexts');
        }
        const data = await res.json();
        return data.contexts || [];
    },

    async create(type: 'conversation' | 'loop' = 'conversation'): Promise<ContextSession> {
        const res = await apiFetch('/contexts', {
            method: 'POST',
            body: JSON.stringify({ type })
        });
        if (!res.ok) throw new Error('Failed to create context');
        return res.json();
    },

    async archive(id: string): Promise<void> {
        const res = await apiFetch(`/contexts/${encodeURIComponent(id)}/archive`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to archive context');
    },

    async getHistory(id: string, since?: string): Promise<{ session: ContextSession; history: ContextHistoryGroup[] }> {
        const query = since ? `?since=${encodeURIComponent(since)}` : '';
        const res = await apiFetch(`/contexts/${encodeURIComponent(id)}/history${query}`);
        if (!res.ok) {
            throw new Error('Failed to fetch context history');
        }
        return res.json();
    }
};