import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Database, Loader2 } from 'lucide-react';
import { Message, Sender, UserProfile, TraceData, SymbolDef, ProjectMeta, ProjectImportStats, ContextSession, ContextStatus, ContextType, ContextMessage, ContextHistoryGroup } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { Header, HeaderProps } from './components/Header';
import { ContextListPanel } from './components/panels/ContextListPanel';
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
import { LoginScreen } from './components/screens/LoginScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { AgentsScreen } from './components/screens/AgentsScreen';

import { sendMessage, stopMessage, setSystemPrompt, getSystemPrompt } from './services/gemini';
import { domainService } from './services/domainService';
import { projectService } from './services/projectService';
import { testService } from './services/testService';
import { isApiUrlConfigured, validateApiConnection } from './services/config';
import { apiFetch } from './services/api';
import { traceService } from './services/traceService';
import { contextService } from './services/contextService';

import { ACTIVATION_PROMPT } from './symbolic_system/activation_prompt';

const CHAT_HISTORY_KEY = 'signalzero_chat_history'; 

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

const mapSingleContextMessage = (item: ContextMessage): Message => {
    const roleStr = (item.role || 'system').toLowerCase();
    const roleMap: Record<string, Sender> = {
        user: Sender.USER,
        model: Sender.MODEL,
        assistant: Sender.MODEL,
        system: Sender.SYSTEM,
        tool: Sender.MODEL // map tool outputs to MODEL so they merge into assistant block
    };
    const role = roleMap[roleStr] || Sender.SYSTEM;
    
    // Basic parsing of tool calls if stored in backend format
    const toolCalls = item.toolCalls?.map((tc: any, tcIdx: number) => {
        let args = {};
        if (typeof tc.arguments === 'string') {
            try {
                args = JSON.parse(tc.arguments);
            } catch (e) {
                console.warn("Failed to parse tool arguments", e, tc.arguments);
                args = { parseError: true, raw: tc.arguments };
            }
        } else if (typeof tc.arguments === 'object' && tc.arguments !== null) {
            args = tc.arguments;
        } else if (item.toolArgs && tcIdx === 0) {
            // Fallback to top-level toolArgs for single tool calls if present
            args = item.toolArgs;
        }

        return {
            id: tc.id || `${item.timestamp}-${tcIdx}`,
            name: tc.name || item.toolName || 'tool',
            args
        };
    });

    return {
        id: item.id || `${item.timestamp}`,
        role,
        content: item.content || '',
        timestamp: new Date(item.timestamp),
        toolCalls,
        correlationId: item.correlationId,
        toolCallId: item.toolCallId,
        metadata: item.metadata
    };
};

const mergeModelMessages = (msgs: Message[], status?: string): Message => {
    if (msgs.length === 0) throw new Error("Empty merge");
    const last = msgs[msgs.length - 1];
    
    // 1. Gather all tool calls
    const allToolCalls = msgs.flatMap(m => m.toolCalls || []);
    
    // 2. Identify tool results (messages with toolCallId) and map them
    msgs.forEach(m => {
        if (m.toolCallId) {
            const call = allToolCalls.find(tc => tc.id === m.toolCallId);
            if (call) {
                call.result = m.content;
            }
        }
    });

    // 3. Filter content: remove tool results and system logs
    const combinedContent = msgs
        .map(m => m.content)
        .filter(c => {
            if (!c || !c.trim()) return false;
            // Filter out tool results (they are in toolCalls now)
            const isToolResult = msgs.some(m2 => m2.content === c && m2.toolCallId);
            if (isToolResult) return false;
            // Filter out system logs
            if (c.startsWith('[System Log:')) return false;
            return true;
        })
        .join('  \n\n\n');

    return {
        ...msgs[0], 
        content: combinedContent,
        toolCalls: allToolCalls,
        timestamp: last.timestamp, 
        isStreaming: status === 'processing' || msgs.some(m => m.isStreaming)
    };
};

