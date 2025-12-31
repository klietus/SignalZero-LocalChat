import { SymbolDef, TestResult, TraceData, TestMeta, EvaluationMetrics } from '../types';
import { apiFetch } from './api';

// --- Chat Service ---

export const resetChatSession = async () => {
    await apiFetch('/chat/reset', { method: 'POST' });
};

export const getSystemPrompt = async (): Promise<string | null> => {
    const res = await apiFetch('/system/prompt', { method: 'GET' });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.prompt ?? null;
};

export const setSystemPrompt = async (prompt: string) => {
    await apiFetch('/system/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt })
    });
};

export const sendMessage = async (
    message: string,
    options?: { newSession?: boolean; contextSessionId?: string }
): Promise<{ text: string, toolCalls?: any[]; contextSessionId?: string; contextStatus?: string }> => {
    const res = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({
            message,
            ...(options?.newSession ? { newSession: true } : {}),
            ...(options?.contextSessionId ? { contextSessionId: options.contextSessionId } : {})
        })
    });
    
    if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
    }

    const data = await res.json();
    return {
        text: data.content,
        toolCalls: data.toolCalls,
        contextSessionId: data.contextSessionId,
        contextStatus: data.contextStatus
    };
};

// --- Logic Generators ---
// These now rely on the backend chat to handle the logic. 
// We send the specific prompt to the chat.

export const generateSymbolSynthesis = async (
    input: string, 
    domain: string, 
    existingSymbols: SymbolDef[] = []
): Promise<string> => {
    const prompt = `
    TASK: Synthesize a new SignalZero Symbol based on the user input.
    TARGET DOMAIN: ${domain}
    USER INPUT: "${input}"
    
    Output valid XML <sz_symbol>...</sz_symbol>.
    `;
    const result = await sendMessage(prompt);
    return result.text;
};

export const generateRefactor = async (
    input: string,
    domain: string,
    existingSymbols: SymbolDef[] = []
): Promise<any> => {
    const prompt = `
    TASK: Refactor existing SignalZero Symbols in the domain '${domain}'.
    USER INSTRUCTION: "${input}"
    Use the bulk_update_symbols tool.
    `;
    return await sendMessage(prompt);
};

export const generatePersonaConversion = async (currentSymbol: SymbolDef): Promise<string> => {
    const prompt = `TASK: Convert this symbol to a Persona: ${JSON.stringify(currentSymbol)}`;
    const result = await sendMessage(prompt);
    return result.text;
};

export const generateLatticeConversion = async (currentSymbol: SymbolDef): Promise<string> => {
    const prompt = `TASK: Convert this symbol to a Lattice: ${JSON.stringify(currentSymbol)}`;
    const result = await sendMessage(prompt);
    return result.text;
};

export const generateGapSynthesis = async (
    promptOriginal: string, 
    szResponse: string, 
    baseResponse: string,
    activeDomains: string[] = [],
    existingSymbols: SymbolDef[] = []
): Promise<string> => {
    const prompt = `
    TASK: Analyze the delta between these responses and synthesize gap symbols.
    Original Prompt: ${promptOriginal}
    Active Domains: ${activeDomains.join(', ')}
    `;
    const result = await sendMessage(prompt);
    return result.text;
};


// --- Test Runner ---

export const runSignalZeroTest = async (
    prompt: string
): Promise<{ text: string, traces: TraceData[], meta: TestMeta }> => {
    // We use the backend test runner infrastructure
    // 1. Create a temporary test set
    const tempId = `temp-${Date.now()}`;
    await apiFetch('/tests/sets', {
        method: 'POST',
        body: JSON.stringify({
            id: tempId,
            name: "Single Run",
            description: "Ephemeral test",
            tests: [prompt]
        })
    });

    // 2. Run it
    const runRes = await apiFetch('/tests/runs', {
        method: 'POST',
        body: JSON.stringify({ testSetId: tempId })
    });
    
    if (!runRes.ok) throw new Error("Test run failed to start");
    const runData = await runRes.json(); // { status, runId }
    
    // 3. Poll for completion (Simple polling for now)
    let finalRun = null;
    for(let i=0; i<30; i++) { // 30 seconds max
        await new Promise(r => setTimeout(r, 1000));
        const check = await apiFetch(`/tests/runs/${runData.runId}`, { skipLog: true }); // reduce noise on polling
        const checkData = await check.json();
        if (checkData.status === 'completed' || checkData.status === 'failed') {
            finalRun = checkData;
            break;
        }
    }

    if (finalRun && finalRun.results && finalRun.results.length > 0) {
        const res = finalRun.results[0];
        return {
            text: res.signalZeroResponse || "",
            traces: res.traces || [],
            meta: res.meta || { startTime: new Date().toISOString(), endTime: new Date().toISOString(), durationMs: 0, loadedDomains: [], symbolCount: 0 }
        };
    }

    throw new Error("Test timed out or returned no results");
};

// Re-export specific helpers if needed by UI
export const evaluateComparison = async (prompt: string, szResponse: string, baseResponse: string): Promise<EvaluationMetrics> => {
    // In the new API, evaluation happens on the server during the test run.
    // This function is kept for backward compatibility if the UI calls it directly,
    // but effectively it should call an eval endpoint. 
    // For now, we stub it or ask the chat to do it.
    const evalPrompt = `Evaluate these responses... JSON Output...`;
    const res = await sendMessage(evalPrompt);
    try {
        return JSON.parse(res.text);
    } catch {
        return {
            sz: { alignment_score: 0, drift_detected: false, symbolic_depth: 0, reasoning_depth: 0, auditability_score: 0 },
            base: { alignment_score: 0, drift_detected: false, symbolic_depth: 0, reasoning_depth: 0, auditability_score: 0 },
            overall_reasoning: "Eval failed"
        };
    }
};
