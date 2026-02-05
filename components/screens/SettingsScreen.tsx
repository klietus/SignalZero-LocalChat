import React, { useState, useEffect, useRef } from 'react';
import { 
    Save, Shield, Database, Server, Network, Lock, Cpu, Cloud, 
    Search, Upload, CheckCircle2, AlertCircle, Mic 
} from 'lucide-react';
import { UserProfile } from '../../types';
import { getApiUrl, setApiUrl } from '../../services/config';
import { settingsService } from '../../services/settingsService';
import { uploadServiceAccount, changePassword } from '../../services/api';
import { Header, HeaderProps } from '../Header';

interface SettingsScreenProps {
    headerProps: Omit<HeaderProps, 'children'>;
    user: UserProfile | null;
    onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
    headerProps,
    user,
    onLogout
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [serverUrl, setServerUrl] = useState('');
  const [redisHost, setRedisHost] = useState('');
  const [redisPort, setRedisPort] = useState('');
  const [redisPassword, setRedisPassword] = useState('');
  const [chromaHost, setChromaHost] = useState('');
  const [chromaPort, setChromaPort] = useState('');
  const [chromaCollection, setChromaCollection] = useState('');
  
  // Google Search State
  const [googleSearchKey, setGoogleSearchKey] = useState('');
  const [googleSearchCx, setGoogleSearchCx] = useState('');
  
