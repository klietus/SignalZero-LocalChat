# Components Documentation

Reusable React components used across screens.

## Component Overview

| Component | File | Purpose |
|-----------|------|---------|
| `ChatInput` | `ChatInput.tsx` | Message input with @ mentions |
| `ChatMessage` | `ChatMessage.tsx` | Message bubble display |
| `Header` | `Header.tsx` | App header with navigation |
| `ToolIndicator` | `ToolIndicator.tsx` | Tool execution status |
| `TraceVisualizer` | `TraceVisualizer.tsx` | Reasoning trace display |

## Panels

| Panel | File | Purpose |
|-------|------|---------|
| `ContextListPanel` | `panels/ContextListPanel.tsx` | Sidebar symbol/domain list |
| `DomainPanel` | `panels/DomainPanel.tsx` | Domain details panel |
| `SymbolDetailPanel` | `panels/SymbolDetailPanel.tsx` | Symbol info panel |
| `TracePanel` | `panels/TracePanel.tsx` | Trace inspection panel |
| `HelpPanel` | `panels/HelpPanel.tsx` | Contextual help |

## Chat Input

**File:** `components/ChatInput.tsx`

Message input with symbol mention support.

### Props

```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

### Features

- Text input with auto-resize
- Send button (or Enter key)
- @ mention autocomplete
- Disabled state during processing

### Usage

```typescript
<ChatInput
  onSend={handleSend}
  disabled={isLoading}
  placeholder="Type a message..."
/>
```

### @ Mention Feature

Type `@` to trigger symbol search:

```
User types: "Explain @coer"
Shows dropdown:
  - @coercion-pattern
  - @coercion-detection
User selects → "Explain @coercion-pattern"
```

### Implementation Notes

- Uses contentEditable for rich text
- Parses @ mentions on send
- Converts to symbol references

## Chat Message

**File:** `components/ChatMessage.tsx`

Individual message bubble.

### Props

```typescript
interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onTraceClick?: (traceId: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  traceId?: string;
  toolCalls?: ToolCall[];
}
```

### Features

- User/assistant/system styling
- Markdown rendering
- Code syntax highlighting
- Tool call indicators
- Trace link (if available)
- Streaming animation

### Message Styles

```
┌─────────────────────────────┐
│ User message (right-aligned)│
│ with light background       │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Assistant (left-aligned)    │
│ with dark background        │
│                             │
│ Markdown content here       │
│ ```code blocks```           │
│                             │
│ [View Trace]                │
└─────────────────────────────┘
```

### Markdown Support

Uses `react-markdown` with plugins:

- **GFM** - Tables, strikethrough, task lists
- **Code blocks** - Syntax highlighting
- **Links** - Clickable URLs
- **Images** - Embedded images

### Usage

```typescript
<ChatMessage
  message={{
    id: 'msg_1',
    role: 'assistant',
    content: '# Hello\n\nThis is **bold**',
    timestamp: new Date(),
    traceId: 'trace_123'
  }}
  onTraceClick={openTracePanel}
/>
```

## Header

**File:** `components/Header.tsx`

Application header with navigation.

### Props

```typescript
interface HeaderProps {
  user: User;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}
```

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 SignalZero    [Chat][Forge][Store][Agents]...    [👤 ▼]  │
└─────────────────────────────────────────────────────────────┘
```

### Features

- App logo and name
- Screen navigation buttons
- Active screen highlighting
- User menu (dropdown)
  - Profile
  - Settings
  - Logout

### Navigation Buttons

```typescript
const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'symbol-dev', label: 'Forge', icon: Hammer },
  { id: 'symbol-store', label: 'Store', icon: Database },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tests', label: 'Tests', icon: Beaker },
  { id: 'project', label: 'Project', icon: Folder }
];
```

## Tool Indicator

**File:** `components/ToolIndicator.tsx`

Shows active tool executions.

### Props

```typescript
interface ToolIndicatorProps {
  toolCalls: ToolCall[];
  onCancel?: (toolCallId: string) => void;
}

interface ToolCall {
  id: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  parameters: object;
  result?: object;
}
```

### Visual States

| Status | Icon | Color |
|--------|------|-------|
| pending | ⏳ | Gray |
| running | ⚙️ | Blue |
| completed | ✅ | Green |
| error | ❌ | Red |

### Usage

```typescript
<ToolIndicator
  toolCalls={[
    { id: '1', tool: 'web_search', status: 'running', parameters: { query: '...' } }
  ]}
/>
```

