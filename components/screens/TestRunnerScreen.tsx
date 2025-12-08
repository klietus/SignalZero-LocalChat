
import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, BarChart3, FileJson, Download, Network, Clock, Database, Layers, Upload, Sparkles, X, FlaskConical } from 'lucide-react';
import { generateGapSynthesis } from '../../services/gemini';
import { TestResult, SymbolDef, TraceData } from '../../types';
import { testService } from '../../services/testService';
import { domainService } from '../../services/domainService';
import { TraceVisualizer } from '../TraceVisualizer';
import { Header, HeaderProps } from '../Header';

interface TestRunnerScreenProps {
  onBack: () => void;
  results: TestResult[];
  isRunning: boolean;
  onRun: (prompts: string[]) => void;
  headerProps: Omit<HeaderProps, 'children'>;
}

export const TestRunnerScreen: React.FC<TestRunnerScreenProps> = ({ onBack, results, isRunning, onRun, headerProps }) => {
  const [jsonInput, setJsonInput] = useState("[]");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [viewingTrace, setViewingTrace] = useState<TraceData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    testService.getTests().then(cachedTests => {
        setJsonInput(JSON.stringify(cachedTests, null, 2));
    });
  }, []);

  const handleJsonChange = (val: string) => {
      setJsonInput(val);
      try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
              testService.setTests(parsed);
          }
      } catch (e) { }
  };

  const handleRunClick = () => {
      try {
          const prompts: string[] = JSON.parse(jsonInput);
          if (!Array.isArray(prompts)) throw new Error("Input must be a JSON array of strings.");
          onRun(prompts);
      } catch (e) {
          alert("Invalid JSON Input: " + String(e));
      }
  };

  const handleGapSynthesis = async () => {
      const selectedTest = results.find(t => t.id === selectedResultId);
      if (!selectedTest || !selectedTest.signalZeroResponse || !selectedTest.baselineResponse) return;
      setIsSynthesizing(true);
      try {
          const activeDomains = await domainService.listDomains(); // Returns IDs
          // Fetch symbols for active domains
          const allSymbols: SymbolDef[] = [];
          for (const d of activeDomains) {
              const syms = await domainService.getSymbols(d);
              allSymbols.push(...syms);
          }

          const resultText = await generateGapSynthesis(
              selectedTest.prompt,
              selectedTest.signalZeroResponse,
              selectedTest.baselineResponse,
              activeDomains,
              allSymbols
          );
          alert("Gap Synthesis Complete. Check console or implement parsing logic for: " + resultText);
      } catch (e) {
          alert("Gap synthesis failed: " + String(e));
      } finally {
          setIsSynthesizing(false);
      }
  };

  const handleDownloadResults = () => {
      if (results.length === 0) return;
      const data = { timestamp: new Date().toISOString(), test_suite_size: results.length, results: results };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signalzero_test_run_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleExportTests = () => {
      try {
          const data = JSON.parse(jsonInput);
          const jsonString = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `signalzero_test_cases_${new Date().getTime()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      } catch (e) { alert("Invalid JSON"); }
  };

  const handleImportTestsClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const text = event.target?.result as string;
              const json = JSON.parse(text);
              if (Array.isArray(json) && json.every(item => typeof item === 'string')) {
                  setJsonInput(JSON.stringify(json, null, 2));
                  testService.setTests(json);
              } else { alert("Invalid format."); }
          } catch (err) { alert("Failed to parse JSON."); }
          finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };

  const selectedTest = results.find(t => t.id === selectedResultId) || results[0];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-sans">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        <Header {...headerProps}>
            <div className="flex items-center gap-2">
                <button onClick={handleDownloadResults} disabled={results.length === 0} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-md text-sm font-mono font-bold transition-colors border border-gray-200 dark:border-gray-700"><Download size={16} /> JSON Results</button>
                <button onClick={handleRunClick} disabled={isRunning} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md text-sm font-mono font-bold transition-colors">{isRunning ? <Loader2 size={16} className="animate-spin"/> : <Play size={16} />} Run Test Suite</button>
            </div>
        </Header>
        <div className="flex-1 flex overflow-hidden">
            <div className="w-1/3 min-w-[300px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2"><FileJson size={12}/> Test Cases</label>
                        <div className="flex items-center gap-1">
                            <button onClick={handleImportTestsClick} className="p-1.5 text-gray-500 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"><Upload size={14} /></button>
                            <button onClick={handleExportTests} className="p-1.5 text-gray-500 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"><Download size={14} /></button>
                        </div>
                    </div>
                    <textarea value={jsonInput} onChange={e => handleJsonChange(e.target.value)} className="w-full h-32 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none" placeholder='["Test Case 1", "Test Case 2"]' />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {results.map(test => (
                        <button key={test.id} onClick={() => setSelectedResultId(test.id)} className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedResultId === test.id || (!selectedResultId && results[0].id === test.id) ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500' : 'border-l-4 border-transparent'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${test.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : test.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{test.status}</span>
                            </div>
                            <div className="text-xs font-mono text-gray-800 dark:text-gray-200 line-clamp-2">{test.prompt}</div>
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-6 relative">
                {selectedTest ? (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono mb-2">Test Prompt</h3>
                            <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{selectedTest.prompt}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-900/50 shadow-sm flex flex-col h-[500px]">
                            <div className="p-3 border-b border-purple-100 dark:border-purple-900/30 bg-purple-50 dark:bg-purple-900/10 flex justify-between items-center">
                                <span className="font-bold font-mono text-purple-700 dark:text-purple-400 text-xs">KERNEL RESPONSE</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                {selectedTest.signalZeroResponse || <span className="text-gray-400 italic">Pending...</span>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400"><FlaskConical size={48} className="mb-4 opacity-20" /><p className="text-sm font-mono">Select a test case.</p></div>
                )}
            </div>
            {viewingTrace && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800"><div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"><h3 className="font-bold font-mono text-amber-600 dark:text-amber-500 flex items-center gap-2"><Network size={18} /> Symbolic Trace Viewer</h3><button onClick={() => setViewingTrace(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={20} /></button></div><div className="flex-1 overflow-y-auto p-6"><TraceVisualizer trace={viewingTrace} onSymbolClick={() => {}} /></div></div></div>}
        </div>
    </div>
  );
};