  // Service Account State
  const [isUploadingSA, setIsUploadingSA] = useState(false);
  const [saUploadStatus, setSaUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const saInputRef = useRef<HTMLInputElement>(null);
  
  // Inference State
  const [inferenceProvider, setInferenceProvider] = useState<'local' | 'openai' | 'gemini' | 'kimi2'>('local');
  const [inferenceApiKey, setInferenceApiKey] = useState('');
  const [inferenceEndpoint, setInferenceEndpoint] = useState('');
  const [inferenceModel, setInferenceModel] = useState('');
  const [inferenceLoopModel, setInferenceLoopModel] = useState('');
  const [inferenceVisionModel, setInferenceVisionModel] = useState('');

  // Voice Server State
  const [pulseServer, setPulseServer] = useState('');
  const [wakeWord, setWakeWord] = useState('');

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Local storage for provider configs during session
  const [storedConfigs, setStoredConfigs] = useState<Record<string, any>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseHostPort = (value: string) => {
    if (!value) return { host: '', port: '' };

    try {
        const withProtocol = value.match(/^https?:\/\//) ? value : `http://${value}`;
        const url = new URL(withProtocol);
        return {
            host: url.hostname,
            port: url.port || ''
        };
    } catch (e) {
        return { host: value, port: '' };
    }
  };

  const buildUrlFromParts = (host: string, port?: string) => {
    if (!host) return '';

    try {
        const withProtocol = host.match(/^https?:\/\//) ? host : `http://${host}`;
        const url = new URL(withProtocol);
        url.port = port || '';
        return url.toString().replace(/\/$/, '');
    } catch (e) {
        return port ? `${host}:${port}` : host;
    }
  };

  const hydrateSettings = (settings: Awaited<ReturnType<typeof settingsService.get>>) => {
    const redis = settings.redis || {};
    const chroma = settings.chroma || {};
    const inference = settings.inference || {};
    const googleSearch = settings.googleSearch || {};
    const voice = settings.voice || {};

    setRedisHost(redis.server || redis.redisServer || '');
    setRedisPort(
        redis.port?.toString() ||
        redis.redisPort?.toString() ||
        ''
    );
    setRedisPassword(redis.password || redis.redisPassword || redis.redisToken || '');

    const chromaUrl = chroma.url || chroma.chromaUrl || '';
    const { host, port } = parseHostPort(chromaUrl);
    setChromaHost(host || chromaUrl);
    setChromaPort(port);
    setChromaCollection(chroma.collection || chroma.collectionName || 'signalzero');

    setGoogleSearchKey(googleSearch.apiKey || '');
    setGoogleSearchCx(googleSearch.cx || '');

    setPulseServer(voice.pulseServer || '');
    setWakeWord(voice.wakeWord || 'axiom');

    const provider = inference.provider || 'local';
    setInferenceProvider(provider);
    setInferenceApiKey(inference.apiKey || '');
    setInferenceEndpoint(inference.endpoint || '');
    setInferenceModel(inference.model || '');
    setInferenceLoopModel(inference.loopModel || inference.model || '');
    setInferenceVisionModel(inference.visionModel || '');
    
    // Load saved configs
    if (inference.savedConfigs) {
        setStoredConfigs(inference.savedConfigs);
    } else {
        // Initialize current as a stored config so we don't lose it on first switch
        setStoredConfigs(prev => ({
            ...prev,
            [provider]: {
                apiKey: inference.apiKey,
                endpoint: inference.endpoint,
                model: inference.model,
                loopModel: inference.loopModel,
                visionModel: inference.visionModel
            }
        }));
    }
  };

  const handleProviderChange = (newProvider: 'local' | 'openai' | 'gemini' | 'kimi2') => {
      // 1. Save current state to storedConfigs
      const currentConfig = {
          apiKey: inferenceApiKey,
          endpoint: inferenceEndpoint,
          model: inferenceModel,
          loopModel: inferenceLoopModel,
          visionModel: inferenceVisionModel
      };
      
      const updatedConfigs = {
          ...storedConfigs,
          [inferenceProvider]: currentConfig
      };
      setStoredConfigs(updatedConfigs);

      // 2. Switch provider state
      setInferenceProvider(newProvider);

      // 3. Load config for new provider if exists, or defaults
      const saved = updatedConfigs[newProvider];
      if (saved) {
          setInferenceApiKey(saved.apiKey || '');
          setInferenceEndpoint(saved.endpoint || '');
          setInferenceModel(saved.model || '');
          setInferenceLoopModel(saved.loopModel || '');
          setInferenceVisionModel(saved.visionModel || '');
      } else {
          // Defaults
          setInferenceApiKey('');
          if (newProvider === 'openai') {
              setInferenceModel('gpt-4-turbo-preview');
              setInferenceLoopModel('gpt-4-turbo-preview');
              setInferenceVisionModel('gpt-4o-mini');
              setInferenceEndpoint('');
          } else if (newProvider === 'gemini') {
              setInferenceModel('gemini-1.5-pro');
              setInferenceLoopModel('gemini-1.5-pro');
              setInferenceVisionModel('gemini-1.5-flash');
              setInferenceEndpoint('');
          } else if (newProvider === 'kimi2') {
              setInferenceModel('kimi-k2-thinking');
              setInferenceLoopModel('kimi-k2-thinking');
              setInferenceVisionModel('kimi-k2-thinking');
              setInferenceEndpoint('');
          } else {
              setInferenceModel('lmstudio-community/Meta-Llama-3-70B-Instruct');
              setInferenceLoopModel('lmstudio-community/Meta-Llama-3-70B-Instruct');
              setInferenceVisionModel('gpt-4o-mini');
              setInferenceEndpoint('');
          }
      }
  };

  const handleSAFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setSaUploadStatus({ type: 'error', message: 'Please upload a valid JSON file.' });
        return;
    }

    setIsUploadingSA(true);
    setSaUploadStatus(null);
    try {
        await uploadServiceAccount(file);
        setSaUploadStatus({ type: 'success', message: 'Service account updated successfully.' });
    } catch (err: any) {
        setSaUploadStatus({ type: 'error', message: err.message || 'Failed to upload service account.' });
    } finally {
        setIsUploadingSA(false);
        if (saInputRef.current) saInputRef.current.value = '';
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
        setPasswordChangeStatus({ type: 'error', message: 'All fields are required.' });
        return;
    }

    if (newPassword !== confirmPassword) {
        setPasswordChangeStatus({ type: 'error', message: 'New passwords do not match.' });
        return;
    }

    setIsChangingPassword(true);
    setPasswordChangeStatus(null);
    try {
        await changePassword(oldPassword, newPassword);
        setPasswordChangeStatus({ type: 'success', message: 'Password changed successfully.' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch (err: any) {
        setPasswordChangeStatus({ type: 'error', message: err.message || 'Failed to change password.' });
    } finally {
        setIsChangingPassword(false);
    }
  };

  useEffect(() => {
      setServerUrl(getApiUrl());
      setSaUploadStatus(null);

      const loadSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await settingsService.get();
            hydrateSettings(settings);
        } catch (err) {
            console.error('Failed to load settings', err);
            setError('Failed to load settings from the server.');
        } finally {
            setIsLoading(false);
        }
      };

      loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
        setApiUrl(serverUrl);

        const redisPortNumber = redisPort ? parseInt(redisPort, 10) : undefined;
        const chromaUrl = buildUrlFromParts(chromaHost, chromaPort);
        
        // Ensure current UI values are saved to the config map before sending
        const currentConfig = {
          apiKey: inferenceApiKey,
          endpoint: inferenceEndpoint,
          model: inferenceModel,
          loopModel: inferenceLoopModel,
          visionModel: inferenceVisionModel
        };
        const finalConfigs = { ...storedConfigs, [inferenceProvider]: currentConfig };

        const inferencePayload = {
            provider: inferenceProvider,
            apiKey: inferenceApiKey,
            endpoint: inferenceEndpoint || undefined,
            model: inferenceModel || undefined,
            loopModel: inferenceLoopModel || undefined,
            visionModel: inferenceVisionModel || undefined,
            savedConfigs: finalConfigs
        };

        const updated = await settingsService.update({
            redis: {
                server: redisHost || undefined,
                port: redisPortNumber,
                password: redisPassword || undefined
            },
            chroma: { 
                url: chromaUrl || undefined,
                collection: chromaCollection || undefined
            },
            googleSearch: {
                apiKey: googleSearchKey || undefined,
                cx: googleSearchCx || undefined
            },
            voice: {
                pulseServer: pulseServer || undefined,
                wakeWord: wakeWord || undefined
            },
            inference: inferencePayload
        });

        hydrateSettings(updated);
        alert('Settings saved successfully!');
    } catch (err) {
        console.error('Failed to save settings', err);
        setError('Failed to save settings. Please verify your values and try again.');
    } finally {
        setIsSaving(false);
    }
  };

  const tabs = [
      { id: 'general', label: 'General', icon: Shield },
      { id: 'inference', label: 'Inference', icon: Cpu },
      { id: 'services', label: 'Services', icon: Cloud },
      { id: 'voice', label: 'Voice Server', icon: Mic },
      { id: 'data', label: 'Data Stores', icon: Database },
      { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
      <Header {...headerProps} title="Settings" subtitle="System Configuration" icon={<Shield size={18} />}>
          <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold font-mono transition-colors text-white ${
                  isSaving || isLoading
                      ? 'bg-emerald-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
          >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
      </Header>

      <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
              <div className="p-4 space-y-1">
                  {tabs.map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                              activeTab === tab.id
                                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                      >
                          <tab.icon size={18} />
                          {tab.label}
                      </button>
                  ))}
              </div>
              
              <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800">
                  {user && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                          {user.picture ? (
                              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700" />
                          ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-800 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                  {user.name.charAt(0)}
                              </div>
                          )}
                          <div className="overflow-hidden">
                              <div className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                              <button
                                  onClick={onLogout}
                                  className="text-[10px] text-red-500 hover:underline font-mono uppercase tracking-wider"
                              >
                                  Sign Out
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto space-y-8">
                  
                  {error && (
                      <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-mono flex items-center gap-3">
                          <AlertCircle size={18} /> {error}
                      </div>
                  )}

                  {activeTab === 'general' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">General Settings</h2>
                              <p className="text-sm text-gray-500">Core connectivity configuration.</p>
                          </div>
                          
                          <div className="space-y-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                              <div className="space-y-2">
                                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                                      <Server size={14} /> Kernel API Server
                                  </label>
                                  <input 
                                      type="text" 
                                      value={serverUrl}
                                      onChange={(e) => setServerUrl(e.target.value)}
                                      placeholder="http://localhost:3000/api"
                                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                  />
                                  <p className="text-xs text-gray-500">
                                      The endpoint for the SignalZero Kernel.
                                  </p>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'inference' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">Inference Engine</h2>
                              <p className="text-sm text-gray-500">Configure the AI models powering the system.</p>
                          </div>

                          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                              <div className="grid grid-cols-4 gap-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                  <button
                                      onClick={() => handleProviderChange('local')}
                                      className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold font-mono transition-all ${
                                          inferenceProvider === 'local' 
                                          ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' 
                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                      }`}
                                  >
                                      <Server size={14} /> Local
                                  </button>
                                  <button
                                      onClick={() => handleProviderChange('openai')}
                                      className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold font-mono transition-all ${
                                          inferenceProvider === 'openai' 
                                          ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' 
                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                      }`}
                                  >
                                      <Cloud size={14} /> OpenAI
                                  </button>
                                  <button
                                      onClick={() => handleProviderChange('gemini')}
                                      className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold font-mono transition-all ${
                                          inferenceProvider === 'gemini' 
                                          ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm' 
                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                      }`}
                                  >
                                      <Cpu size={14} /> Gemini
                                  </button>
                                  <button
                                      onClick={() => handleProviderChange('kimi2')}
                                      className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold font-mono transition-all ${
                                          inferenceProvider === 'kimi2' 
                                          ? 'bg-white dark:bg-gray-700 text-purple-500 shadow-sm' 
                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                      }`}
                                  >
                                      <Cloud size={14} /> Kimi
                                  </button>
                              </div>

                              <div className="space-y-4">
                                  {(inferenceProvider === 'openai' || inferenceProvider === 'gemini' || inferenceProvider === 'kimi2') && (
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                                              {inferenceProvider === 'openai' ? 'OpenAI API Key' : (inferenceProvider === 'gemini' ? 'Gemini API Key' : 'Kimi API Key')}
                                          </label>
                                          <input
                                              type="password"
                                              value={inferenceApiKey}
                                              onChange={(e) => setInferenceApiKey(e.target.value)}
                                              placeholder="sk-..."
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                  )}

                                  <div className="space-y-2">
                                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Endpoint</label>
                                      <input
                                          type="text"
                                          value={inferenceEndpoint}
                                          onChange={(e) => setInferenceEndpoint(e.target.value)}
                                          placeholder={inferenceProvider === 'openai' ? 'https://api.openai.com/v1' : (inferenceProvider === 'gemini' ? 'https://generativelanguage.googleapis.com' : (inferenceProvider === 'kimi2' ? 'https://api.moonshot.ai/v1' : 'http://localhost:1234/v1'))}
                                          disabled={inferenceProvider === 'openai' || inferenceProvider === 'gemini' || inferenceProvider === 'kimi2'} 
                                          className={`w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100 ${inferenceProvider !== 'local' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Chat Model</label>
                                          <input
                                              type="text"
                                              value={inferenceModel}
                                              onChange={(e) => setInferenceModel(e.target.value)}
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Loop Model</label>
                                          <input
                                              type="text"
                                              value={inferenceLoopModel}
                                              onChange={(e) => setInferenceLoopModel(e.target.value)}
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Vision Model</label>
                                      <input
                                          type="text"
                                          value={inferenceVisionModel}
                                          onChange={(e) => setInferenceVisionModel(e.target.value)}
                                          className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                      />
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'services' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">External Services</h2>
                              <p className="text-sm text-gray-500">Integrations with third-party APIs.</p>
                          </div>

                          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                              {/* Google Search */}
                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-100 dark:border-gray-800 pb-2">
                                      <Search size={16} className="text-blue-500" /> Google Custom Search
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">API Key</label>
                                          <input
                                              type="password"
                                              value={googleSearchKey}
                                              onChange={(e) => setGoogleSearchKey(e.target.value)}
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Search Engine ID (CX)</label>
                                          <input
                                              type="text"
                                              value={googleSearchCx}
                                              onChange={(e) => setGoogleSearchCx(e.target.value)}
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                  </div>
                              </div>

                              {/* Google Cloud */}
                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-100 dark:border-gray-800 pb-2">
                                      <Cloud size={16} className="text-gray-500" /> Google Cloud Platform
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Service Account (JSON)</label>
                                      <div className="flex flex-col gap-2">
                                          <button
                                              onClick={() => saInputRef.current?.click()}
                                              disabled={isUploadingSA}
                                              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-mono border border-dashed transition-all ${
                                                  isUploadingSA 
                                                  ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                                  : 'bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                                              }`}
                                          >
                                              <Upload size={16} /> 
                                              {isUploadingSA ? 'Uploading...' : 'Upload Service Account Key File'}
                                          </button>
                                          <input 
                                              ref={saInputRef}
                                              type="file" 
                                              accept=".json,application/json"
                                              onChange={handleSAFileChange}
                                              className="hidden"
                                          />
                                          {saUploadStatus && (
                                              <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-mono border ${
                                                  saUploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                                              }`}>
                                                  {saUploadStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                  {saUploadStatus.message}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'voice' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">Voice Server</h2>
                              <p className="text-sm text-gray-500">Configuration for the TTS and STT services.</p>
                          </div>

                          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                              <div className="space-y-2">
                                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                                      <Server size={14} /> PulseAudio Server
                                  </label>
                                  <input
                                      type="text"
                                      value={pulseServer}
                                      onChange={(e) => setPulseServer(e.target.value)}
                                      placeholder="tcp:host.docker.internal:4713"
                                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                  />
                                  <p className="text-xs text-gray-500">Address of the PulseAudio server.</p>
                              </div>

                              <div className="space-y-2">
                                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                                      <Mic size={14} /> Wake Word
                                  </label>
                                  <input
                                      type="text"
                                      value={wakeWord}
                                      onChange={(e) => setWakeWord(e.target.value)}
                                      placeholder="axiom"
                                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                  />
                                  <p className="text-xs text-gray-500">Word or phrase to trigger the AI.</p>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'data' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">Data Stores</h2>
                              <p className="text-sm text-gray-500">Database connection settings.</p>
                          </div>

                          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                              {/* Redis */}
                              <div className="space-y-4">
                                  <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-100 dark:border-gray-800 pb-2">
                                      <Database size={16} className="text-red-500" /> Redis
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Host</label>
                                          <input
                                              type="text"
                                              value={redisHost}
                                              onChange={(e) => setRedisHost(e.target.value)}
                                              placeholder="localhost"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Port</label>
                                          <input
                                              type="number"
                                              value={redisPort}
                                              onChange={(e) => setRedisPort(e.target.value)}
                                              placeholder="6379"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Password</label>
                                      <input
                                          type="password"
                                          value={redisPassword}
                                          onChange={(e) => setRedisPassword(e.target.value)}
                                          placeholder="Optional"
                                          className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                      />
                                  </div>
                              </div>

                              {/* Chroma */}
                              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                  <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-100 dark:border-gray-800 pb-2">
                                      <Network size={16} className="text-purple-500" /> ChromaDB
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Host</label>
                                          <input
                                              type="text"
                                              value={chromaHost}
                                              onChange={(e) => setChromaHost(e.target.value)}
                                              placeholder="localhost"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Port</label>
                                          <input
                                              type="number"
                                              value={chromaPort}
                                              onChange={(e) => setChromaPort(e.target.value)}
                                              placeholder="8000"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Collection Name</label>
                                      <input
                                          type="text"
                                          value={chromaCollection}
                                          onChange={(e) => setChromaCollection(e.target.value)}
                                          placeholder="signalzero"
                                          className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                      />
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {activeTab === 'security' && (
                      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                          <div>
                              <h2 className="text-lg font-bold mb-1">Security</h2>
                              <p className="text-sm text-gray-500">Manage access control and authentication.</p>
                          </div>

                          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                              <div className="space-y-4">
                                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                                      <Lock size={14} /> Change Admin Password
                                  </label>
                                  <div className="space-y-3">
                                      <input
                                          type="password"
                                          value={oldPassword}
                                          onChange={(e) => setOldPassword(e.target.value)}
                                          placeholder="Current Password"
                                          className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                      />
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <input
                                              type="password"
                                              value={newPassword}
                                              onChange={(e) => setNewPassword(e.target.value)}
                                              placeholder="New Password"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                          <input
                                              type="password"
                                              value={confirmPassword}
                                              onChange={(e) => setConfirmPassword(e.target.value)}
                                              placeholder="Confirm New Password"
                                              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                                          />
                                      </div>
                                      
                                      <div className="pt-2">
                                          <button
                                              onClick={handleChangePassword}
                                              disabled={isChangingPassword}
                                              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                  isChangingPassword 
                                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                  : 'bg-white border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                              }`}
                                          >
                                              {isChangingPassword ? 'Updating...' : 'Update Password'}
                                          </button>
                                      </div>

                                      {passwordChangeStatus && (
                                          <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-mono border ${
                                              passwordChangeStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                                          }`}>
                                              {passwordChangeStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                              {passwordChangeStatus.message}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

              </div>
          </main>
      </div>
    </div>
  );
};
