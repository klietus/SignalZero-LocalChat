import { getApiUrl } from './config';
import { logger } from './logger';

export const getHeaders = () => {
    const token = localStorage.getItem('signalzero_auth_token') || '';
    return {
        'Content-Type': 'application/json',
        'x-auth-token': token
    };
};

interface ApiOptions extends RequestInit {
    skipLog?: boolean;
}

export const apiFetch = async (path: string, options: ApiOptions = {}) => {
    // Ensure path starts with / if not present
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${getApiUrl()}${normalizedPath}`;
    const method = options.method || 'GET';
    
    const isHistoryPoll = normalizedPath.includes('/history');

    if (!options.skipLog && !isHistoryPoll) {
        let logBody = options.body;
        if (typeof options.body === 'string') {
            try {
                logBody = JSON.parse(options.body);
            } catch (e) { /* ignore */ }
        }
        
        logger.info('API_REQUEST', `${method} ${normalizedPath}`, { 
            url, 
            method, 
            body: logBody 
        });
    }

    try {
        const start = Date.now();
        const response = await fetch(url, {
            ...options,
            headers: {
                ...getHeaders(),
                ...options.headers
            }
        });
        const duration = Date.now() - start;

        if (!options.skipLog) {
            const responseClone = response.clone();
            responseClone.text().then(text => {
                let body: any = text;
                try {
                    if (text) body = JSON.parse(text);
                } catch (e) { /* ignore */ }

                const isEmptyHistory = isHistoryPoll && body?.history && Array.isArray(body.history) && body.history.length === 0;

                if (!response.ok) {
                    logger.error('API_RESPONSE_ERROR', `${method} ${normalizedPath} - ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        duration: `${duration}ms`,
                        url,
                        body
                    });
                } else if (!isEmptyHistory) {
                    logger.info('API_RESPONSE', `${method} ${normalizedPath} - ${response.status}`, {
                        status: response.status,
                        duration: `${duration}ms`,
                        body
                    });
                }
            }).catch(err => {
                 logger.error('API_LOGGING_ERROR', 'Failed to read response body', err);
            });
        }

        return response;
    } catch (error) {
        logger.error('API_NETWORK_ERROR', `${method} ${normalizedPath} - Network Error`, error);
        throw error;
    }
};

export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${getApiUrl()}/upload`;
    // Note: Do NOT set Content-Type header for FormData, fetch does it automatically with boundary
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
             // Explicitly don't merge default JSON headers here
            headers: {
                'x-api-key': localStorage.getItem('signalzero_api_key') || ''
            }
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.error('API_UPLOAD_ERROR', 'File upload failed', error);
        throw error;
    }
};