
export const DEFAULT_API_URL = 'http://localhost:3000/api';
const API_URL_KEY = 'signalzero_api_url';

export const getApiUrl = () => {
    return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
};

export const setApiUrl = (url: string) => {
    let clean = url.trim();
    while (clean.endsWith('/')) {
        clean = clean.slice(0, -1);
    }
    localStorage.setItem(API_URL_KEY, clean);
};

export const isApiUrlConfigured = () => {
    return localStorage.getItem(API_URL_KEY) !== null;
};
