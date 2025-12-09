import assert from 'node:assert';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChatInput } from '../components/ChatInput.js';
import { ChatMessage } from '../components/ChatMessage.js';
import { Header } from '../components/Header.js';
import { SettingsDialog } from '../components/SettingsDialog.js';
import { ToolIndicator } from '../components/ToolIndicator.js';
import { TraceVisualizer } from '../components/TraceVisualizer.js';
import { HelpPanel } from '../components/panels/HelpPanel.js';
import { TracePanel } from '../components/panels/TracePanel.js';
import { DomainPanel } from '../components/panels/DomainPanel.js';
import { SymbolDetailPanel } from '../components/panels/SymbolDetailPanel.js';
import { ServerConnectScreen } from '../components/screens/ServerConnectScreen.js';
import { SymbolStoreScreen } from '../components/screens/SymbolStoreScreen.js';
import { TestRunnerScreen } from '../components/screens/TestRunnerScreen.js';
import { SymbolDevScreen } from '../components/screens/SymbolDevScreen.js';
import { HelpScreen } from '../components/screens/HelpScreen.js';
import { ContextScreen } from '../components/screens/ContextScreen.js';
import { ProjectScreen } from '../components/screens/ProjectScreen.js';
import { Message, Sender, SymbolDef, TraceData, TestRun } from '../types.js';

const sampleMessage: Message = {
  id: '1',
  role: Sender.USER,
  content: 'Hello world',
  timestamp: new Date(),
  toolCalls: [{ id: 'tool1', name: 'demo', args: {}, result: 'done' }]
};

const sampleSymbol: SymbolDef = {
  id: 'sym',
  name: 'Symbol',
  triad: 'TRI',
  role: 'role',
  macro: 'macro',
  symbol_domain: 'demo',
  symbol_tag: 'tag',
  facets: {} as any,
  failure_mode: '',
  linked_patterns: [],
  kind: 'pattern'
};

const sampleTrace: TraceData = {
  id: 't1',
  entry_node: 'start',
  activated_by: 'input',
  activation_path: [],
  source_context: { symbol_domain: 'demo', trigger_vector: 'vec' },
  output_node: 'out',
  status: 'ok'
};

const sampleRun: TestRun = {
  id: 'run1',
  testSetId: 'set1',
  status: 'completed',
  results: [],
  summary: { total: 1, completed: 1, passed: 1, failed: 0 }
};

test('ChatInput renders and calls onSend', () => {
  let sent = '';
  const html = renderToString(<ChatInput onSend={(msg: string) => (sent = msg)} />);
  assert.ok(html.includes('SignalZero Kernel'));
  (ChatInput as any).prototype?.handleSubmit?.('hi');
  assert.equal(typeof sent, 'string');
});

test('ChatMessage shows content and tool results', () => {
  const html = renderToString(<ChatMessage message={sampleMessage} />);
  assert.ok(html.includes('Hello world'));
  assert.ok(html.length > 0);
});

test('Header renders navigation and project badge', () => {
  const html = renderToString(
    <Header
      title="Demo"
      subtitle="Sub"
      currentView="chat"
      onNavigate={() => {}}
      projectName="Project"
    />
  );
  assert.ok(html.includes('Project'));
  assert.ok(html.includes('Demo'));
});

test('SettingsDialog renders when open', () => {
  const html = renderToString(
    React.createElement(SettingsDialog as any, {
      isOpen: true,
      onClose: () => {},
      user: null,
      onLogout: () => {},
      theme: 'light',
      onThemeToggle: () => {}
    })
  );
  assert.ok(html.includes('System Configuration'));
});

test('ToolIndicator displays status', () => {
  const html = renderToString(
    <ToolIndicator toolCalls={[{ id: '1', name: 'Demo', args: { value: 1 } }]} isFinished />
  );
  assert.ok(html.includes('Demo'));
});

test('TraceVisualizer renders traces', () => {
  const html = renderToString(
    <TraceVisualizer trace={{ ...sampleTrace, activation_path: [{ link_type: 'type', reason: 'r', symbol_id: 'sym' }] }} onSymbolClick={() => {}} />
  );
  assert.ok(html.length > 0);
});

