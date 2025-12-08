
import { ProjectMeta, ProjectImportStats } from '../types';
import { getApiUrl } from './config';

const getHeaders = () => {
    const key = localStorage.getItem('signalzero_api_key') || '';
    return {
        'Content-Type': 'application/json',
        'x-api-key': key
    };
};

export const projectService = {
    async export(meta: ProjectMeta, systemPrompt: string): Promise<Blob> {
        // Note: systemPrompt is now managed on the server, meta is just passed for file generation info
        const res = await fetch(`${getApiUrl()}/project/export`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ meta })
        });
        
        if (!res.ok) throw new Error("Export failed");
        return await res.blob();
    },

    async import(file: File): Promise<{ systemPrompt: string, stats: ProjectImportStats }> {
        const formData = new FormData();
        
        // Convert file to base64 to match spec which expects JSON body with base64 string
        // requestBody: content: application/json: schema: { data: string (base64) }
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const res = await fetch(`${getApiUrl()}/project/import`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ data: base64 })
        });

        if (!res.ok) throw new Error("Import failed");
        
        const result = await res.json();
        
        // Fetch the updated system prompt after import
        const promptRes = await fetch(`${getApiUrl()}/system/prompt`, { headers: getHeaders() });
        const promptData = await promptRes.json();

        return {
            systemPrompt: promptData.prompt,
            stats: result.stats
        };
    }
}
