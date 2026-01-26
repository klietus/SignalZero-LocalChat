import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { apiFetch, getHeaders } from '../services/api.js';
import { DEFAULT_API_URL, getApiUrl, setApiUrl, isApiUrlConfigured, validateApiConnection } from '../services/config.js';
import { domainService } from '../services/domainService.js';
import { projectService } from '../services/projectService.js';
import { testService } from '../services/testService.js';
import { createToolExecutor, toolDeclarations } from '../services/toolsService.js';
import { traceService } from '../services/traceService.js';
import { vectorService } from '../services/vectorService.js';
import { logger } from '../services/logger.js';
import { SymbolDef, TestCase, TraceData, VectorSearchResult, ProjectMeta, TestSet } from '../types.js';

const storage = (globalThis as any).localStorage;
(globalThis as any).FileReader = class {
  result: string | null = null;
  onload: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  readAsDataURL(file: Blob) {
    this.result = 'data:;base64,' + Buffer.from('data').toString('base64');
    if (this.onload) this.onload({ target: this });
  }
};

const mockLogger = {
  infoCalls: [] as any[],
  errorCalls: [] as any[],
  warnCalls: [] as any[],
  debugCalls: [] as any[],
};

const resetLogger = () => {
  mockLogger.infoCalls = [];
  mockLogger.errorCalls = [];
  mockLogger.warnCalls = [];
  mockLogger.debugCalls = [];
  (logger as any).info = (...args: any[]) => mockLogger.infoCalls.push(args);
  (logger as any).error = (...args: any[]) => mockLogger.errorCalls.push(args);
  (logger as any).warn = (...args: any[]) => mockLogger.warnCalls.push(args);
  (logger as any).debug = (...args: any[]) => mockLogger.debugCalls.push(args);
};

beforeEach(() => {
  storage.clear();
  resetLogger();
});