const mergeHistoryGroups = (existing: ContextHistoryGroup[], incoming: ContextHistoryGroup[]): ContextHistoryGroup[] => {
    const map = new Map(existing.map(g => [g.correlationId, g]));
    incoming.forEach(g => map.set(g.correlationId, g));
    return Array.from(map.values()).sort((a, b) => new Date(a.userMessage.timestamp).getTime() - new Date(b.userMessage.timestamp).getTime());
};

function App() {
  const defaultUser: UserProfile = { name: "Guest Developer", email: "dev@signalzero.local", picture: "" };
  
  // State
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<ContextSession[]>([]);
  // Use ContextHistoryGroup[] instead of flat Message[]
  const [messageHistory, setMessageHistory] = useState<Record<string, ContextHistoryGroup[]>>({});
  const [processingContexts, setProcessingContexts] = useState<Set<string>>(new Set());
  
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [currentView, setCurrentView] = useState<'context' | 'chat' | 'dev' | 'store' | 'test' | 'project' | 'help' | 'agents' | 'settings'>('chat');
  const [settingsInitialTab, setSettingsInitialTab] = useState('general');
  
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>(ACTIVATION_PROMPT);
  const [activeMcpPrompt, setActiveMcpPrompt] = useState<string>('');
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>({
      name: 'SignalZero Project', author: 'User', version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  const [importStats, setImportStats] = useState<ProjectImportStats | null>(null);

  const [devInitialDomain, setDevInitialDomain] = useState<string | null>(null);
  const [devInitialSymbol, setDevInitialSymbol] = useState<SymbolDef | null>(null);
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [selectedSymbolContext, setSelectedSymbolContext] = useState<any>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [traceLog, setTraceLog] = useState<TraceData[]>([]);
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState(isApiUrlConfigured());

  // Auth State
  const [appState, setAppState] = useState<'checking' | 'setup' | 'login' | 'app'>('checking');
  const lastActivityRef = useRef(Date.now());

  const handleLogout = useCallback(() => {
      localStorage.removeItem('signalzero_auth_token');
      setUser(defaultUser);
      setActiveContextId(null);
      setMessageHistory({});
      setAppState('login');
      window.location.reload(); 
  }, [defaultUser]);

  // 15-minute auto-logout
  useEffect(() => {
      if (appState !== 'app') return;

      const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes
      const interval = setInterval(() => {
          const now = Date.now();
          if (now - lastActivityRef.current > INACTIVITY_LIMIT) {
              console.log("[Auth] Session expired due to inactivity.");
              handleLogout();
          }
      }, 30000); // Check every 30s

      const activityHandler = () => {
          lastActivityRef.current = Date.now();
      };
      
      window.addEventListener('mousedown', activityHandler);
      window.addEventListener('keydown', activityHandler);
      window.addEventListener('scroll', activityHandler, true);

      return () => {
          clearInterval(interval);
          window.removeEventListener('mousedown', activityHandler);
          window.removeEventListener('keydown', activityHandler);
          window.removeEventListener('scroll', activityHandler, true);
      };
  }, [appState, handleLogout]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const checkAuth = async () => {
        if (!isServerConnected) return;

        try {
            const res = await apiFetch('/auth/status');
            if (res.ok) {
                const data = await res.json();
                if (!data.initialized) {
                    setAppState('setup');
                } else if (!data.authenticated) {
                    setAppState('login');
                } else {
                    if (data.user) {
                        console.log("[App] Auth Success. User:", data.user);
                        setUser(prev => ({ 
                            ...prev, 
                            name: data.user.username,
                            role: data.user.role 
                        }));
                    }
                    setAppState('app');
                }
            } else {
                // Fallback for older servers or non-auth
                setAppState('app');
            }
        } catch (e) {
            console.warn("Auth check failed", e);
            // If auth check fails (e.g. 401 on status? shouldn't happen as status is public),
            // or network error. If network error, main polling will catch it.
            // But let's assume 'app' to not block if endpoint missing.
            setAppState('app');
        }
    };
    
    checkAuth();
  }, [isServerConnected]);

  const handleAuthSuccess = (token: string, userInfo: any) => {
      if (userInfo) {
          console.log("[App] handleAuthSuccess. UserInfo:", userInfo);
          setUser(prev => ({ 
              ...prev, 
              name: userInfo.username || userInfo.name || prev.name, 
              role: userInfo.role || prev.role 
          }));
      }
      setAppState('app');
  };

  const handleScroll = () => {
      if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
          isAtBottomRef.current = isAtBottom;
      }
  };

  const rawGroups = useMemo(() => activeContextId ? messageHistory[activeContextId] || [] : [], [activeContextId, messageHistory]);
  
  const isContextProcessingFromHistory = useMemo(() => {
      if (rawGroups.length === 0) return false;
      const lastGroup = rawGroups[rawGroups.length - 1];
      return lastGroup.status === 'processing';
  }, [rawGroups]);

  const activeContext = useMemo(() => contexts.find(c => c.id === activeContextId), [activeContextId, contexts]);
  const isAgentContext = activeContext?.type === 'agent';

  const messages = useMemo(() => {
      return rawGroups.flatMap(group => {
          const userMsg = mapSingleContextMessage(group.userMessage);
          
          const assistantMsgs = group.assistantMessages.map(mapSingleContextMessage);
          const hasContent = assistantMsgs.some(m => m.content && m.content.trim().length > 0);
          
          const resultMsgs: Message[] = [userMsg];

          if (assistantMsgs.length > 0) {
              const merged = mergeModelMessages(assistantMsgs, group.status);
              // If it's an agent context, show everything.
              // Otherwise, hide empty tool rounds if no content.
              if (isAgentContext || group.status === 'processing' || hasContent) { 
                  resultMsgs.push(merged);
              }
          } else if (group.status === 'processing') {
              // If processing but no assistant messages yet -> Placeholder
              resultMsgs.push({
                  id: 'pending-' + group.correlationId,
                  role: Sender.MODEL,
                  content: '',
                  timestamp: new Date(),
                  isStreaming: true,
                  correlationId: group.correlationId
              });
          }
          
          return resultMsgs;
      });
  }, [rawGroups, isAgentContext]);

  const isCurrentContextProcessing = useMemo(() => {
      const isLocalProcessing = activeContextId ? processingContexts.has(activeContextId) : false;
      return isLocalProcessing || isContextProcessingFromHistory;
  }, [activeContextId, processingContexts, isContextProcessingFromHistory]);

  // Polling Logic
  const latestTimestamps = useRef<Record<string, string>>({});
  const latestTraceTimestamp = useRef<number>(0);
  const prevContextsSig = useRef<string>('');

  useEffect(() => {
      if (!isServerConnected || appState !== 'app') return;

      const poll = async () => {
          try {
              // 1. Refresh Context List
              const list = await contextService.list();
              const activeList = list.filter(c => c.status === 'open').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
              const currentSig = JSON.stringify(activeList);
              if (currentSig !== prevContextsSig.current) {
                  setContexts(activeList);
                  prevContextsSig.current = currentSig;
              }

              // 2. Poll History for Active Contexts
              for (const ctx of activeList) {
                  // Use timestamp of LAST USER MESSAGE in our known history
                  const currentHistory = messageHistory[ctx.id] || [];
                  const lastUserGroup = [...currentHistory].reverse().find(g => true); // Actually just the last group
                  
                  const since = lastUserGroup ? lastUserGroup.userMessage.timestamp : undefined;
                  
                  try {
                      const { history } = await contextService.getHistory(ctx.id, since);
                      // history is ContextHistoryGroup[]
                      if (history.length > 0) {
                          setMessageHistory(prev => ({
                              ...prev,
                              [ctx.id]: mergeHistoryGroups(prev[ctx.id] || [], history)
                          }));
                      }
                  } catch (e) {
                      // ignore
                  }
              }

              // 3. Poll Traces
              try {
                  const newTraces = await traceService.list(latestTraceTimestamp.current);
                  if (newTraces.length > 0) {
                      setTraceLog(prev => {
                          const merged = [...prev, ...newTraces];
                          const unique = Array.from(new Map(merged.map(t => [t.id, t])).values());
                          return unique.sort((a, b) => {
                              const getT = (s?: string) => {
                                  if (!s) return 0;
                                  try { return Number(atob(s)); } catch { return 0; }
                              };
                              return getT(b.created_at) - getT(a.created_at);
                          });
                      });

                      const maxTime = newTraces.reduce((max, t) => {
                          try {
                              const ts = Number(atob(t.created_at || ''));
                              return !isNaN(ts) && ts > max ? ts : max;
                          } catch { return max; }
                      }, latestTraceTimestamp.current);
                      latestTraceTimestamp.current = maxTime;
                  }
              } catch (e) {
                  // ignore trace poll errors
              }
          } catch (e) { console.error(e); }
      };

      const interval = setInterval(poll, 2000);
      return () => clearInterval(interval);
  }, [isServerConnected, appState]); // Added appState dependency

  const handleCreateContext = async () => {
      // Clear view immediately while creating
      setActiveContextId(null);
      try {
          const session = await contextService.create();
          setContexts(prev => [session, ...prev]);
          setMessageHistory(prev => ({ ...prev, [session.id]: [] }));
          setActiveContextId(session.id);
      } catch (e) {
          console.error("Failed to create context", e);
      }
  };

  const handleArchiveContext = async (id: string) => {
      if (!confirm("Archive this context?")) return;
      try {
          await contextService.archive(id);
          setContexts(prev => prev.filter(c => c.id !== id));
          setMessageHistory(prev => {
              const next = { ...prev };
              delete next[id];
              return next;
          });
          if (activeContextId === id) {
              setActiveContextId(null);
          }
      } catch (e) {
          console.error("Failed to archive", e);
      }
  };

  const handleStopMessage = async () => {
      if (activeContextId) {
          await stopMessage(activeContextId);
      }
  };

  const handleSendMessage = async (text: string, options?: { viaVoice?: boolean, attachments?: { id: string, filename: string, type: string }[] }) => {
      if (!activeContextId) {
          alert("Please select or create a context first.");
          return;
      }

      const userId = crypto.randomUUID();
      const newMessage: ContextMessage = { 
          id: userId, 
          role: 'user', 
          content: text, 
          timestamp: new Date().toISOString(),
          metadata: options?.attachments ? { attachments: options.attachments } : undefined
      };
      
      // Optimistic update: Add a new group with the user message
      const optimisticGroup: ContextHistoryGroup = {
          correlationId: userId,
          userMessage: newMessage,
          assistantMessages: [],
          status: 'processing'
      };

      setMessageHistory(prev => ({
          ...prev,
          [activeContextId]: mergeHistoryGroups(prev[activeContextId] || [], [optimisticGroup])
      }));

      setProcessingContexts(prev => new Set(prev).add(activeContextId));

      try {
          await sendMessage(text, activeContextId, userId);
      } catch (e) {
          const errorMsg: ContextMessage = { id: crypto.randomUUID(), role: 'system', content: `Error: ${String(e)}`, timestamp: new Date().toISOString(), correlationId: userId };
          // Append error to the group
          setMessageHistory(prev => {
              const history = prev[activeContextId] || [];
              const groupIndex = history.findIndex(g => g.correlationId === userId);
              if (groupIndex !== -1) {
                  const updated = [...history];
                  updated[groupIndex] = { ...updated[groupIndex], assistantMessages: [errorMsg], status: 'complete' };
                  return { ...prev, [activeContextId]: updated };
              }
              return prev;
          });
      } finally {
          setProcessingContexts(prev => {
              const next = new Set(prev);
              next.delete(activeContextId);
              return next;
          });
      }
  };

  // Scroll to bottom
  useEffect(() => {
      if (isAtBottomRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages]);

  const handleSymbolClick = async (id: string, data?: any) => {
      // ... same as before
      const cached = await domainService.findById(id);
      if (cached) {
          setSelectedSymbolId(id);
          setSelectedSymbolContext(null);
      } else {
          setSelectedSymbolId(id);
          setSelectedSymbolContext(data);
      }
  };

  const getHeaderProps = (title: string, icon?: React.ReactNode): Omit<HeaderProps, 'children'> => ({
      title, 
      icon, 
      currentView, 
      onNavigate: (v: any) => { 
          console.log("[App] onNavigate click:", v);
          setSettingsInitialTab('general'); 
          setCurrentView(v); 
      }, 
      onToggleTrace: () => setIsTracePanelOpen(prev => !prev), 
      isTraceOpen: isTracePanelOpen, 
      onOpenSettings: () => { 
          console.log("[App] onOpenSettings click");
          setSettingsInitialTab('general'); 
          setCurrentView('settings'); 
      }, 
      onNavigateToUsers: () => { 
          console.log("[App] onNavigateToUsers click");
          setSettingsInitialTab('users'); 
          setCurrentView('settings'); 
      },
      onLogout: handleLogout,
      projectName: projectMeta.name, 
      userRole: user.role,
      userName: user.name
  });

  const handleImportProject = async (file: File) => {
      try {
          const result = await projectService.import(file);
          setActiveSystemPrompt(result.systemPrompt);
          setActiveMcpPrompt(result.mcpPrompt);
          setImportStats(result.stats);
          
          const meta = await projectService.getActive();
          if (meta) setProjectMeta(meta);
          
          await setSystemPrompt(result.systemPrompt);
          await projectService.setMcpPrompt(result.mcpPrompt);
      } catch (e) {
          console.error("Import failed", e);
          alert("Failed to import project: " + String(e));
          throw e;
      }
  };



  // Hydrate project meta
  useEffect(() => {
      if (appState !== 'app' || !isServerConnected) return;
      projectService.getActive().then(meta => { if(meta) setProjectMeta(meta); }).catch(() => {});
      getSystemPrompt().then(p => { if(p) setActiveSystemPrompt(p); }).catch(() => {});
      projectService.getMcpPrompt().then(p => { if(p !== undefined) setActiveMcpPrompt(p); }).catch(() => {});
  }, [appState, isServerConnected]);

  // Refresh system prompt when entering project view
  useEffect(() => {
      if (currentView === 'project' && isServerConnected && appState === 'app') {
          getSystemPrompt().then(p => {
              if (p) setActiveSystemPrompt(p);
          }).catch(err => console.error("Failed to refresh system prompt", err));
          projectService.getMcpPrompt().then(p => {
              if (p !== undefined) setActiveMcpPrompt(p);
          }).catch(err => console.error("Failed to refresh MCP prompt", err));
      }
  }, [currentView, isServerConnected, appState]);

  if (!isServerConnected) {
    return <ServerConnectScreen onConnect={() => setIsServerConnected(true)} />; 
  }

  if (appState === 'checking') {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-emerald-600 dark:text-emerald-500">
            <Loader2 className="animate-spin" size={32} />
        </div>
      );
  }

  if (appState === 'setup') {
      return <SetupScreen onSetupComplete={handleAuthSuccess} />;
  }

  if (appState === 'login') {
      return <LoginScreen onLoginSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
        {/* Left Panel */}
        {currentView === 'chat' && (
            <ContextListPanel 
                contexts={contexts}
                activeContextId={activeContextId}
                onSelectContext={setActiveContextId}
                onCreateContext={handleCreateContext}
                onArchiveContext={handleArchiveContext}
            />
        )}

        <div className="flex-1 flex flex-col min-w-0">
            {currentView === 'context' ? (
                <ContextScreen onNewProject={() => {}} onImportProject={handleImportProject} onHelp={() => setCurrentView('help')} />
            ) : currentView === 'project' ? (
                <ProjectScreen 
                    headerProps={getHeaderProps('Project')} 
                    projectMeta={projectMeta} 
                    setProjectMeta={setProjectMeta} 
                    systemPrompt={activeSystemPrompt} 
                    onSystemPromptChange={(val) => { setActiveSystemPrompt(val); setSystemPrompt(val); }} 
                    mcpPrompt={activeMcpPrompt}
                    onMcpPromptChange={(val) => { setActiveMcpPrompt(val); projectService.setMcpPrompt(val); }}
                    onClearChat={() => {}} 
                    onImportProject={handleImportProject} 
                    onNewProject={() => {}} 
                />
            ) : currentView === 'dev' ? (
                <SymbolDevScreen headerProps={getHeaderProps('Forge')} onBack={() => { setDevInitialSymbol(null); setCurrentView('chat'); }} initialDomain={devInitialDomain} initialSymbol={devInitialSymbol} />
            ) : currentView === 'store' ? (
                <SymbolStoreScreen headerProps={getHeaderProps('Store')} onBack={() => setCurrentView('chat')} onNavigateToForge={(dom) => { setDevInitialSymbol(null); setDevInitialDomain(dom); setCurrentView('dev'); }} />
            ) : currentView === 'test' ? (
                <TestRunnerScreen headerProps={getHeaderProps('Tests')} />
            ) : currentView === 'help' ? (
                <HelpScreen headerProps={getHeaderProps('Docs')} />
            ) : currentView === 'agents' ? (
                <AgentsScreen headerProps={getHeaderProps('Agents')} />
            ) : currentView === 'settings' ? (
                <SettingsScreen 
                    headerProps={getHeaderProps('Settings')} 
                    user={user} 
                    onLogout={handleLogout} 
                    initialTab={settingsInitialTab} 
                />
            ) : (
                <div className="flex flex-col h-full relative">
                    <Header
                        {...getHeaderProps('Kernel', <MessageSquare size={18} className="text-indigo-500" />)}
                        subtitle="Recursive Symbolic Interface"
                    >
                        {/* Trash Icon Removed */}
                    </Header>
                    
                    {/* Active Context Header Info */}
                    {activeContextId && (
                        <div className="px-4 pt-2 pb-0 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-mono">
                            <span>Context: {activeContext?.name || activeContextId}</span>
                            {isCurrentContextProcessing && <span className="flex items-center gap-1 text-indigo-500"><Loader2 size={10} className="animate-spin"/> Processing</span>}
                        </div>
                    )}

                    <div 
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
                    >
                        <div className="max-w-full mx-auto space-y-6 pb-4">
                            {!activeContextId ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                                    <MessageSquare size={48} className="mb-4 opacity-50" />
                                    <p>Select or create a context to begin.</p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg) => (
                                        <ChatMessage key={msg.id} message={msg} onSymbolClick={handleSymbolClick} onDomainClick={setSelectedDomain} onTraceClick={(id) => { setSelectedTraceId(id); setIsTracePanelOpen(true); }} onRetry={handleSendMessage} />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>
                    </div>
                    
                    <ChatInput 
                        onSend={handleSendMessage} 
                        onStop={handleStopMessage}
                        disabled={isCurrentContextProcessing || !activeContextId} 
                        isProcessing={isCurrentContextProcessing}
                    />
                    
                    <SymbolDetailPanel symbolId={selectedSymbolId} symbolData={selectedSymbolContext} onClose={() => { setSelectedSymbolId(null); setSelectedSymbolContext(null); }} onSymbolClick={handleSymbolClick} onDomainClick={setSelectedDomain} onInterpret={(id) => handleSendMessage(`Interpret ${id}`)} onOpenInForge={(data) => { setDevInitialSymbol(data); setCurrentView('dev'); setSelectedSymbolId(null); }} />
                    <DomainPanel domain={selectedDomain} onClose={() => setSelectedDomain(null)} onSymbolClick={handleSymbolClick} onLoadDomain={(dom) => handleSendMessage(`Load domain ${dom}`)} onDomainChange={setSelectedDomain} />
                    <TracePanel isOpen={isTracePanelOpen} onClose={() => setIsTracePanelOpen(false)} traces={traceLog} selectedTraceId={selectedTraceId} onSelectTrace={setSelectedTraceId} onSymbolClick={handleSymbolClick} />
                </div>
            )}
        </div>
        <ImportStatusModal stats={importStats} onClose={() => { setImportStats(null); setCurrentView('project'); }} />
    </div>
  );
}

export default App;
