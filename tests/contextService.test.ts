import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { contextService } from '../services/contextService.js';

test('contextService lists sessions', { concurrency: false }, async () => {
    (globalThis as any).fetch = async () => new Response(JSON.stringify({ contexts: [{ id: 'ctx-1' }] }));
    const sessions = await contextService.list();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, 'ctx-1');
});

test('contextService creates session', { concurrency: false }, async () => {
    let capturedBody = '';
    (globalThis as any).fetch = async (_url: string, options: any) => {
        capturedBody = options.body;
        return new Response(JSON.stringify({ id: 'new-ctx' }));
    };
    const session = await contextService.create('agent');
    assert.equal(session.id, 'new-ctx');
    assert.equal(JSON.parse(capturedBody).type, 'agent');
});

test('contextService archives session', { concurrency: false }, async () => {
    let capturedUrl = '';
    (globalThis as any).fetch = async (url: string) => {
        capturedUrl = url;
        return new Response(null, { status: 200 });
    };
    await contextService.archive('ctx-to-archive');
    assert.ok(capturedUrl.includes('ctx-to-archive/archive'));
});

test('contextService fetches history', { concurrency: false }, async () => {
    (globalThis as any).fetch = async () => new Response(JSON.stringify({ 
        session: { id: 'ctx-1' }, 
        history: [{ correlationId: '1', userMessage: {}, assistantMessages: [], status: 'complete' }] 
    }));
    const data = await contextService.getHistory('ctx-1');
    assert.equal(data.session.id, 'ctx-1');
    assert.equal(data.history.length, 1);
});