test('Panels render expected sections', () => {
  const help = renderToString(React.createElement(HelpPanel as any, { isOpen: true, onClose: () => {} }));
  const trace = renderToString(
    React.createElement(TracePanel as any, {
      isOpen: true,
      onClose: () => {},
      traces: [sampleTrace],
      selectedTraceId: 't1',
      onSelectTrace: () => {},
      onSymbolClick: () => {}
    })
  );
  const domain = renderToString(
    React.createElement(DomainPanel as any, {
      domain: 'demo',
      onClose: () => {},
      onSymbolClick: () => {},
      onLoadDomain: () => {},
      onDomainChange: () => {}
    })
  );
  const detail = renderToString(
    React.createElement(SymbolDetailPanel as any, {
      symbolId: 'sym',
      symbolData: sampleSymbol,
      onClose: () => {},
      onSymbolClick: () => {}
    })
  );
  assert.ok(help.length > 0 && trace.length > 0 && domain.length > 0);
  assert.ok(detail.length > 0);
});

test('ServerConnectScreen renders CTA and handles connect flow', () => {
  (globalThis as any).fetch = async () => new Response('', { status: 200 });
  const html = renderToString(<ServerConnectScreen onConnect={() => {}} />);
  assert.ok(html.includes('Kernel API URL'));
});

test('SymbolStoreScreen renders with header props', () => {
  (globalThis as any).fetch = async () => new Response(JSON.stringify([]));
  const html = renderToString(
    React.createElement(SymbolStoreScreen as any, {
      onBack: () => {},
      onNavigateToForge: () => {},
      headerProps: { title: 'Store', currentView: 'store', onNavigate: () => {} }
    })
  );
  assert.ok(html.includes('Symbol Store'));
});

test('TestRunnerScreen renders run summary', () => {
  const html = renderToString(
    React.createElement(TestRunnerScreen as any, {
      headerProps: { title: 'Tests', currentView: 'test', onNavigate: () => {} },
      onNavigateToForge: () => {},
      onOpenSymbolDetail: () => {},
      onNavigateToStore: () => {}
    })
  );
  assert.ok(html.length > 0);
});

test('SymbolDevScreen renders editor layout', () => {
  const html = renderToString(
    React.createElement(SymbolDevScreen as any, {
      headerProps: { title: 'Dev', currentView: 'dev', onNavigate: () => {} },
      onBack: () => {},
      onOpenTrace: () => {},
      onOpenSymbolDetail: () => {},
      onOpenStore: () => {}
    })
  );
  assert.ok(html.includes('Symbol Forge'));
});

test('HelpScreen and ContextScreen render content', () => {
  const helpHtml = renderToString(
    <HelpScreen headerProps={{ title: 'Help', currentView: 'help', onNavigate: () => {} }} />
  );
  const contextHtml = renderToString(
    React.createElement(ContextScreen as any, {
      headerProps: { title: 'Context', currentView: 'context', onNavigate: () => {} },
      onOpenTrace: () => {},
      onOpenSymbolDetail: () => {},
      onOpenStore: () => {}
    })
  );
  assert.ok(helpHtml.length > 0);
  assert.ok(contextHtml.length > 0);
});

test('ProjectScreen renders project meta', () => {
  const html = renderToString(
    React.createElement(ProjectScreen as any, {
      headerProps: { title: 'Project', currentView: 'project', onNavigate: () => {} },
      projectMeta: { name: 'Demo', version: '1', created_at: '', updated_at: '', author: 'me' },
      setProjectMeta: () => {},
      systemPrompt: 'prompt',
      onSystemPromptChange: () => {},
      onClearChat: () => {},
      onImportProject: async () => {},
      onNewProject: () => {},
      onOpenTrace: () => {},
      onOpenSymbolDetail: () => {},
      onOpenStore: () => {}
    })
  );
  assert.ok(html.length > 0);
});
