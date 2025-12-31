
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Database, Trash, Loader2, RefreshCcw } from 'lucide-react';
import { Message, Sender, UserProfile, TraceData, SymbolDef, ProjectMeta, ProjectImportStats, ContextSession, ContextStatus, ContextType } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SettingsDialog } from './components/SettingsDialog';
import { Header, HeaderProps } from './components/Header';
// Panels
import { SymbolDetailPanel } from './components/panels/SymbolDetailPanel';
import { DomainPanel } from './components/panels/DomainPanel';
import { TracePanel } from './components/panels/TracePanel';
// Screens
import { SymbolDevScreen } from './components/screens/SymbolDevScreen';
import { SymbolStoreScreen } from './components/screens/SymbolStoreScreen';
import { TestRunnerScreen } from './components/screens/TestRunnerScreen';
import { ProjectScreen } from './components/screens/ProjectScreen';
import { ContextScreen } from './components/screens/ContextScreen';
import { HelpScreen } from './components/screens/HelpScreen';
import { ServerConnectScreen } from './components/screens/ServerConnectScreen';
import { LoopsScreen } from './components/screens/LoopsScreen';

import { sendMessage, resetChatSession, setSystemPrompt, getSystemPrompt } from './services/gemini';
import { domainService } from './services/domainService';
import { projectService } from './services/projectService';
import { testService } from './services/testService';
import { isApiUrlConfigured, validateApiConnection } from './services/config';
import { traceService } from './services/traceService';
import { contextService } from './services/contextService';

import { ACTIVATION_PROMPT } from './symbolic_system/activation_prompt';