test('apiFetch normalizes paths and sends headers', { concurrency: false }, async () => {
  storage.setItem('signalzero_auth_token', 'abc');
  storage.setItem('signalzero_api_url', 'http://api.test');
  let receivedUrl = '';
  let receivedHeaders: any = {};
  let receivedMethod = '';

  (globalThis as any).fetch = async (url: string, options: any) => {
    receivedUrl = url;
    receivedHeaders = options.headers;
    receivedMethod = options.method;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const res = await apiFetch('domains', { method: 'POST', body: JSON.stringify({ id: '1' }), skipLog: true });
  assert.equal(receivedUrl, 'http://api.test/domains');
  assert.equal(receivedHeaders['x-auth-token'], 'abc');
  assert.equal(receivedMethod, 'POST');
  assert.equal(res.ok, true);
});

test('apiFetch logs and throws on network error', { concurrency: false }, async () => {
  storage.setItem('signalzero_api_url', 'http://api.test');
  (globalThis as any).fetch = async () => { throw new Error('offline'); };
  await assert.rejects(() => apiFetch('/domains', { skipLog: false }), /offline/);
  assert.equal(mockLogger.errorCalls.length > 0, true);
});

test('config handles api url lifecycle', { concurrency: false }, async () => {
  assert.equal(getApiUrl(), DEFAULT_API_URL);
  setApiUrl('http://example.com/api/');
  assert.equal(getApiUrl(), 'http://example.com/api');
  assert.equal(isApiUrlConfigured(), true);

  (globalThis as any).fetch = async (url: string) => new Response('', { status: url.includes('health') ? 200 : 404 });
  const valid = await validateApiConnection();
  assert.equal(valid, true);
});

test('domainService query and helpers use apiFetch', { concurrency: false }, async () => {
  const symbols: SymbolDef[] = [
    { id: '1', name: 'Test', triad: 'T', role: 'r', symbol_domain: 'demo', symbol_tag: 'tag', facets: {} as any, failure_mode: '', activation_conditions: [], linked_patterns: [], macro: '', kind: 'pattern', created_at: '', updated_at: '' },
    { id: '2', name: 'Other', triad: 'T', role: 'r', symbol_domain: 'demo', symbol_tag: 'tag', facets: {} as any, failure_mode: '', activation_conditions: [], linked_patterns: [], macro: '', kind: 'pattern', created_at: '', updated_at: '' }
  ];
  let called = '';
  (domainService as any).getSymbols = async () => symbols;
  (globalThis as any).fetch = async (url: string) => new Response(JSON.stringify([{ id: 'demo', count: 2 }]));
  const metadata = await domainService.getMetadata();
  assert.equal(metadata[0].count, 2);

  (domainService as any).getSymbols = async () => symbols.slice(0, 1);
  const result = await domainService.query('demo', undefined, 10);
  assert.equal(result.items.length, 1);

  (domainService as any).getSymbols = async () => symbols;
  (globalThis as any).fetch = async (url: string, options: any) => {
    called = `${url}|${options?.method || 'GET'}`;
    return new Response(JSON.stringify({ ok: true, exists: true, enabled: true }));
  };
  assert.equal(await domainService.hasDomain('demo'), true);
  assert.equal(await domainService.isEnabled('demo'), true);
  await domainService.toggleDomain('demo', true);
  assert.equal(called.includes('toggle'), true);
});

test('projectService handles null responses and exports', { concurrency: false }, async () => {
  let calledPath = '';
  (globalThis as any).fetch = async (url: string, options?: any) => {
    calledPath = url;
    if (url.endsWith('active')) {
      return new Response(JSON.stringify({ meta: { name: 'Demo', version: '1', created_at: '', updated_at: '', author: '' } }));
    }
    if (url.endsWith('export')) return new Response('blob-data');
    if (url.endsWith('import')) return new Response(JSON.stringify({ stats: {} }));
    return new Response(JSON.stringify({ prompt: 'system prompt' }));
  };

  const meta = await projectService.getActive();
  assert.equal(meta?.name, 'Demo');

  const blob = await projectService.export({ name: 'Demo', version: '1', created_at: '', updated_at: '', author: '' } as ProjectMeta, '');
  assert.ok(blob);

  await projectService.updateActive({ name: 'Demo', version: '2', created_at: '', updated_at: '', author: '' });
  assert.equal(calledPath.includes('project/active'), true);
});

test('testService handles set lifecycle', { concurrency: false }, async () => {
  const sets: TestSet[] = [{ id: 'set1', name: 'Demo', tests: [{ id: 'case-1', prompt: 'demo', expectedActivations: [] }] }];
  (globalThis as any).fetch = async (_url: string, options?: any) => {
    if (options?.method === 'POST') {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (_url.includes('/tests/sets')) {
          sets.push({ id: body.id, name: body.name || body.id, tests: body.tests || [] });
        } else if (_url.endsWith('/tests')) {
          const set = sets.find(s => s.id === body.testSetId);
          if (set) {
            const newCaseId = `case-${set.tests.length + 1}`;
            set.tests.push({ id: newCaseId, prompt: body.prompt, expectedActivations: body.expectedActivations, name: body.name });
          }
        }
        return new Response(JSON.stringify({}), { status: 200 });
    }
    if (options?.method === 'DELETE') {
      if (_url.includes('/tests/sets/')) {
        const id = _url.split('/').pop();
        const idx = sets.findIndex(s => s.id === id);
        if (idx >= 0) sets.splice(idx, 1);
      } else {
        const parts = _url.split('/');
        const testId = parts.pop();
        const setId = parts.pop();
        const set = sets.find(s => s.id === setId);
        if (set) set.tests = set.tests.filter(t => t.id !== testId);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify(sets));
  };
  const listed = await testService.listTestSets();
  assert.equal(listed.length, 1);
  const created = await testService.createOrUpdateTestSet({ id: 'set2', name: 'Demo2', tests: [] } as any);
  assert.equal(created?.id, 'set2');
  await testService.addTestCase('set1', { name: 'Demo Case', prompt: 'prompt2', expectedActivations: [] });
  assert.equal(sets[0].tests.length, 2);
  await testService.deleteTestCase('set1', 'case-2');
  assert.equal(sets[0].tests.length, 1);
  await testService.deleteTestSet('set2');
});

test('toolsService executor placeholder responds gracefully', { concurrency: false }, async () => {
  const executor = createToolExecutor(() => 'key');
  const result = await executor('demo', { value: 1 });
  assert.equal(result, null);
  assert.ok(Array.isArray(toolDeclarations));
});

test('traceService and vectorService surface responses', { concurrency: false }, async () => {
  const trace: TraceData = { id: '1', entry_node: 'a', activated_by: 'b', activation_path: [], source_context: { symbol_domain: '', trigger_vector: '' }, output_node: 'o', status: 'ok' };
  (globalThis as any).fetch = async () => new Response(JSON.stringify([trace]));
  const traces = await traceService.list();
  assert.equal(traces[0].id, '1');

  const vectorResults: VectorSearchResult[] = [{ id: 'v', score: 1, metadata: {}, document: '' }];
  (globalThis as any).fetch = async () => new Response(JSON.stringify(vectorResults));
  const vectors = await vectorService.search('demo');
  assert.equal(vectors[0].id, 'v');
});
