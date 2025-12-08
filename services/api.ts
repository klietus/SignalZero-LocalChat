import { getApiUrl } from './config';
import { logger } from './logger';

export const getHeaders = () => {
    const key = localStorage.getItem('signalzero_api_key') || '';
    return {
        'Content-Type': 'application/json',
        'x-api-key': key
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
    
    if (!options.skipLog) {
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

                if (!response.ok) {
                    logger.error('API_RESPONSE_ERROR', `${method} ${normalizedPath} - ${response.status}`, {
                        status: response.status,
                        statusText: response.statusText,
                        duration: `${duration}ms`,
                        url,
                        body
                    });
                } else {
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