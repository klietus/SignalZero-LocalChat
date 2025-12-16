
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Database, Trash } from 'lucide-react';
import { Message, Sender, UserProfile, TraceData, SymbolDef, ProjectMeta, ProjectImportStats } from './types';
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

import { ACTIVATION_PROMPT } from './symbolic_system/activation_prompt';

const CHAT_HISTORY_KEY = 'signalzero_chat_history';
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-gray-950');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-gray-950');
      document.body.classList.add('bg-gray-50');
    }
  }, [theme]);

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
  };

  const handleThemeToggle = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
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
        const response = await sendMessage(text);
        
        // Convert API toolCalls to UI format
        const toolCallsUI = response.toolCalls?.map((tc: any, idx: number) => ({
            id: `call_${idx}`,
            name: tc.name,
            args: tc.args
        }));

        setMessages(prev => trimChatHistory([...prev, {
            id: (Date.now() + 1).toString(),
            role: Sender.MODEL,
            content: response.text,
            timestamp: new Date(),
            toolCalls: toolCallsUI
        }]));
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
                <SymbolStoreScreen headerProps={getHeaderProps('Store')} onBack={() => setCurrentView('chat')} onNavigateToForge={(dom) => { setDevInitialDomain(dom); setCurrentView('dev'); }} />
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
        <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} onLogout={handleLogout} theme={theme} onThemeToggle={handleThemeToggle} />
        <ImportStatusModal stats={importStats} onClose={() => { setImportStats(null); setCurrentView('project'); }} />
    </div>
  );
}

export default App;