### Display Format

```
⚙️ web_search: "symbolic reasoning"...
✅ web_search completed (1.2s)
```

## Trace Visualizer

**File:** `components/TraceVisualizer.tsx`

Displays reasoning traces.

### Props

```typescript
interface TraceVisualizerProps {
  trace: Trace;
  onStepClick?: (step: TraceStep) => void;
}

interface Trace {
  id: string;
  input: string;
  output: string;
  steps: TraceStep[];
  symbolsAccessed: string[];
  symbolsCreated: string[];
}
```

### Features

- Step-by-step visualization
- Symbol access tracking
- Expandable details
- Timing information

### Step Types

```typescript
type TraceStep = {
  type: 'retrieve' | 'generate' | 'tool' | 'reason';
  description: string;
  details?: object;
  duration?: number;
};
```

### Usage

```typescript
<TraceVisualizer
  trace={{
    id: 'trace_1',
    input: 'Explain symbolic reasoning',
    output: 'Symbolic reasoning is...',
    steps: [
      { type: 'retrieve', description: 'Found 3 relevant symbols' },
      { type: 'generate', description: 'Generated response' }
    ],
    symbolsAccessed: ['sym_1', 'sym_2'],
    symbolsCreated: ['sym_3']
  }}
/>
```

## Context List Panel

**File:** `components/panels/ContextListPanel.tsx`

Sidebar panel showing domains and symbols.

### Props

```typescript
interface ContextListPanelProps {
  domains: Domain[];
  selectedDomain: Domain | null;
  onDomainSelect: (domain: Domain) => void;
  onSymbolSelect: (symbol: Symbol) => void;
}
```

### Features

- Domain list with expand/collapse
- Symbol count per domain
- Symbol list within domains
- Search/filter
- Click to select

### Layout

```
┌─────────────────┐
│ 🔍 Search...    │
├─────────────────┤
│ ▼ root (12)     │
│   - symbol_1    │
│   - symbol_2    │
│ ▶ cyber_sec (5) │
│ ▶ ethics (3)    │
└─────────────────┘
```

## Domain Panel

**File:** `components/panels/DomainPanel.tsx`

Shows domain details and actions.

### Props

```typescript
interface DomainPanelProps {
  domain: Domain;
  onEdit: (domain: Domain) => void;
  onDelete: (domainId: string) => void;
}
```

### Features

- Domain metadata display
- Edit button
- Delete button (with confirmation)
- Symbol count
- Created/updated dates

## Symbol Detail Panel

**File:** `components/panels/SymbolDetailPanel.tsx`

Shows symbol information.

### Props

```typescript
interface SymbolDetailPanelProps {
  symbol: Symbol;
  onEdit: (symbol: Symbol) => void;
  onDelete: (symbolId: string) => void;
}
```

### Features

- Symbol name and ID
- Content preview
- Metadata display
- Domain badge
- Edit/Delete actions
- Similar symbols list

## Trace Panel

**File:** `components/panels/TracePanel.tsx`

Side panel for trace inspection.

### Props

```typescript
interface TracePanelProps {
  traceId: string;
  onClose: () => void;
}
```

### Features

- Loads trace by ID
- Shows reasoning steps
- Symbol references
- Timing breakdown
- Close button

## Help Panel

**File:** `components/panels/HelpPanel.tsx`

Contextual help sidebar.

### Props

```typescript
interface HelpPanelProps {
  context: string; // Current screen/feature
  onClose: () => void;
}
```

### Features

- Context-sensitive help
- Keyboard shortcuts
- Quick tips
- Link to full docs

## Utility Components

### Button

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### Input

```typescript
interface InputProps {
  type?: 'text' | 'password' | 'email';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}
```

### Modal

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

### Loading Spinner

```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}
```

## Component Patterns

### Controlled Components

Always use controlled inputs:

```typescript
const [value, setValue] = useState('');

<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Event Handlers

Use descriptive handler names:

```typescript
// Good
const handleSubmit = () => { };
const handleCancel = () => { };

// Avoid
const onClick = () => { };
```

### Conditional Rendering

```typescript
{isLoading && <LoadingSpinner />}
{error && <ErrorMessage message={error} />}
{data && <DataDisplay data={data} />}
```

### Component Composition

Break complex UIs into smaller pieces:

```typescript
const ChatScreen = () => (
  <div>
    <Header />
    <MessageList />
    <ChatInput />
  </div>
);
```
