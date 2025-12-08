
import { getApiUrl } from './config';

const getHeaders = () => {
    const key = localStorage.getItem('signalzero_api_key') || '';
    return {
        'Content-Type': 'application/json',
        'x-api-key': key
    };
};

const DEFAULT_SET_ID = 'default-test-set';

export const testService = {
  async getTests(): Promise<string[]> {
    try {
        const res = await fetch(`${getApiUrl()}/tests/sets`, { headers: getHeaders() });
        if (!res.ok) return [];
        const sets = await res.json();
        if (sets.length > 0) {
            return sets[0].tests; // Return first set for now to match UI expectations
        }
        return [];
    } catch (e) {
        console.error("Failed to fetch tests", e);
        return [];
    }
  },

  async addTest(prompt: string): Promise<void> {
    // Fetch existing, append, save. Naive implementation to match previous behavior
    const current = await this.getTests();
    if (!current.includes(prompt)) {
        await this.setTests([...current, prompt]);
    }
  },

  async setTests(prompts: string[]): Promise<void> {
     // Create or update a default set
     await fetch(`${getApiUrl()}/tests/sets`, {
         method: 'POST',
         headers: getHeaders(),
         body: JSON.stringify({
             id: DEFAULT_SET_ID,
             name: "Default Test Suite",
             description: "Client managed test suite",
             tests: prompts
         })
     });
  },

  async clearTests(): Promise<void> {
    await fetch(`${getApiUrl()}/tests/sets/${DEFAULT_SET_ID}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
  }
};
