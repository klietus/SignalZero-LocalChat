import React, { useEffect, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    FileText,
    History,
    Loader2,
    PauseCircle,
    PlayCircle,
    Plus,
    RefreshCcw,
    Trash2,
    Zap
} from 'lucide-react';
import { Header, HeaderProps } from '../Header';
import { agentService } from '../../services/agentService';
import { AgentDefinition, AgentExecutionWithTraces } from '../../types';

interface AgentsScreenProps {
    headerProps: Omit<HeaderProps, 'children'>;
}

const defaultForm = {
    id: '',
    schedule: '',
    prompt: '',
    enabled: true
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
};

const statusBadge = (enabled: boolean) => (
    <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
            enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }`}
    >
        {enabled ? 'Active' : 'Disabled'}
    </span>
);

const logStatusStyles: Record<string, string> = {
    running: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
};

export const AgentsScreen: React.FC<AgentsScreenProps> = ({ headerProps }) => {
    const [agents, setAgents] = useState<AgentDefinition[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [logs, setLogs] = useState<AgentExecutionWithTraces[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [logsLimit, setLogsLimit] = useState(20);
    const [includeTraces, setIncludeTraces] = useState(false);
    const [logAgentFilter, setLogAgentFilter] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const loadAgents = async (focusId?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await agentService.list();
            setAgents(data);
            if (data.length > 0) {
                const nextSelected = focusId || selectedAgentId || data[0].id;
                setSelectedAgentId(nextSelected);
                const match = data.find((l) => l.id === nextSelected);
                if (match) {
                    setForm({
                        id: match.id,
                        schedule: match.schedule || '',
                        prompt: match.prompt,
                        enabled: match.enabled
                    });
                }
            } else {
                setSelectedAgentId(null);
                setForm(defaultForm);
            }
        } catch (e: any) {
            console.error('[Agents] Failed to load agents', e);
            setError(e?.message || 'Failed to load agents');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAgents();
    }, []);

    const handleSelectAgent = (agent: AgentDefinition) => {
        setSelectedAgentId(agent.id);
        setForm({
            id: agent.id,
            schedule: agent.schedule || '',
            prompt: agent.prompt,
            enabled: agent.enabled
        });
    };

    const resetForm = () => {
        setSelectedAgentId(null);
        setForm(defaultForm);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.id || !form.prompt) {
            alert('Agent ID and prompt are required.');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            await agentService.upsert(form.id, {
                schedule: form.schedule || undefined,
                prompt: form.prompt,
                enabled: form.enabled
            });
            await loadAgents(form.id);
        } catch (err: any) {
            console.error('[Agents] Failed to save agent', err);
            setError(err?.message || 'Failed to save agent');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (agent: AgentDefinition) => {
        setIsSaving(true);
        setError(null);
        try {
            await agentService.upsert(agent.id, {
                schedule: agent.schedule,
                prompt: agent.prompt,
                enabled: !agent.enabled
            });
            await loadAgents(agent.id);
        } catch (err: any) {
            console.error('[Agents] Failed to toggle agent', err);
            setError(err?.message || 'Failed to toggle agent');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (agent: AgentDefinition) => {
        if (!confirm(`Delete agent "${agent.id}"? This cannot be undone.`)) return;
        setIsSaving(true);
        setError(null);
        try {
            await agentService.delete(agent.id);
            await loadAgents();
        } catch (err: any) {
            console.error('[Agents] Failed to delete agent', err);
            setError(err?.message || 'Failed to delete agent');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTrigger = async (agentId: string) => {
        try {
            await agentService.trigger(agentId);
            alert(`Agent ${agentId} triggered successfully.`);
            handleLoadLogs();
        } catch (err: any) {
            alert(`Failed to trigger agent: ${err.message}`);
        }
    };

    const handleLoadLogs = async () => {
        setIsLoadingLogs(true);
        setError(null);
        try {
            const logsData = await agentService.listLogs({
                agentId: logAgentFilter || undefined,
                limit: logsLimit,
                includeTraces
            });
            setLogs(logsData);
        } catch (err: any) {
            console.error('[Agents] Failed to load logs', err);
            setError(err?.message || 'Failed to load agent logs');
        } finally {
            setIsLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (selectedAgentId) {
            setLogAgentFilter((prev) => prev || selectedAgentId);
        }
    }, [selectedAgentId]);

    useEffect(() => {
        handleLoadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
            <Header {...headerProps}>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetForm}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-mono font-bold transition-colors"
                    >
                        <Plus size={14} /> New Agent
                    </button>
                    <button
                        onClick={() => loadAgents(selectedAgentId || undefined)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-mono font-bold transition-colors"
                    >
                        <RefreshCcw size={14} /> Refresh
                    </button>
                </div>
            </Header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {error && (
                    <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono">{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono flex items-center gap-2">
                                    <History size={14} /> Scheduled Agents
                                </h2>
                                <p className="text-xs text-gray-500">Add, edit, disable, or remove active agents.</p>
                            </div>
                            {isLoading && <Loader2 size={18} className="animate-spin text-indigo-500" />}
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[65vh] pr-1">
                            {agents.length === 0 && !isLoading && (
                                <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                                    No agents configured yet. Create one to automate scheduled prompts.
                                </div>
                            )}

                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                                        selectedAgentId === agent.id
                                            ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-900/20'
                                            : 'border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                    }`}
                                    onClick={() => handleSelectAgent(agent)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-mono font-bold text-sm text-gray-800 dark:text-gray-100 truncate" title={agent.id}>
                                                    {agent.id}
                                                </h3>
                                                {statusBadge(agent.enabled)}
                                            </div>
                                            <p className="text-xs text-gray-500">{agent.schedule || 'Event Driven'}</p>
                                            <p className="text-xs text-gray-500">Last run: {formatDate(agent.lastRunAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTrigger(agent.id);
                                                }}
                                                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                                title="Trigger now"
                                            >
                                                <Zap size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggle(agent);
                                                }}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold font-mono transition-colors ${
                                                    agent.enabled
                                                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200'
                                                }`}
                                            >
                                                {agent.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                                                {agent.enabled ? 'Disable' : 'Enable'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(agent);
                                                }}
                                                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                                                title="Delete agent"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2" title={agent.prompt}>
                                        {agent.prompt}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6 xl:col-span-2">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono flex items-center gap-2">
                                    <FileText size={14} /> {selectedAgentId ? 'Edit Agent' : 'Add Agent'}
                                </h2>
                                <p className="text-xs text-gray-500">Configure the schedule, prompt, and enabled status.</p>
                            </div>
                            {isSaving && <Loader2 size={18} className="animate-spin text-indigo-500" />}
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Agent ID</label>
                                    <input
                                        type="text"
                                        value={form.id}
                                        onChange={(e) => setForm({ ...form, id: e.target.value })}
                                        placeholder="daily-index-refresh"
                                        disabled={!!selectedAgentId}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-70"
                                    />
                                    <p className="text-[11px] text-gray-500">IDs cannot be changed once created.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Cron Schedule</label>
                                    <input
                                        type="text"
                                        value={form.schedule}
                                        onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                                        placeholder="0 * * * * (Optional)"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <p className="text-[11px] text-gray-500">Leave empty for event-driven / manual only.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Prompt</label>
                                <textarea
                                    value={form.prompt}
                                    onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                                    rows={6}
                                    placeholder="Describe what the agent should do each run..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <input
                                        id="enabled"
                                        type="checkbox"
                                        checked={form.enabled}
                                        onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="enabled" className="font-mono">Enabled</label>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-mono font-bold transition-colors disabled:opacity-70"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {selectedAgentId ? 'Update Agent' : 'Create Agent'}
                                </button>
                                {selectedAgentId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-mono font-bold transition-colors"
                                    >
                                        <RefreshCcw size={16} /> New Agent
                                    </button>
                                )}
                            </div>
                        </form>
                    </section>
                </div>

                <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono flex items-center gap-2">
                                <Clock size={14} /> Agent Executions
                            </h2>
                            <p className="text-xs text-gray-500">Browse recent agent executions and captured traces.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={logAgentFilter}
                                onChange={(e) => setLogAgentFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            >
                                <option value="">All agents</option>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>{agent.id}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min={1}
                                value={logsLimit}
                                onChange={(e) => setLogsLimit(Number(e.target.value))}
                                className="w-24 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                                title="Maximum logs"
                            />
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={includeTraces}
                                    onChange={(e) => setIncludeTraces(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Include traces
                            </label>
                            <button
                                onClick={handleLoadLogs}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-mono font-bold transition-colors"
                            >
                                {isLoadingLogs ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                                Refresh Logs
                            </button>
                        </div>
                    </div>

                    {logs.length === 0 && !isLoadingLogs ? (
                        <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                            No execution logs yet.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {logs.map((log) => (
                                <div key={log.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50/60 dark:bg-gray-800/60">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${logStatusStyles[log.status] || 'bg-gray-200 text-gray-700'}`}>
                                                {log.status}
                                            </span>
                                            <span className="text-xs font-mono text-gray-500">Agent: {log.agentId}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <Clock size={14} />
                                            <span>{formatDate(log.startedAt)}</span>
                                            <span className="text-gray-400">→</span>
                                            <span>{formatDate(log.finishedAt)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                        {log.responsePreview || 'No preview available.'}
                                    </div>

                                    {log.error && (
                                        <div className="mt-2 text-sm text-rose-500 flex items-center gap-2">
                                            <AlertCircle size={14} /> {log.error}
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <History size={12} />
                                            <span>{log.traceCount ?? 0} traces</span>
                                        </div>
                                        {log.logFilePath && (
                                            <div className="flex items-center gap-1">
                                                <FileText size={12} />
                                                <span className="font-mono">{log.logFilePath}</span>
                                            </div>
                                        )}
                                    </div>

                                    {includeTraces && log.traces && log.traces.length > 0 && (
                                        <div className="mt-3 bg-white/60 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Captured Traces</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {log.traces.map((trace) => (
                                                    <div key={trace.id} className="text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-md p-2 border border-gray-100 dark:border-gray-700">
                                                        <div className="font-mono text-gray-500">Trace #{trace.id}</div>
                                                        <div className="text-gray-900 dark:text-gray-100">{trace.output_node}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
