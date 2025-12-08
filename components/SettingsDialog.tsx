
import React, { useState, useEffect } from 'react';
import { X, Key, Save, Moon, Sun, LogOut, Shield, Database, Server } from 'lucide-react';
import { UserProfile } from '../types';
import { getApiUrl, setApiUrl } from '../services/config';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
    isOpen, 
    onClose,
    user,
    onLogout,
    theme,
    onThemeToggle
}) => {
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('signalzero_api_key');
      if (storedKey) setApiKey(storedKey);
      setServerUrl(getApiUrl());
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('signalzero_api_key', apiKey);
    setApiUrl(serverUrl);
    
    // Slight delay to allow UI to update or simply reload if drastic
    // Since API URL is pulled from localStorage on each request, this is instant for next calls.
    onClose();
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

            {/* Interface Section */}
            <div className="space-y-3 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono">Interface</label>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Theme Preference</span>
                    <button
                        onClick={onThemeToggle}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-xs font-mono font-bold text-gray-700 dark:text-gray-300"
                    >
                        {theme === 'light' ? (
                            <><Moon size={14} /> Dark Mode</>
                        ) : (
                            <><Sun size={14} /> Light Mode</>
                        )}
                    </button>
                </div>
            </div>

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

            {/* API Key Section */}
            <div className="space-y-2 pb-6 border-b border-gray-100 dark:border-gray-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                    <Key size={14} /> SignalZero API Key
                </label>
                <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sz_sk_..."
                    className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-gray-900 dark:text-gray-100"
                />
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                    Required for write operations (save_symbol). Read operations are public.<br/>
                    Key is stored locally in your browser.
                </p>
            </div>

            {/* Vector DB Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                        <Database size={14} /> Vector Store
                    </label>
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        Vector operations are handled by the remote Kernel API.
                    </p>
                </div>
            </div>

        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm font-mono"
            >
                <Save size={16} />
                Save Configuration
            </button>
        </div>
      </div>
    </div>
  );
};
