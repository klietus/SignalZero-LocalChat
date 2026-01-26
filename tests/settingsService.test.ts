import assert from 'node:assert';
import { test } from 'node:test';
import { settingsService } from '../services/settingsService.js';

test('settingsService fetches settings', { concurrency: false }, async () => {
    const mockSettings = { inference: { provider: 'openai' }, core: { autoCommit: true } };
    (globalThis as any).fetch = async () => new Response(JSON.stringify(mockSettings));
    
    const settings = await settingsService.get();
    assert.equal(settings.inference.provider, 'openai');
});

test('settingsService updates settings', { concurrency: false }, async () => {
    let capturedBody = '';
    (globalThis as any).fetch = async (_url: string, options: any) => {
        capturedBody = options.body;
        return new Response(JSON.stringify({ ok: true }));
    };
    
    await settingsService.update({ inference: { model: 'new-model' } });
    assert.equal(JSON.parse(capturedBody).inference.model, 'new-model');
});