const CHAT_HISTORY_KEY = 'signalzero_chat_history';
const ACTIVE_CONTEXT_STORAGE_KEY = 'signalzero_active_context';
const ACTIVE_CONTEXT_META_STORAGE_KEY = 'signalzero_active_context_meta';
const MAX_CHAT_TURNS = 50;
// ... ImportStatusModal same as before ... 
const ImportStatusModal: React.FC<{ stats: ProjectImportStats | null; onClose: () => void; }> = ({ stats, onClose }) => {
    if (!stats) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800 flex justify-between items-center">
                    <h3 className="font-bold font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <Database size={18} /> Project Context Loaded
                    </h3>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider">Project Identity</label>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">{stats.meta.name}</div>
                        <div className="text-xs font-mono text-gray-500">v{stats.meta.version} • by {stats.meta.author}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                            <label className="text-[10px] uppercase font-bold text-gray-400 font-mono block mb-1">Total Symbols</label>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalSymbols}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                            <label className="text-[10px] uppercase font-bold text-gray-400 font-mono block mb-1">Test Cases</label>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.testCaseCount}</div>
                        </div>
                    </div>
                    
                    {stats.domains && stats.domains.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-400 font-mono tracking-wider">Domain Breakdown</label>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="max-h-40 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gray-900 font-bold text-gray-500 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2">Domain</th>
                                                <th className="px-3 py-2 text-right">Symbols</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {stats.domains.sort((a,b) => b.symbolCount - a.symbolCount).map((d) => (
                                                <tr key={d.id} className="hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                                    <td className="px-3 py-1.5 font-mono truncate max-w-[150px]" title={d.name}>{d.name}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-gray-600 dark:text-gray-400">{d.symbolCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
                    <button onClick={onClose} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-mono font-bold transition-colors shadow-sm">
                        Proceed to Project Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};


function App() {
  const defaultUser: UserProfile = { name: "Guest Developer", email: "dev@signalzero.local", picture: "" };
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [currentView, setCurrentView] = useState<'context' | 'chat' | 'dev' | 'store' | 'test' | 'project' | 'help' | 'loops'>('context');
  
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>(ACTIVATION_PROMPT);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>({
      name: 'SignalZero Project', author: 'User', version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  const [importStats, setImportStats] = useState<ProjectImportStats | null>(null);

  const [devInitialDomain, setDevInitialDomain] = useState<string | null>(null);
  const [devInitialSymbol, setDevInitialSymbol] = useState<SymbolDef | null>(null);
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [selectedSymbolContext, setSelectedSymbolContext] = useState<any>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [traceLog, setTraceLog] = useState<TraceData[]>([]);
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<ContextSession[]>([]);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [activeContextStatus, setActiveContextStatus] = useState<ContextStatus | null>(null);
  const [contextTypeFilter, setContextTypeFilter] = useState<'all' | ContextType>('conversation');
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [isLoadingContextHistory, setIsLoadingContextHistory] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  // Server Connection State
  const [isServerConnected, setIsServerConnected] = useState(isApiUrlConfigured());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const speakResponse = useCallback((text: string) => {
      if (typeof window === 'undefined') return;
      const synthesis = window.speechSynthesis;
      if (!synthesis || !text) return;

      synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      synthesis.speak(utterance);
  }, []);

  const stopSpeechPlayback = useCallback(() => {
      if (typeof window === 'undefined') return;
      if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
      }
  }, []);

  const trimChatHistory = useCallback((items: Message[]) => {
      return items.length > MAX_CHAT_TURNS ? items.slice(-MAX_CHAT_TURNS) : items;
  }, []);

  const parseToolArgs = (raw: any) => {
      if (raw === undefined || raw === null) return {};
      if (typeof raw === 'string') {
          try {
              return JSON.parse(raw);
          } catch (e) {
              return { value: raw };
          }
      }
      return raw;
  };

  const persistActiveContext = useCallback((session: { id: string; status?: ContextStatus; type?: ContextType; metadata?: Record<string, any>; createdAt?: string; updatedAt?: string; closedAt?: string | null; }) => {
      localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, session.id);
      try {
          localStorage.setItem(ACTIVE_CONTEXT_META_STORAGE_KEY, JSON.stringify(session));
      } catch (e) {
          console.warn('[Context] Failed to persist context metadata', e);
      }
  }, []);

  const clearPersistedContext = useCallback(() => {
      localStorage.removeItem(ACTIVE_CONTEXT_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CONTEXT_META_STORAGE_KEY);
  }, []);

  const loadContextHistory = useCallback(async (contextId: string) => {
      setIsLoadingContextHistory(true);
      setContextError(null);
      try {
          const { session, history } = await contextService.getHistory(contextId);
          setActiveContextId(session.id);
          setActiveContextStatus(session.status as ContextStatus);
          persistActiveContext(session);

          const sortedHistory = [...(history || [])].sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          const mappedMessages: Message[] = sortedHistory.map((item, idx) => {
              const roleMap: Record<string, Sender> = {
                  user: Sender.USER,
                  model: Sender.MODEL,
                  system: Sender.SYSTEM
              };
              const role = roleMap[item.role] || Sender.SYSTEM;
              const toolCalls = item.toolCalls?.map((tc, tcIdx) => ({
                  id: tc.id || `${item.timestamp}-${tcIdx}`,
                  name: tc.name || 'tool',
                  args: parseToolArgs(tc.arguments)
              }));

              return {
                  id: `${item.timestamp}-${idx}`,
                  role,
                  content: item.content || '',
                  timestamp: new Date(item.timestamp),
                  toolCalls
              };
          });

          setMessages(trimChatHistory(mappedMessages));
      } catch (e: any) {
          console.error('[Context] Failed to load history', e);
          setContextError(e?.message || 'Failed to load context history');
      } finally {
          setIsLoadingContextHistory(false);
      }
  }, [persistActiveContext, trimChatHistory]);

  const refreshContexts = useCallback(async (options: { keepSelection?: boolean } = {}) => {
      if (!isServerConnected) return;
      setIsLoadingContexts(true);
      setContextError(null);
      try {
          const list = await contextService.list();
          const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setContexts(sorted);

          const filtered = sorted.filter(ctx => contextTypeFilter === 'all' ? true : ctx.type === contextTypeFilter);

          const storedContextMetaRaw = localStorage.getItem(ACTIVE_CONTEXT_META_STORAGE_KEY);
          let storedContextId = localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY);
          if (storedContextMetaRaw) {
              try {
                  const parsed = JSON.parse(storedContextMetaRaw);
                  if (parsed?.id) storedContextId = parsed.id;
              } catch (e) {
                  console.warn('[Context] Failed to parse stored context meta', e);
              }
          }

          let nextContextId: string | null = null;
          let nextContextStatus: ContextStatus | null = null;
          if (options.keepSelection && activeContextId && filtered.some(c => c.id === activeContextId)) {
              nextContextId = activeContextId;
              const matching = sorted.find(c => c.id === activeContextId);
              if (matching) {
                  nextContextStatus = matching.status as ContextStatus;
                  setActiveContextStatus(nextContextStatus);
                  persistActiveContext(matching);
              }
          } else {
              if (storedContextId && filtered.some(c => c.id === storedContextId)) {
                  const stored = filtered.find(c => c.id === storedContextId)!;
                  nextContextId = stored.id;
                  nextContextStatus = stored.status as ContextStatus;
              } else {
                  const nextContext =
                      filtered.find(c => c.type === 'conversation' && c.status === 'open') ||
                      filtered.find(c => c.type === 'conversation') ||
                      filtered[0];
                  if (nextContext) {
                      nextContextId = nextContext.id;
                      nextContextStatus = nextContext.status as ContextStatus;
                  }
              }
          }

          if (nextContextId && nextContextId !== activeContextId) {
              await loadContextHistory(nextContextId);
          } else if (nextContextId && nextContextStatus) {
              setActiveContextStatus(nextContextStatus);
              const matching = sorted.find(c => c.id === nextContextId);
              if (matching) persistActiveContext(matching);
          }
      } catch (e: any) {
          console.error('[Context] Failed to load contexts', e);
          setContextError(e?.message || 'Failed to load contexts');
      } finally {
          setIsLoadingContexts(false);
      }
  }, [activeContextId, contextTypeFilter, isServerConnected, loadContextHistory, persistActiveContext]);

  const hydrateProjectContext = useCallback(async (
      options: { navigateOnMeta?: boolean; cancelRef?: { cancelled: boolean } } = {}
  ) => {
      try {
          const [activeMeta, prompt] = await Promise.all([
              projectService.getActive(),
              getSystemPrompt()
          ]);

          if (options.cancelRef?.cancelled) return;

          if (prompt) {
              setActiveSystemPrompt(prompt);
              localStorage.setItem('signalzero_active_prompt', prompt);
          }

          if (activeMeta) {
              setProjectMeta(activeMeta);
              if (options.navigateOnMeta) {
                  setCurrentView(prev => prev === 'context' ? 'project' : prev);
              }
          }
      } catch (e) {
          if (!options.cancelRef?.cancelled) {
              console.error('[Server] Failed to hydrate project context', e);
          }
      }
  }, []);

  useEffect(() => {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-gray-950');

      return () => {
          document.documentElement.classList.remove('dark');
          document.body.classList.remove('bg-gray-950');
      };
  }, []);

  // Check connection on startup
  useEffect(() => {
      if (isApiUrlConfigured()) {
          validateApiConnection().then(isValid => {
              if (!isValid) setIsServerConnected(false);
          });
      }
  }, []);

  useEffect(() => {
      if (!isServerConnected) return;
      refreshContexts();
  }, [isServerConnected, refreshContexts]);

  useEffect(() => {
      if (!isServerConnected) return;
      refreshContexts({ keepSelection: true });
  }, [currentView, contextTypeFilter, isServerConnected, refreshContexts]);

  const filteredContexts = useMemo(
      () => contexts.filter(ctx => contextTypeFilter === 'all' ? true : ctx.type === contextTypeFilter),
      [contexts, contextTypeFilter]
  );

  useEffect(() => {
      if (!isServerConnected) return;

      const cancelRef = { cancelled: false };

      hydrateProjectContext({ navigateOnMeta: true, cancelRef });

      return () => { cancelRef.cancelled = true; };
  }, [hydrateProjectContext, isServerConnected]);

  useEffect(() => {
      if (!isServerConnected || currentView !== 'project') return;

      const cancelRef = { cancelled: false };

      hydrateProjectContext({ cancelRef });

      return () => { cancelRef.cancelled = true; };
  }, [currentView, hydrateProjectContext, isServerConnected]);

  useEffect(() => {
      const stored = localStorage.getItem('signalzero_user');
      if (stored) {
          setUser(JSON.parse(stored));
      } else {
          localStorage.setItem('signalzero_user', JSON.stringify(defaultUser));
      }

      const storedPrompt = localStorage.getItem('signalzero_active_prompt');
      if (storedPrompt) {
          setActiveSystemPrompt(storedPrompt);
      }

      const storedActiveContextMeta = localStorage.getItem(ACTIVE_CONTEXT_META_STORAGE_KEY);
      if (storedActiveContextMeta) {
          try {
              const parsed = JSON.parse(storedActiveContextMeta);
              if (parsed?.id) {
                  setActiveContextId(parsed.id);
                  if (parsed.status) setActiveContextStatus(parsed.status as ContextStatus);
              }
          } catch (e) {
              console.warn('[Context] Failed to hydrate active context', e);
          }
      } else {
          const storedActiveContextId = localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY);
          if (storedActiveContextId) setActiveContextId(storedActiveContextId);
      }

      const storedChat = localStorage.getItem(CHAT_HISTORY_KEY);
      if (storedChat) {
          try {
              const parsed: Message[] = JSON.parse(storedChat);
              const hydrated = parsed.map(msg => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp)
              }));
              setMessages(trimChatHistory(hydrated));
          } catch (e) {
              console.error('[Chat] Failed to hydrate chat history', e);
          }
      }
  }, [trimChatHistory]);

  useEffect(() => {
      if (messages.length === 0) {
          localStorage.removeItem(CHAT_HISTORY_KEY);
          return;
      }

      const serializable = trimChatHistory(messages).map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
      }));

      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(serializable));
  }, [messages, trimChatHistory]);

  useEffect(() => {
    // Basic trace extraction from latest message
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === Sender.MODEL) {
        const regex = /<sz_trace>([\s\S]*?)<\/sz_trace>/g;
        let match;
        while ((match = regex.exec(lastMsg.content)) !== null) {
            try {
                const inner = match[1].replace(/```json\n?|```/g, '').trim();
                const data: TraceData = JSON.parse(inner);
                setTraceLog(prev => {
                    const exists = prev.find(t => t.id === data.id);
                    if (exists) return prev;
                    return [...prev, data];
                });
            } catch (e) {
                console.warn("[TraceLog] Failed to parse trace JSON:", e);
            }
        }
    }
  }, [messages]);

  useEffect(() => {
    if (!isTracePanelOpen || !isServerConnected) return;

    let isCancelled = false;

    const fetchTraces = async () => {
        try {
            const serverTraces = await traceService.list();
            if (isCancelled) return;

            setTraceLog(prev => {
                const merged = new Map(serverTraces.map(t => [t.id, t]));
                prev.forEach(t => { if (!merged.has(t.id)) merged.set(t.id, t); });
                return Array.from(merged.values());
            });

            if (!selectedTraceId && serverTraces.length > 0) {
                setSelectedTraceId(serverTraces[serverTraces.length - 1].id);
            }
        } catch (e) {
            console.error('[TracePanel] Failed to fetch traces from API', e);
        }
    };

    fetchTraces();

    return () => {
        isCancelled = true;
    };
  }, [isTracePanelOpen, isServerConnected, selectedTraceId]);

  useEffect(() => {
    if (currentView === 'chat') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentView]);

  const handleClearChat = () => {
    setMessages([]);
    setTraceLog([]);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    resetChatSession();
    stopSpeechPlayback();
    setActiveContextId(null);
    setActiveContextStatus(null);
    clearPersistedContext();
    refreshContexts();
  };

  const handleLogout = () => {
      setUser(defaultUser);
      localStorage.setItem('signalzero_user', JSON.stringify(defaultUser));
      handleClearChat();
      setCurrentView('context');
  };

  const handleSendMessage = async (text: string, options?: { viaVoice?: boolean }) => {
    const newMessage: Message = { id: Date.now().toString(), role: Sender.USER, content: text, timestamp: new Date() };
    setMessages(prev => trimChatHistory([...prev, newMessage]));
    setIsProcessing(true);

    try {
        const shouldStartNewSession = activeContextStatus === 'closed' || !activeContextId;
        const response = await sendMessage(text, {
            newSession: shouldStartNewSession,
            contextSessionId: shouldStartNewSession ? undefined : activeContextId ?? undefined
        });
        
        // Convert API toolCalls to UI format
        const toolCallsUI = response.toolCalls?.map((tc: any, idx: number) => ({
            id: `call_${idx}`,
            name: tc.name,
            args: parseToolArgs(tc.args ?? tc.arguments)
        }));

        setMessages(prev => trimChatHistory([...prev, {
            id: (Date.now() + 1).toString(),
            role: Sender.MODEL,
            content: response.text,
            timestamp: new Date(),
            toolCalls: toolCallsUI
        }]));
        if (response.contextSessionId) {
            setActiveContextId(response.contextSessionId);
            if (response.contextStatus) setActiveContextStatus(response.contextStatus as ContextStatus);
            persistActiveContext({
                id: response.contextSessionId,
                status: response.contextStatus as ContextStatus
            });
            refreshContexts({ keepSelection: true });
        }
        if (options?.viaVoice) {
            speakResponse(response.text);
        }
    } catch (error) {
        setMessages(prev => trimChatHistory([...prev, {
            id: Date.now().toString(),
            role: Sender.SYSTEM,
            content: `Error: ${String(error)}`,
            timestamp: new Date()
        }]));
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSymbolClick = async (id: string, data?: any) => {
      const cached = await domainService.findById(id);
      if (cached) {
          setSelectedSymbolId(id);
          setSelectedSymbolContext(null);
      } else {
          setSelectedSymbolId(id);
          setSelectedSymbolContext(data);
      }
  };

  const handleContextSelect = (id: string) => {
      if (!id) return;
      loadContextHistory(id);
  };

  const handleNewProject = async (skipConfirm: boolean = false) => {
      if (!skipConfirm && !confirm("Start a new project?")) return;
      handleClearChat();
      setProjectMeta({ name: 'New Project', author: user.name || 'User', version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      await domainService.clearAll();
      await testService.clearTests();
      await setSystemPrompt(ACTIVATION_PROMPT);
      setCurrentView('project');
  };

  const handleImportProject = async (file: File) => {
      try {
          const { systemPrompt, stats } = await projectService.import(file);
          setActiveSystemPrompt(systemPrompt);
          localStorage.setItem('signalzero_active_prompt', systemPrompt);
          setProjectMeta(stats.meta);
          setImportStats(stats);
          handleClearChat();
      } catch (e) {
          alert("Import failed: " + String(e));
      }
  };

  const getHeaderProps = (title: string, icon?: React.ReactNode): Omit<HeaderProps, 'children'> => ({
      title, icon, currentView, onNavigate: setCurrentView, onToggleTrace: () => setIsTracePanelOpen(prev => !prev), isTraceOpen: isTracePanelOpen, onOpenSettings: () => setIsSettingsOpen(true), projectName: projectMeta.name
  });

  if (!isServerConnected) {
    return <ServerConnectScreen onConnect={() => setIsServerConnected(true)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
        <div className="flex-1 flex flex-col min-w-0">
            {currentView === 'context' ? (
                <ContextScreen onNewProject={() => handleNewProject(true)} onImportProject={handleImportProject} onHelp={() => setCurrentView('help')} />
            ) : currentView === 'project' ? (
                <ProjectScreen headerProps={getHeaderProps('Project')} projectMeta={projectMeta} setProjectMeta={setProjectMeta} systemPrompt={activeSystemPrompt} onSystemPromptChange={(val) => { setActiveSystemPrompt(val); setSystemPrompt(val); }} onClearChat={handleClearChat} onImportProject={handleImportProject} onNewProject={() => handleNewProject(true)} />
            ) : currentView === 'dev' ? (
                <SymbolDevScreen headerProps={getHeaderProps('Forge')} onBack={() => { setDevInitialSymbol(null); setCurrentView('chat'); }} initialDomain={devInitialDomain} initialSymbol={devInitialSymbol} />
            ) : currentView === 'store' ? (
                <SymbolStoreScreen headerProps={getHeaderProps('Store')} onBack={() => setCurrentView('chat')} onNavigateToForge={(dom) => { setDevInitialSymbol(null); setDevInitialDomain(dom); setCurrentView('dev'); }} />
            ) : currentView === 'test' ? (
                <TestRunnerScreen headerProps={getHeaderProps('Tests')} />
            ) : currentView === 'help' ? (
                <HelpScreen headerProps={getHeaderProps('Docs')} />
            ) : currentView === 'loops' ? (
                <LoopsScreen headerProps={getHeaderProps('Loops')} />
            ) : (
                <div className="flex flex-col h-full relative">
                    <Header
                        {...getHeaderProps('Kernel', <MessageSquare size={18} className="text-indigo-500" />)}
                        subtitle="Recursive Symbolic Interface"
                    >
                        <button
                            onClick={handleClearChat}
                            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-mono uppercase"
                            title="Reset chat context"
                        >
                            <Trash size={16} />
                        </button>
                    </Header>
                    <div className="px-4 pt-3 space-y-2">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm px-3 py-2 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-600 dark:text-gray-300">
                                <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Context</span>
                                <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 font-semibold">
                                    {activeContextId || 'None'}
                                </span>
                                {activeContextStatus && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${activeContextStatus === 'open' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'}`}>
                                        {activeContextStatus}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 ml-auto flex-wrap">
                                <label className="text-[11px] font-mono uppercase text-gray-500 dark:text-gray-400">Filter</label>
                                <select
                                    className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm font-mono text-gray-800 dark:text-gray-100"
                                    value={contextTypeFilter}
                                    onChange={(e) => setContextTypeFilter(e.target.value as 'all' | ContextType)}
                                >
                                    <option value="all">All</option>
                                    <option value="conversation">Conversation</option>
                                    <option value="loop">Loop</option>
                                </select>
                                <select
                                    className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm font-mono text-gray-800 dark:text-gray-100 min-w-[200px]"
                                    value={activeContextId || ''}
                                    onChange={(e) => handleContextSelect(e.target.value)}
                                >
                                    <option value="" disabled>Select context</option>
                                    {filteredContexts.length === 0 ? (
                                        <option value="">No contexts available</option>
                                    ) : (
                                        filteredContexts.map((ctx) => (
                                            <option key={ctx.id} value={ctx.id}>
                                                {ctx.id} • {ctx.type} • {new Date(ctx.createdAt).toLocaleString()}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <button
                                    onClick={() => refreshContexts({ keepSelection: true })}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-xs font-mono"
                                    title="Refresh contexts"
                                >
                                    <RefreshCcw size={14} className={isLoadingContexts ? 'animate-spin' : ''} />
                                    Sync
                                </button>
                            </div>
                        </div>
                        {contextError && (
                            <div className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-xs text-red-700 dark:text-red-300 font-mono">
                                {contextError}
                            </div>
                        )}
                        {(isLoadingContexts || isLoadingContextHistory) && (
                            <div className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300 font-mono flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Syncing contexts...
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
                        <div className="max-w-full mx-auto space-y-6 pb-4">
                            {messages.map((msg) => (
                                <ChatMessage key={msg.id} message={msg} onSymbolClick={handleSymbolClick} onDomainClick={setSelectedDomain} onTraceClick={(id) => { setSelectedTraceId(id); setIsTracePanelOpen(true); }} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                    <ChatInput onSend={handleSendMessage} disabled={isProcessing} />
                    <SymbolDetailPanel symbolId={selectedSymbolId} symbolData={selectedSymbolContext} onClose={() => { setSelectedSymbolId(null); setSelectedSymbolContext(null); }} onSymbolClick={handleSymbolClick} onDomainClick={setSelectedDomain} onInterpret={(id) => handleSendMessage(`Interpret ${id}`)} onOpenInForge={(data) => { setDevInitialSymbol(data); setCurrentView('dev'); setSelectedSymbolId(null); }} />
                    <DomainPanel domain={selectedDomain} onClose={() => setSelectedDomain(null)} onSymbolClick={handleSymbolClick} onLoadDomain={(dom) => handleSendMessage(`Load domain ${dom}`)} onDomainChange={setSelectedDomain} />
                    <TracePanel isOpen={isTracePanelOpen} onClose={() => setIsTracePanelOpen(false)} traces={traceLog} selectedTraceId={selectedTraceId} onSelectTrace={setSelectedTraceId} onSymbolClick={handleSymbolClick} />
                </div>
            )}
        </div>
        <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} onLogout={handleLogout} />
        <ImportStatusModal stats={importStats} onClose={() => { setImportStats(null); setCurrentView('project'); }} />
    </div>
  );
}

export default App;
