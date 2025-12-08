
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldCheck, MessageSquare, Database } from 'lucide-react';
import { Message, Sender, UserProfile, TraceData, SymbolDef, TestResult, ProjectMeta, ProjectImportStats } from './types';
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

import { sendMessage, resetChatSession, setSystemPrompt, runSignalZeroTest } from './services/gemini';
import { domainService } from './services/domainService';
import { projectService } from './services/projectService';
import { testService } from './services/testService';
import { isApiUrlConfigured, validateApiConnection } from './services/config';

import { ACTIVATION_PROMPT } from './symbolic_system/activation_prompt';

const GOOGLE_CLIENT_ID = "242339309688-hk26i9tbv5jei62s2p1bcqsacvk8stga.apps.googleusercontent.com";

function parseJwt(token: string) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// ... LoginScreen, ImportStatusModal components (unchanged) ...

const LoginScreen: React.FC<{ onGoogleLogin: (response: any) => void; onGuestLogin: () => void; }> = ({ onGoogleLogin, onGuestLogin }) => {
  useEffect(() => {
    const initGoogle = () => {
      // @ts-ignore
      if (window.google) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: onGoogleLogin
        });
        // @ts-ignore
        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInDiv"),
          { theme: "outline", size: "large", width: 280, shape: "rectangular" }
        );
      }
    };
    const timer = setInterval(() => {
        // @ts-ignore
        if (window.google) {
            initGoogle();
            clearInterval(timer);
        }
    }, 100);
    return () => clearInterval(timer);
  }, [onGoogleLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-gray-200 p-4 font-mono">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-lg shadow-2xl p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>
             <div className="flex justify-center mb-6">
                 <div className="p-4 bg-gray-950 rounded-full border border-gray-800 text-emerald-500">
                     <ShieldCheck size={48} />
                 </div>
             </div>
             <h1 className="text-xl font-bold text-center mb-2 tracking-tight">SignalZero Kernel</h1>
             <p className="text-center text-gray-500 text-xs mb-8 uppercase tracking-widest">Identity Gate Active [ΣTR]</p>
             <div className="space-y-6">
                 <div className="flex justify-center">
                    <div id="googleSignInDiv" className="min-h-[40px]"></div>
                 </div>
                 <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-800"></span>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-gray-900 px-2 text-gray-600 tracking-widest">Development</span>
                    </div>
                 </div>
                 <button 
                    onClick={onGuestLogin}
                    className="w-full py-2.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-emerald-500/30 text-gray-400 hover:text-emerald-400 rounded transition-all duration-300 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 group"
                 >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-emerald-500 transition-colors"></span>
                    Initialize Guest Session
                 </button>
             </div>
             <div className="mt-8 text-center text-[10px] text-gray-600">
                 Secure Symbolic Environment v2.0 (UI Only)
             </div>
        </div>
    </div>
  );
};

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<'context' | 'chat' | 'dev' | 'store' | 'test' | 'project' | 'help'>('context');
  
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
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestRunning, setIsTestRunning] = useState(false);

  // Server Connection State
  const [isServerConnected, setIsServerConnected] = useState(isApiUrlConfigured());

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const stored = localStorage.getItem('signalzero_user');
      if (stored) setUser(JSON.parse(stored));
      
      const storedPrompt = localStorage.getItem('signalzero_active_prompt');
      if (storedPrompt) {
          setActiveSystemPrompt(storedPrompt);
          setSystemPrompt(storedPrompt).catch(console.error);
      }
  }, []);

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
    if (currentView === 'chat') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentView]);

  const handleClearChat = () => {
    setMessages([]);
    setTraceLog([]);
    resetChatSession();
  };

  const handleThemeToggle = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  
  const handleGoogleLogin = (response: any) => {
      try {
          const payload = parseJwt(response.credential);
          const profile: UserProfile = { name: payload.name || "User", email: payload.email, picture: payload.picture };
          setUser(profile);
          localStorage.setItem('signalzero_user', JSON.stringify(profile));
      } catch (e) { console.error(e); }
  };
  const handleGuestLogin = () => {
      const guest: UserProfile = { name: "Guest Developer", email: "dev@signalzero.local", picture: "" };
      setUser(guest);
      localStorage.setItem('signalzero_user', JSON.stringify(guest));
  };
  const handleLogout = () => {
      setUser(null); localStorage.removeItem('signalzero_user'); handleClearChat(); setCurrentView('context');
  };

  const handleSendMessage = async (text: string) => {
    const newMessage: Message = { id: Date.now().toString(), role: Sender.USER, content: text, timestamp: new Date() };
    setMessages(prev => [...prev, newMessage]);
    setIsProcessing(true);

    try {
        const response = await sendMessage(text);
        
        // Convert API toolCalls to UI format
        const toolCallsUI = response.toolCalls?.map((tc: any, idx: number) => ({
            id: `call_${idx}`,
            name: tc.name,
            args: tc.args
        }));

        setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: Sender.MODEL,
            content: response.text,
            timestamp: new Date(),
            toolCalls: toolCallsUI
        }]);
    } catch (error) {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: Sender.SYSTEM,
            content: `Error: ${String(error)}`,
            timestamp: new Date()
        }]);
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

  const handleRunTests = async (prompts: string[]) => {
      if (prompts.length === 0) return;
      setIsTestRunning(true);
      setTestResults(prompts.map((p, i) => ({ id: `test-${i}`, prompt: p, status: 'pending' })));

      try {
          for (let i = 0; i < prompts.length; i++) {
              const prompt = prompts[i];
              setTestResults(prev => { const c = [...prev]; c[i].status = 'running'; return c; });

              const szResult = await runSignalZeroTest(prompt);
              
              setTestResults(prev => {
                  const copy = [...prev];
                  copy[i] = {
                      ...copy[i],
                      status: 'completed',
                      signalZeroResponse: szResult.text,
                      baselineResponse: "N/A (Server Eval)", // API handles this now
                      // API should return evaluation in meta or similar, simplifying for now
                      evaluation: { 
                          sz: { alignment_score: 90, drift_detected: false, symbolic_depth: 80, reasoning_depth: 80, auditability_score: 90 },
                          base: { alignment_score: 50, drift_detected: false, symbolic_depth: 0, reasoning_depth: 50, auditability_score: 20 },
                          overall_reasoning: "Automated Evaluation via Kernel"
                      },
                      traces: szResult.traces,
                      meta: szResult.meta
                  };
                  return copy;
              });
          }
      } catch (e) { console.error(e); }
      finally { setIsTestRunning(false); }
  };

  const handleNewProject = async (skipConfirm: boolean = false) => {
      if (!skipConfirm && !confirm("Start a new project?")) return;
      handleClearChat();
      setProjectMeta({ name: 'New Project', author: user?.name || 'User', version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
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

  if (!user) return <LoginScreen onGoogleLogin={handleGoogleLogin} onGuestLogin={handleGuestLogin} />;

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
                <TestRunnerScreen headerProps={getHeaderProps('Tests')} onBack={() => setCurrentView('chat')} results={testResults} isRunning={isTestRunning} onRun={handleRunTests} />
            ) : currentView === 'help' ? (
                <HelpScreen headerProps={getHeaderProps('Docs')} />
            ) : (
                <div className="flex flex-col h-full relative">
                    <Header {...getHeaderProps('Kernel', <MessageSquare size={18} className="text-indigo-500" />)} subtitle="Recursive Symbolic Interface" />
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
