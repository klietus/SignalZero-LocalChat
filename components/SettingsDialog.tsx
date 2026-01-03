
import React, { useState, useEffect } from 'react';
import { X, Save, LogOut, Shield, Database, Server, Network, Lock, Cpu } from 'lucide-react';
import { UserProfile } from '../types';
import { getApiUrl, setApiUrl } from '../services/config';
import { settingsService } from '../services/settingsService';

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
  const [inferenceEndpoint, setInferenceEndpoint] = useState('');
  const [inferenceModel, setInferenceModel] = useState('');
  const [inferenceLoopModel, setInferenceLoopModel] = useState('');
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

    setInferenceEndpoint(inference.endpoint || '');
    setInferenceModel(inference.model || '');
    setInferenceLoopModel(inference.loopModel || inference.model || '');
  };

  useEffect(() => {
    if (isOpen) {
      setServerUrl(getApiUrl());

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
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
        setApiUrl(serverUrl);

        const redisPortNumber = redisPort ? parseInt(redisPort, 10) : undefined;
        const chromaUrl = buildUrlFromParts(chromaHost, chromaPort);
        const inferencePayload = {
            endpoint: inferenceEndpoint || undefined,
            model: inferenceModel || undefined,
            loopModel: inferenceLoopModel || undefined
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
            inference: (inferencePayload.endpoint || inferencePayload.model) ? inferencePayload : undefined
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

            {/* Inference Configuration */}
            <div className="space-y-2 pt-6 border-t border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Cpu size={14} /> Inference
                </label>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Endpoint</span>
                    <input
                        type="text"
                        value={inferenceEndpoint}
                        onChange={(e) => setInferenceEndpoint(e.target.value)}
                        placeholder="http://localhost:1234/v1"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Chat Model</span>
                    <input
                        type="text"
                        value={inferenceModel}
                        onChange={(e) => setInferenceModel(e.target.value)}
                        placeholder="lmstudio-community/Meta-Llama-3-70B-Instruct"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Loop Model</span>
                    <input
                        type="text"
                        value={inferenceLoopModel}
                        onChange={(e) => setInferenceLoopModel(e.target.value)}
                        placeholder="lmstudio-community/Meta-Llama-3-70B-Instruct"
                        className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                    />
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Configure the OpenAI-compatible endpoint and models used for chat and autonomous loops.
                </p>
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
