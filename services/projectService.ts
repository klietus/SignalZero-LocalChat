import { ProjectMeta, ProjectImportStats } from '../types';
import { apiFetch } from './api';

export const projectService = {
    async getActive(): Promise<ProjectMeta | null> {
        const res = await apiFetch('/project/active', { method: 'GET' });
        if (!res.ok) return null;

        const data = await res.json();
        return data?.meta ?? null;
    },

    async export(meta: ProjectMeta, systemPrompt: string): Promise<Blob> {
        // Note: systemPrompt is now managed on the server, meta is just passed for file generation info
        const res = await apiFetch('/project/export', {
            method: 'POST',
            body: JSON.stringify({ meta })
        });
        
        if (!res.ok) throw new Error("Export failed");
        return await res.blob();
    },

    async import(file: File): Promise<{ systemPrompt: string, stats: ProjectImportStats }> {
        // Convert file to base64 to match spec which expects JSON body with base64 string
        // requestBody: content: application/json: schema: { data: string (base64) }
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const res = await apiFetch('/project/import', {
            method: 'POST',
            body: JSON.stringify({ data: base64 })
        });

        if (!res.ok) throw new Error("Import failed");
        
        const result = await res.json();
        
        // Fetch the updated system prompt after import
        const promptRes = await apiFetch('/system/prompt');
        const promptData = await promptRes.json();

        return {
            systemPrompt: promptData.prompt,
            stats: result.stats
        };
    },

    async updateActive(meta: ProjectMeta): Promise<ProjectMeta> {
        const res = await apiFetch('/project/active', {
            method: 'POST',
            body: JSON.stringify({ meta })
        });

        if (!res.ok) throw new Error('Failed to save project metadata');

        const data = await res.json();
        return data.meta ?? meta;
    }
}