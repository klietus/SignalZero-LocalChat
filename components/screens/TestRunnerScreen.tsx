import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Plus,
  History,
  Loader2,
  Rocket,
  Beaker,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ClipboardList,
  FilePlus,
  X,
  BarChart3
} from 'lucide-react';
import { Header, HeaderProps } from '../Header';
import { TraceVisualizer } from '../TraceVisualizer';
import { TestCase, TestResult, TestRun, TestSet, TraceData } from '../../types';
import { testService } from '../../services/testService';

interface TestRunnerScreenProps {
  headerProps: Omit<HeaderProps, 'children'>;
}

const statusColor = (status: TestRun['status'] | TestResult['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'running':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'failed':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString();
};

const mergeRuns = (existing: TestRun[], updated: TestRun) => {
  const filtered = existing.filter(r => r.id !== updated.id);
  return [updated, ...filtered].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bTime - aTime;
  });
};

export const TestRunnerScreen: React.FC<TestRunnerScreenProps> = ({ headerProps }) => {
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [view, setView] = useState<'results' | 'history'>('results');

  const [isLoadingSets, setIsLoadingSets] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);

  const [showSetDialog, setShowSetDialog] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');

  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseName, setCaseName] = useState('');
  const [casePrompt, setCasePrompt] = useState('');
  const [caseActivations, setCaseActivations] = useState('');
  const [isSavingCase, setIsSavingCase] = useState(false);

  const [showRunDialog, setShowRunDialog] = useState(false);
  const [compareWithBaseModel, setCompareWithBaseModel] = useState(true);

  const [viewingTrace, setViewingTrace] = useState<TraceData | null>(null);

  const selectedSet = useMemo(
    () => testSets.find(set => set.id === selectedSetId) || null,
    [selectedSetId, testSets]
  );

  const runsForSet = useMemo(
    () => runs.filter(r => (selectedSetId ? r.testSetId === selectedSetId : true)),
    [runs, selectedSetId]
  );

  const selectedRun = useMemo(() => {
    const explicit = runs.find(r => r.id === selectedRunId);
    if (explicit) return explicit;
    if (runsForSet.length > 0) return runsForSet[0];
    return runs[0];
  }, [runs, runsForSet, selectedRunId]);

  const loadTestSets = async () => {
    setIsLoadingSets(true);
    const sets = await testService.listTestSets();
    setTestSets(sets);
    if (!selectedSetId && sets.length > 0) {
      setSelectedSetId(sets[0].id);
    }
    setIsLoadingSets(false);
  };

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    const data = await testService.listTestRuns();
    setRuns(data);
    setIsLoadingRuns(false);
  };

  useEffect(() => {
    loadTestSets();
    loadRuns();
  }, []);

  useEffect(() => {
    if (selectedSetId && runsForSet.length > 0) {
      setSelectedRunId(runsForSet[0].id);
    }
  }, [selectedSetId, runsForSet]);

  const handleCreateSet = async () => {
    if (!newSetName.trim()) return;
    const created = await testService.createOrUpdateTestSet({
      name: newSetName.trim(),
      description: newSetDescription.trim(),
      tests: []
    });
    setShowSetDialog(false);
    setNewSetName('');
    setNewSetDescription('');
    await loadTestSets();
    if (created) setSelectedSetId(created.id);
  };

  const handleAddTestCase = async () => {
    if (!selectedSetId || !casePrompt.trim()) return;
    setIsSavingCase(true);
    const expected = caseActivations
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const testCase: TestCase = {
      name: caseName.trim() || undefined,
      prompt: casePrompt.trim(),
      expectedActivations: expected
    };
    await testService.addTestCase(selectedSetId, testCase);
    await loadTestSets();
    setShowCaseForm(false);
    setCaseName('');
    setCasePrompt('');
    setCaseActivations('');
    setIsSavingCase(false);
  };

  const pollRun = async (runId: string) => {
    setPollingRunId(runId);
    for (let i = 0; i < 60; i++) {
      const latest = await testService.getTestRun(runId);
      if (latest) {
        setRuns(prev => mergeRuns(prev, latest));
        if (latest.status === 'completed' || latest.status === 'failed') break;
      }
      await new Promise(res => setTimeout(res, 1000));
    }
    setPollingRunId(null);
    loadRuns();
  };

  const handleStartRun = async () => {
    if (!selectedSetId) return;
    setIsStartingRun(true);
    const runId = await testService.startTestRun(selectedSetId, compareWithBaseModel);
    if (runId) {
      setShowRunDialog(false);
      setSelectedRunId(runId);
      setView('results');
      pollRun(runId);
    }
    setIsStartingRun(false);
  };

  const activationStats = (result: TestResult) => {
    const expected = result.expectedActivations ||
      selectedSet?.tests.find(t => t.id === result.id || t.prompt === result.prompt)?.expectedActivations ||
      [];
    const missing = new Set(result.missingActivations || []);
    const passedCount = expected.filter(act => !missing.has(act)).length;
    return { expected, missing, passedCount };
  };

  const runStatusBadge = (status: TestRun['status'] | TestResult['status']) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(status)}`}>
      {status}
    </span>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-sans">
      <Header {...headerProps} />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 min-w-[300px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Test Set</label>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md px-2 py-1 text-sm text-gray-800 dark:text-gray-100 shadow-sm"
                  value={selectedSetId || ''}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  disabled={isLoadingSets}
                >
                  {testSets.map(set => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSetDialog(true)}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 rounded border border-purple-200 dark:border-purple-800 hover:bg-purple-200/80 dark:hover:bg-purple-900/60 transition-colors"
                >
                  <Plus size={14} /> New Set
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Test Cases</p>
                <p className="text-xs text-gray-500">{selectedSet ? selectedSet.tests.length : 0} cases</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRunDialog(true)}
                  disabled={!selectedSetId || isStartingRun || !!pollingRunId}
                  title="Start run"
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md shadow-sm transition-colors"
                >
                  {isStartingRun ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => setView(view === 'history' ? 'results' : 'history')}
                  title={view === 'history' ? 'Back to results' : 'Run history'}
                  className={`p-2 rounded-md border transition-colors ${view === 'history' ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/70'}`}
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => setShowCaseForm(v => !v)}
                  disabled={!selectedSetId}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/50 disabled:opacity-50"
                >
                  <FilePlus size={14} /> Add Case
                </button>
              </div>
            </div>

            {showCaseForm && (
              <div className="space-y-2 bg-gray-50 dark:bg-gray-800/60 p-3 rounded border border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Case name"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                />
                <textarea
                  placeholder="Prompt"
                  value={casePrompt}
                  onChange={(e) => setCasePrompt(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[80px]"
                />
                <input
                  type="text"
                  placeholder="Expected activations (comma separated ids)"
                  value={caseActivations}
                  onChange={(e) => setCaseActivations(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCaseForm(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTestCase}
                    disabled={isSavingCase}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow disabled:opacity-50"
                  >
                    {isSavingCase ? <Loader2 size={14} className="animate-spin" /> : 'Save Case'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
            {isLoadingSets ? (
              <div className="p-4 text-sm text-gray-500">Loading test sets...</div>
            ) : selectedSet && selectedSet.tests.length > 0 ? (
              selectedSet.tests.map((test) => (
                <div key={test.id || test.prompt} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{test.name || 'Unnamed Case'}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{test.prompt}</p>
                    </div>
                    <ClipboardList size={16} className="text-gray-400" />
                  </div>
                  {test.expectedActivations && test.expectedActivations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {test.expectedActivations.map((act) => (
                        <span key={act} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                          {act}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">No test cases yet.</div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-6">
          {view === 'history' ? (
            <div className="space-y-3 max-w-5xl mx-auto">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-bold tracking-wider">
                <History size={14} /> Run History
              </div>
              {isLoadingRuns ? (
                <div className="text-sm text-gray-500">Loading runs...</div>
              ) : runsForSet.length === 0 ? (
                <div className="text-sm text-gray-500">No runs found for this test set.</div>
              ) : (
                runsForSet.map(run => (
                  <button
                    key={run.id}
                    onClick={() => { setSelectedRunId(run.id); setView('results'); }}
                    className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {runStatusBadge(run.status)}
                        <span className="text-xs text-gray-500">{run.testSetName || 'Untitled Set'}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">{formatDate(run.startTime)}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-700 dark:text-gray-200">
                      <div className="flex items-center gap-1"><Rocket size={14} className="text-indigo-500" /> {run.summary?.completed || 0}/{run.summary?.total || run.results?.length || 0} completed</div>
                      {run.compareWithBaseModel && <div className="flex items-center gap-1 text-amber-600 dark:text-amber-300"><Sparkles size={14} /> Base model comparison</div>}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : selectedRun ? (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {runStatusBadge(selectedRun.status)}
                      {selectedRun.compareWithBaseModel && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 flex items-center gap-1">
                          <Sparkles size={12} /> Base model comparison
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{selectedRun.testSetName || 'Test Run'}</p>
                    <p className="text-xs text-gray-500">Started {formatDate(selectedRun.startTime)} • Ended {formatDate(selectedRun.endTime)}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] uppercase text-gray-500">Total</div>
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{selectedRun.summary?.total ?? selectedRun.results?.length ?? 0}</div>
                    </div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100 dark:border-emerald-800">
                      <div className="text-[10px] uppercase text-emerald-700 dark:text-emerald-200">Passed</div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-200">{selectedRun.summary?.passed ?? 0}</div>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-100 dark:border-amber-800">
                      <div className="text-[10px] uppercase text-amber-700 dark:text-amber-200">Completed</div>
                      <div className="text-lg font-bold text-amber-700 dark:text-amber-200">{selectedRun.summary?.completed ?? selectedRun.results?.length ?? 0}</div>
                    </div>
                    <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded border border-rose-100 dark:border-rose-800">
                      <div className="text-[10px] uppercase text-rose-700 dark:text-rose-200">Failed</div>
                      <div className="text-lg font-bold text-rose-700 dark:text-rose-200">{selectedRun.summary?.failed ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {(selectedRun.results || []).map((result) => {
                const { expected, missing, passedCount } = activationStats(result);
                const relatedTrace = result.traces?.[0];
                return (
                  <div key={result.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {runStatusBadge(result.status)}
                          <span className="text-xs text-gray-500">{result.testCaseName || result.id}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-1">{result.prompt}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 text-[11px] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                          <BarChart3 size={14} /> {passedCount}/{expected.length} activations
                        </div>
                        {relatedTrace && (
                          <button
                            onClick={() => setViewingTrace(relatedTrace)}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            View Trace
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 p-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">SignalZero Response</p>
                          <div className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 min-h-[120px] whitespace-pre-wrap">
                            {result.signalZeroResponse || 'Pending...'}
                          </div>
                        </div>
                        {selectedRun.compareWithBaseModel && (
                          <div>
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Base Model Response</p>
                            <div className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 min-h-[120px] whitespace-pre-wrap">
                              {result.baselineResponse || 'Awaiting comparison...'}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                          <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Expected Activations</p>
                          <div className="flex flex-wrap gap-1">
                            {expected.map((act) => {
                              const missingActivation = missing.has(act);
                              return (
                                <span
                                  key={act}
                                  className={`px-2 py-1 rounded text-[11px] border flex items-center gap-1 ${missingActivation ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800' : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'}`}
                                >
                                  {missingActivation ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {act}
                                </span>
                              );
                            })}
                            {expected.length === 0 && (
                              <span className="text-xs text-gray-500">No expected activations configured.</span>
                            )}
                          </div>
                        </div>
                        {result.evaluation && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Model Comparison</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">SignalZero</p>
                                <p>Alignment: {result.evaluation.sz.alignment_score}</p>
                                <p>Reasoning: {result.evaluation.sz.reasoning_depth}</p>
                                <p>Symbolic Depth: {result.evaluation.sz.symbolic_depth}</p>
                              </div>
                              <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">Base</p>
                                <p>Alignment: {result.evaluation.base.alignment_score}</p>
                                <p>Reasoning: {result.evaluation.base.reasoning_depth}</p>
                                <p>Symbolic Depth: {result.evaluation.base.symbolic_depth}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">{result.evaluation.overall_reasoning}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {(selectedRun.results || []).length === 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center text-gray-500">
                  No test results available for this run yet.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Beaker size={48} className="mb-3 opacity-40" />
              <p className="text-sm">Start a run to see results.</p>
            </div>
          )}
        </div>
      </div>

      {showSetDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">New Test Set</p>
                <p className="text-xs text-gray-500">Provide a name and description</p>
              </div>
              <button onClick={() => setShowSetDialog(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={18} /></button>
            </div>
            <input
              type="text"
              placeholder="Set name"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
            />
            <textarea
              placeholder="Description"
              value={newSetDescription}
              onChange={(e) => setNewSetDescription(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm min-h-[80px]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSetDialog(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={handleCreateSet} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showRunDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
              <Rocket size={18} className="text-indigo-500" /> Launch Test Run
            </div>
            <p className="text-xs text-gray-500">Compare against base model?</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={compareWithBaseModel}
                onChange={(e) => setCompareWithBaseModel(e.target.checked)}
              />
              <span>Include base model comparison</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRunDialog(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
              <button
                onClick={handleStartRun}
                disabled={isStartingRun}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow flex items-center gap-2 disabled:opacity-50"
              >
                {isStartingRun ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Start Run
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingTrace && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <h3 className="font-bold font-mono text-amber-600 dark:text-amber-500 flex items-center gap-2">
                <Beaker size={18} /> Symbolic Trace Viewer
              </h3>
              <button onClick={() => setViewingTrace(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <TraceVisualizer trace={viewingTrace} onSymbolClick={() => {}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
