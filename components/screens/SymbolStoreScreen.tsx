
import React, { useState, useEffect, useRef } from 'react';
import { ToggleLeft, ToggleRight, CloudDownload, Plus, Edit3, Loader2, ArrowRight, Download, Upload, Trash2, Settings, X, Shield, Tag, FileText, AlertTriangle, Database } from 'lucide-react';
import { domainService } from '../../services/domainService';
import { SymbolDef } from '../../types';
import { Header, HeaderProps } from '../Header';

interface SymbolStoreScreenProps {
  onBack: () => void;
  onNavigateToForge: (domain: string) => void;
  headerProps: Omit<HeaderProps, 'children'>;
}

interface ImportCandidate {
    domainId: string;
    domainName: string;
    description: string;
    invariants: string[];
    symbols: SymbolDef[];
}

export const SymbolStoreScreen: React.FC<SymbolStoreScreenProps> = ({ onBack, onNavigateToForge, headerProps }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Added error state
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDomainId, setNewDomainId] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [newDomainInvariants, setNewDomainInvariants] = useState<string[]>([]);
  const [newInvariantInputCreate, setNewInvariantInputCreate] = useState('');

  const [importCandidate, setImportCandidate] = useState<ImportCandidate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDomainId, setEditDomainId] = useState('');
  const [editDomainName, setEditDomainName] = useState('');
  const [editDomainDesc, setEditDomainDesc] = useState('');
  const [editDomainInvariants, setEditDomainInvariants] = useState<string[]>([]);
  const [newInvariantInputEdit, setNewInvariantInputEdit] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
        const meta = await domainService.getMetadata();
        setItems(meta);
        if (meta.length === 0) {
            setError("No domains found. Please create or import one."); // More specific message
        }
    } catch(e: any) { // Catch as any for error type
      console.error("SymbolStoreScreen: Error loading data:", e);
      setError(e.message || "Failed to load domains.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string, currentState: boolean) => {
    await domainService.toggleDomain(id, !currentState);
    loadData();
  };

  const handleCreateDomain = async () => {
      if (!newDomainId.trim()) return;
      const id = newDomainId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      await domainService.upsertSymbol(id, { // Dummy symbol to init domain
          id: `${id}-init`,
          name: "Init",
          kind: "pattern",
          triad: "INI",
          role: "Initializer",
          symbol_domain: id,
          symbol_tag: "system",
          facets: {} as any,
          failure_mode: "",
          linked_patterns: [],
          macro: ""
      });
      await domainService.updateDomainMetadata(id, {
          name: newDomainName || id,
          description: newDomainDesc,
          invariants: newDomainInvariants
      });
      loadData();
      setIsCreateModalOpen(false);
      onNavigateToForge(id);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const text = event.target?.result as string;
              const json = JSON.parse(text);
              let domainId = '', domainName = '', symbols: SymbolDef[] = [], description = '', invariants: string[] = [];
              if (json.items && Array.isArray(json.items)) {
                  symbols = json.items;
                  domainId = json.domain || 'imported';
                  domainName = json.name || domainId;
                  description = json.description || '';
                  invariants = json.invariants || [];
              }
              setImportCandidate({ domainId, domainName, description, invariants, symbols });
          } catch (err) { alert("Failed to parse file."); }
          finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
      if (!importCandidate) return;
      await domainService.bulkUpsert(importCandidate.domainId, importCandidate.symbols);
      await domainService.updateDomainMetadata(importCandidate.domainId, { name: importCandidate.domainName, description: importCandidate.description, invariants: importCandidate.invariants });
      loadData();
      setImportCandidate(null);
  };

  const handleAddInvariantCreate = () => { if (newInvariantInputCreate.trim()) { setNewDomainInvariants(p => [...p, newInvariantInputCreate.trim()]); setNewInvariantInputCreate(''); } };
  const handleRemoveInvariantCreate = (i: number) => { setNewDomainInvariants(p => p.filter((_, idx) => idx !== i)); };

  const handleEditClick = (item: any) => {
      setEditDomainId(item.id);
      setEditDomainName(item.name || item.id);
      setEditDomainDesc(item.description || '');
      setEditDomainInvariants(item.invariants || []);
      setIsEditModalOpen(true);
  };

  const handleAddInvariantEdit = () => {
      if (newInvariantInputEdit.trim()) {
          setEditDomainInvariants(p => [...p, newInvariantInputEdit.trim()]);
          setNewInvariantInputEdit('');
      }
  };

  const handleRemoveInvariantEdit = (i: number) => {
      setEditDomainInvariants(p => p.filter((_, idx) => idx !== i));
  };

  const handleUpdateDomain = async () => {
      if (!editDomainId) return;
      await domainService.updateDomainMetadata(editDomainId, { name: editDomainName || editDomainId, description: editDomainDesc, invariants: editDomainInvariants });
      await loadData();
      setIsEditModalOpen(false);
  };

  const handleDeleteDomain = async (id: string) => {
      const confirmed = window.confirm(`Delete domain "${id}"? This action cannot be undone.`);
      if (!confirmed) return;
      setLoading(true);
      setError(null);
      try {
          await domainService.deleteDomain(id);
          await loadData();
      } catch (e: any) {
          console.error("SymbolStoreScreen: Error deleting domain:", e);
          setError(e.message || "Failed to delete domain.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-sans">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
      <Header {...headerProps}>
         <div className="flex items-center gap-2">
             <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-mono font-bold transition-colors border border-gray-200 dark:border-gray-700"><Upload size={14} /> Import</button>
             <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-mono font-bold transition-colors"><Plus size={14} /> Create</button>
         </div>
      </Header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3">
                <Database size={20} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200"><strong className="block mb-1 font-mono uppercase text-xs">API Connected</strong>Domains are fetched from the SignalZero Kernel API.</div>
            </div>
            
            {loading && items.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 font-mono text-sm flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin" size={24} />
                    Loading domains...
                </div>
            )}

            {!loading && error && (
                <div className="col-span-full text-center py-12 text-red-500 font-mono text-sm">
                    ERROR: {error}
                </div>
            )}

            {!loading && !error && items.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400 font-mono text-sm">No domains found. Create or Import one.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                        <div key={item.id} className={`relative p-5 rounded-lg border transition-all flex flex-col justify-between group ${item.enabled ? 'bg-white dark:bg-gray-900 border-emerald-500/30 shadow-sm' : 'bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-75'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0"><h3 className="font-bold font-mono text-gray-900 dark:text-gray-100 truncate max-w-[150px]">{item.name}</h3><div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[150px]">{item.id}</div></div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => handleDeleteDomain(item.id)}
                                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                                            title="Delete domain"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(item)}
                                            className="p-2 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 transition-colors"
                                            title="Edit domain metadata"
                                        >
                                            <Settings size={16} />
                                        </button>
                                        <button onClick={() => handleToggle(item.id, item.enabled)} className={`transition-colors p-1 ${item.enabled ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>{item.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed min-h-[48px] max-h-[48px] overflow-hidden">
                                    {item.description || 'No description provided.'}
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
                                    <div><span className="block text-[10px] text-gray-400 uppercase">Symbols</span><span className="font-bold text-lg">{item.count}</span></div>
                                    <div><span className="block text-[10px] text-gray-400 uppercase">Invariants</span><span className="font-bold text-lg">{item.invariants?.length ?? 0}</span></div>
                                </div>
                            </div>
                            <button onClick={() => onNavigateToForge(item.id)} className="mt-4 w-full py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors opacity-0 group-hover:opacity-100"><Edit3 size={12} /> Open in Forge</button>
                        </div>
                    ))}
                </div>
            )}

        </div>
      </div>
      {/* Create Modal */}
      {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                  <h3 className="font-bold font-mono mb-4 text-emerald-500 flex items-center gap-2"><Plus size={18} /> Create Domain</h3>
                  <div className="overflow-y-auto space-y-4 pr-2">
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Domain ID (Slug)</label><input className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 font-mono text-sm" value={newDomainId} onChange={e => setNewDomainId(e.target.value)} /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Display Name</label><input className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm" value={newDomainName} onChange={e => setNewDomainName(e.target.value)} /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Description</label><textarea value={newDomainDesc} onChange={e => setNewDomainDesc(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm" /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Invariants</label><div className="flex gap-2"><input value={newInvariantInputCreate} onChange={e => setNewInvariantInputCreate(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono" /><button onClick={handleAddInvariantCreate} className="px-3 bg-emerald-600 text-white rounded text-xs font-bold">Add</button></div>
                      <div className="mt-1 space-y-1">{newDomainInvariants.map((inv, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-800 p-1 rounded text-xs font-mono"><span>{inv}</span><button onClick={() => handleRemoveInvariantCreate(i)}><X size={12}/></button></div>)}</div></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800"><button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-xs font-mono">Cancel</button><button onClick={handleCreateDomain} disabled={!newDomainId} className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-mono font-bold">Create</button></div>
              </div>
          </div>
      )}
      {/* Edit Modal */}
      {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                  <h3 className="font-bold font-mono mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2"><Settings size={18} /> Edit Domain</h3>
                  <div className="overflow-y-auto space-y-4 pr-2">
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Domain ID</label><input disabled className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 font-mono text-sm opacity-75" value={editDomainId} /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Display Name</label><input className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm" value={editDomainName} onChange={e => setEditDomainName(e.target.value)} /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Description</label><textarea value={editDomainDesc} onChange={e => setEditDomainDesc(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm" /></div>
                      <div className="space-y-1"><label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Invariants</label><div className="flex gap-2"><input value={newInvariantInputEdit} onChange={e => setNewInvariantInputEdit(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono" /><button onClick={handleAddInvariantEdit} className="px-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold">Add</button></div>
                      <div className="mt-1 space-y-1">{editDomainInvariants.map((inv, i) => <div key={i} className="flex justify-between bg-gray-50 dark:bg-gray-800 p-1 rounded text-xs font-mono"><span>{inv}</span><button onClick={() => handleRemoveInvariantEdit(i)}><X size={12}/></button></div>)}</div></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800"><button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-xs font-mono">Cancel</button><button onClick={handleUpdateDomain} disabled={!editDomainId} className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-mono font-bold">Update</button></div>
              </div>
          </div>
      )}
      {importCandidate && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800"><h3 className="font-bold font-mono text-amber-500 mb-4">Confirm Import</h3><p className="text-sm font-mono mb-4">Importing {importCandidate.symbols.length} symbols to {importCandidate.domainId}.</p><div className="flex gap-2 justify-end"><button onClick={() => setImportCandidate(null)} className="px-4 py-2 border rounded text-xs font-mono">Cancel</button><button onClick={handleConfirmImport} className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-mono font-bold">Import</button></div></div></div>}
    </div>
  );
};
