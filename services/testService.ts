import { apiFetch } from './api';
import { TestCase, TestRun, TestSet } from '../types';

const generateTestSetId = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug || 'test-set'}-${Date.now()}`;
};

export const testService = {
  async listTestSets(): Promise<TestSet[]> {
    try {
        const res = await apiFetch('/tests/sets');
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
  },

  async createOrUpdateTestSet(partial: Omit<TestSet, 'id'> & { id?: string }): Promise<TestSet | null> {
    const payload = {
        ...partial,
        id: partial.id || generateTestSetId(partial.name),
    };
    const res = await apiFetch('/tests/sets', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    const sets = await this.listTestSets();
    return sets.find(s => s.id === payload.id) || null;
  },

  async deleteTestSet(id: string): Promise<void> {
    await apiFetch(`/tests/sets/${id}`, { method: 'DELETE' });
  },

  async addTestCase(testSetId: string, testCase: TestCase): Promise<void> {
    await apiFetch('/tests', {
        method: 'POST',
        body: JSON.stringify({
            testSetId,
            prompt: testCase.prompt,
            expectedActivations: testCase.expectedActivations,
            name: testCase.name
        })
    });
  },

  async startTestRun(testSetId: string, compareWithBaseModel: boolean): Promise<string | null> {
    const res = await apiFetch('/tests/runs', {
        method: 'POST',
        body: JSON.stringify({ testSetId, compareWithBaseModel })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.runId || null;
  },

  async listTestRuns(): Promise<TestRun[]> {
    try {
        const res = await apiFetch('/tests/runs');
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
  },

  async getTestRun(id: string): Promise<TestRun | null> {
    const res = await apiFetch(`/tests/runs/${id}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async clearTests(): Promise<void> {
    const sets = await this.listTestSets();
    await Promise.all(sets.map(set => this.deleteTestSet(set.id)));
  }
};