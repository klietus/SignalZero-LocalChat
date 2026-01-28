
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, LogOut, Shield, Database, Server, Network, Lock, Cpu, Cloud, Search, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { getApiUrl, setApiUrl } from '../services/config';
import { settingsService } from '../services/settingsService';
import { uploadServiceAccount, changePassword } from '../services/api';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogout: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
    isOpen,
    onClose,
    user,
    onLogout
}) => {
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
  const [inferenceProvider, setInferenceProvider] = useState<'local' | 'openai' | 'gemini'>('local');
  const [inferenceApiKey, setInferenceApiKey] = useState('');
  const [inferenceEndpoint, setInferenceEndpoint] = useState('');
  const [inferenceModel, setInferenceModel] = useState('');
  const [inferenceLoopModel, setInferenceLoopModel] = useState('');
  const [inferenceVisionModel, setInferenceVisionModel] = useState('');

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

  const handleProviderChange = (newProvider: 'local' | 'openai' | 'gemini') => {
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
    if (isOpen) {
      setServerUrl(getApiUrl());
      setSaUploadStatus(null);

      const loadSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await settingsService.get();
            console.log("[SettingsDialog] Loaded settings:", settings);
            hydrateSettings(settings);
        } catch (err) {
            console.error('Failed to load settings', err);
            setError('Failed to load settings from the server.');
        } finally {
            setIsLoading(false);
        }
      };

      loadSettings();
    }
  }, [isOpen]);

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
            inference: inferencePayload
        });

        hydrateSettings(updated);
        onClose();
    } catch (err) {
        console.error('Failed to save settings', err);
        setError('Failed to save settings. Please verify your values and try again.');
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50">
           <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 font-mono">
             <Shield size={18} className="text-emerald-500"/>
             System Configuration
           </h3>
           <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

            {error && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-mono">
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-mono">
                    Loading current settings...
                </div>
            )}

            {/* User Profile Section */}
            {user && (
                <div className="space-y-3 pb-6 border-b border-gray-100 dark:border-gray-800">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono">Identity</label>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {user.picture ? (
                                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-700" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-emerald-900/50 border border-emerald-800 flex items-center justify-center text-emerald-400 font-bold text-sm">
                                    {user.name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{user.name}</div>
                                <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                onClose();
                                onLogout();
                            }}
                            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-mono uppercase"
                        >
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            )}

            {/* Server Configuration */}
             <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Server size={14} /> Kernel API Server
                </label>
                <input 
                    type="text" 
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:3000/api"
                    className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                />
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    The endpoint for the SignalZero Kernel. Defaults to local dev server.
                </p>
            </div>

            {/* Redis Configuration */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Database size={14} /> Redis
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Host</span>
                        <input
                            type="text"
                            value={redisHost}
                            onChange={(e) => setRedisHost(e.target.value)}
                            placeholder="localhost"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Port</span>
                        <input
                            type="number"
                            value={redisPort}
                            onChange={(e) => setRedisPort(e.target.value)}
                            placeholder="6379"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase flex items-center gap-2"><Lock size={12} /> Password / Token</span>
                    <input
                        type="password"
                        value={redisPassword}
                        onChange={(e) => setRedisPassword(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Values are persisted on the Kernel via the Settings API.
                </p>
            </div>

            {/* Chroma Configuration */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Network size={14} /> Chroma
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Host</span>
                        <input
                            type="text"
                            value={chromaHost}
                            onChange={(e) => setChromaHost(e.target.value)}
                            placeholder="localhost"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Port</span>
                        <input
                            type="number"
                            value={chromaPort}
                            onChange={(e) => setChromaPort(e.target.value)}
                            placeholder="8000"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Collection Name</span>
                    <input
                        type="text"
                        value={chromaCollection}
                        onChange={(e) => setChromaCollection(e.target.value)}
                        placeholder="signalzero"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Used for vector store operations when configured for external Chroma.
                </p>
            </div>

            {/* Google Search Configuration */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Search size={14} /> Google Search (Tools)
                </label>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase flex items-center gap-2"><Lock size={12} /> API Key</span>
                    <input
                        type="password"
                        value={googleSearchKey}
                        onChange={(e) => setGoogleSearchKey(e.target.value)}
                        placeholder="Google Custom Search API Key"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Search Engine ID (CX)</span>
                    <input
                        type="text"
                        value={googleSearchCx}
                        onChange={(e) => setGoogleSearchCx(e.target.value)}
                        placeholder="e.g. a1b2c3d4e5f6g7h8i"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Required for the system to perform web searches and grounding.
                </p>
            </div>

            {/* Google Cloud Platform Section */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Cloud size={14} /> Google Cloud Platform
                </label>
                <div className="space-y-3">
                    <span className="text-[11px] font-mono text-gray-500 uppercase block">Service Account (JSON)</span>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => saInputRef.current?.click()}
                            disabled={isUploadingSA}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition-all ${
                                isUploadingSA 
                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-emerald-500 dark:hover:border-emerald-500'
                            }`}
                        >
                            <Upload size={14} /> 
                            {isUploadingSA ? 'Uploading...' : 'Upload Service Account Key'}
                        </button>
                        <input 
                            ref={saInputRef}
                            type="file" 
                            accept=".json,application/json"
                            onChange={handleSAFileChange}
                            className="hidden"
                        />
                        {saUploadStatus && (
                            <div className={`flex items-center gap-2 p-2 rounded text-[10px] font-mono ${
                                saUploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                                {saUploadStatus.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {saUploadStatus.message}
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Used to power Google Secret Manager and other GCP-based tools.
                </p>
            </div>

            {/* Security Section */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Lock size={14} /> Security
                </label>
                <div className="space-y-3">
                    <span className="text-[11px] font-mono text-gray-500 uppercase block">Change Admin Password</span>
                    <div className="space-y-2">
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="Current Password"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New Password"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm New Password"
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                        <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition-all ${
                                isChangingPassword 
                                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-emerald-500 dark:hover:border-emerald-500'
                            }`}
                        >
                            <Lock size={14} /> 
                            {isChangingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                        {passwordChangeStatus && (
                            <div className={`flex items-center gap-2 p-2 rounded text-[10px] font-mono ${
                                passwordChangeStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                                {passwordChangeStatus.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {passwordChangeStatus.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Inference Configuration */}
            <div className="space-y-2 pt-6 border-t border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Cpu size={14} /> Inference Provider
                </label>

                {/* Provider Selector */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <button
                        onClick={() => handleProviderChange('local')}
                        className={`flex items-center justify-center gap-2 py-1.5 rounded text-xs font-bold font-mono transition-all ${
                            inferenceProvider === 'local' 
                            ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Server size={12} /> Local
                    </button>
                    <button
                         onClick={() => handleProviderChange('openai')}
                         className={`flex items-center justify-center gap-2 py-1.5 rounded text-xs font-bold font-mono transition-all ${
                            inferenceProvider === 'openai' 
                            ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Cloud size={12} /> OpenAI
                    </button>
                    <button
                         onClick={() => handleProviderChange('gemini')}
                         className={`flex items-center justify-center gap-2 py-1.5 rounded text-xs font-bold font-mono transition-all ${
                            inferenceProvider === 'gemini' 
                            ? 'bg-white dark:bg-gray-700 text-blue-500 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Cpu size={12} /> Gemini
                    </button>
                </div>

                <div className="space-y-4 pt-2">
                    {/* API Key (OpenAI / Gemini) */}
                    {(inferenceProvider === 'openai' || inferenceProvider === 'gemini') && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <span className="text-[11px] font-mono text-gray-500 uppercase flex items-center gap-2">
                                <Lock size={12} /> {inferenceProvider === 'openai' ? 'OpenAI API Key' : 'Gemini API Key'}
                            </span>
                            <input
                                type="password"
                                value={inferenceApiKey}
                                onChange={(e) => setInferenceApiKey(e.target.value)}
                                placeholder="key..."
                                className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Endpoint</span>
                        <input
                            type="text"
                            value={inferenceEndpoint}
                            onChange={(e) => setInferenceEndpoint(e.target.value)}
                            placeholder={inferenceProvider === 'openai' ? 'https://api.openai.com/v1' : (inferenceProvider === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'http://localhost:1234/v1')}
                            disabled={inferenceProvider === 'openai' || inferenceProvider === 'gemini'} 
                            className={`w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100 ${inferenceProvider !== 'local' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {inferenceProvider !== 'local' && <p className="text-[10px] text-gray-400 italic">Using standard provider endpoint.</p>}
                    </div>

                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Chat Model</span>
                        <input
                            type="text"
                            value={inferenceModel}
                            onChange={(e) => setInferenceModel(e.target.value)}
                            placeholder={inferenceProvider === 'openai' ? 'gpt-4-turbo-preview' : (inferenceProvider === 'gemini' ? 'gemini-1.5-pro' : 'lmstudio-community/Meta-Llama-3-70B-Instruct')}
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Loop Model</span>
                        <input
                            type="text"
                            value={inferenceLoopModel}
                            onChange={(e) => setInferenceLoopModel(e.target.value)}
                            placeholder={inferenceProvider === 'openai' ? 'gpt-4-turbo-preview' : (inferenceProvider === 'gemini' ? 'gemini-1.5-pro' : 'lmstudio-community/Meta-Llama-3-70B-Instruct')}
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div className="space-y-2">
                        <span className="text-[11px] font-mono text-gray-500 uppercase">Vision Model</span>
                        <input
                            type="text"
                            value={inferenceVisionModel}
                            onChange={(e) => setInferenceVisionModel(e.target.value)}
                            placeholder={inferenceProvider === 'openai' ? 'gpt-4o-mini' : (inferenceProvider === 'gemini' ? 'gemini-1.5-flash' : '(Optional)')}
                            className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                        />
                         <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                            Used for analyzing uploaded images.
                        </p>
                    </div>
                </div>
            </div>

        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm font-mono text-white ${
                    isSaving || isLoading
                        ? 'bg-emerald-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
        </div>
      </div>
    </div>
  );
};
