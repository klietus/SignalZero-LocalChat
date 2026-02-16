# Screens Documentation

Screens are full-page views in LocalChat. Only one screen is visible at a time.

## Screen Overview

| Screen | Path | Purpose |
|--------|------|---------|
| `LoginScreen` | `/login` | User authentication |
| `SetupScreen` | `/setup` | First-run system initialization |
| `ChatScreen` | `/chat` | Main chat interface |
| `SymbolDevScreen` | `/symbol-dev` | Symbol creation and editing |
| `SymbolStoreScreen` | `/symbol-store` | Browse and search symbols |
| `AgentsScreen` | `/agents` | Manage autonomous agents |
| `TestRunnerScreen` | `/tests` | Run regression tests |
| `ProjectScreen` | `/project` | Import/export projects |
| `SettingsScreen` | `/settings` | System configuration |
| `ContextScreen` | `/context` | Context window inspection |
| `HelpScreen` | `/help` | Documentation and help |
| `ServerConnectScreen` | `/connect` | Kernel connection setup |

## Login Screen

**File:** `components/screens/LoginScreen.tsx`

User authentication screen.

### Props

```typescript
interface LoginScreenProps {
  onLogin: (user: User) => void;
  onNavigate: (screen: string) => void;
}
```

### Features

- Username/password form
- Error message display
- Link to setup (if not initialized)

### Usage

```typescript
<LoginScreen 
  onLogin={setUser}
  onNavigate={setCurrentScreen}
/>
```

## Setup Screen

**File:** `components/screens/SetupScreen.tsx`

First-run system initialization wizard.

### Steps

1. **License Agreement** - Accept CC BY-NC 4.0
2. **Admin Account** - Create admin user
3. **AI Model** - Configure inference provider
4. **Sample Project** - Optional demo data

### Props

```typescript
interface SetupScreenProps {
  onComplete: () => void;
}
```

## Chat Screen

**File:** `components/screens/ChatScreen.tsx`

Main chat interface with the symbolic kernel.

### Layout

```
┌─────────────────────────────────────────┐
│ Header                    [nav buttons] │
├──────────────────┬──────────────────────┤
│                  │                      │
│   Chat History   │   Context/Domain     │
│                  │       Panel          │
│   [messages]     │                      │
│                  │   - Symbols          │
│   [input box]    │   - Domains          │
│                  │                      │
└──────────────────┴──────────────────────┘
```

### Props

```typescript
interface ChatScreenProps {
  user: User;
  selectedDomain: Domain | null;
  onDomainSelect: (domain: Domain) => void;
  onNavigate: (screen: string) => void;
}
```

### Features

- Message history display
- Streaming response support
- Tool execution indicators
- @ mention for symbol references
- Markdown rendering
- Code highlighting

### Child Components

- `ChatMessage` - Individual message bubbles
- `ChatInput` - Message input with send button
- `ToolIndicator` - Shows active tool executions
- `ContextListPanel` - Sidebar with symbols/domains

## Symbol Dev Screen (Forge)

**File:** `components/screens/SymbolDevScreen.tsx`

Create and edit symbols manually.

### Layout

```
┌─────────────────────────────────────────┐
│ Header                                  │
├──────────────────┬──────────────────────┤
│ Symbol List      │ Symbol Editor        │
│                  │                      │
│ - Symbol 1       │ Name: [          ]   │
│ - Symbol 2       │ Domain: [select  ]   │
│ - Symbol 3       │                      │
│                  │ Content:             │
│ [+ New Symbol]   │ ┌────────────────┐   │
│                  │ │                │   │
│                  │ │  [textarea]    │   │
│                  │ │                │   │
│                  │ └────────────────┘   │
│                  │ [Save] [Delete]      │
└──────────────────┴──────────────────────┘
```

### Features

- Symbol creation form
- Domain selection
- Content editor (textarea)
- Metadata editing
- Symbol deletion

### Props

```typescript
interface SymbolDevScreenProps {
  user: User;
  selectedDomain: Domain | null;
  onNavigate: (screen: string) => void;
}
```

## Symbol Store Screen

**File:** `components/screens/SymbolStoreScreen.tsx`

Browse and search the symbol registry.

### Layout

```
┌─────────────────────────────────────────┐
│ Header                    [search box]  │
├──────────────────┬──────────────────────┤
│ Filter Panel     │ Search Results       │
│                  │                      │
│ [x] root         │ ┌─────────────────┐  │
│ [x] cyber_sec    │ │ Symbol Name     │  │
│ [ ] ethics       │ │ Score: 0.89     │  │
│                  │ │ [description]   │  │
│ Sort:            │ └─────────────────┘  │
│ [Relevance ▼]    │                      │
│                  │ ┌─────────────────┐  │
│                  │ │ Another Symbol  │  │
│                  │ └─────────────────┘  │
└──────────────────┴──────────────────────┘
```

### Features

- Semantic search
- Domain filtering
- Relevance scoring
- Symbol preview
- Click to view details

### Props

```typescript
interface SymbolStoreScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Agents Screen

**File:** `components/screens/AgentsScreen.tsx`

Manage autonomous background agents.

### Features

- List all agents
- Create new agent
- Edit agent schedule/prompt
- Run agent manually
- Enable/disable agents
- Delete agents

### Agent Form Fields

- **Name** - Agent identifier
- **Domain** - Target domain for symbols
- **Schedule** - Cron expression (e.g., `0 */6 * * *`)
- **Prompt** - Instructions for agent behavior
- **Enabled** - Active/inactive toggle

### Props

```typescript
interface AgentsScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Test Runner Screen

**File:** `components/screens/TestRunnerScreen.tsx`

Create and run regression tests.

### Features

- List all tests
- Create test from chat
- Run single or all tests
- View test results
- Pass/fail status

### Test Structure

```typescript
interface Test {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;
  expectedSymbols?: string[];
  lastResult?: TestResult;
}
```

### Props

```typescript
interface TestRunnerScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Project Screen

**File:** `components/screens/ProjectScreen.tsx`

Import and export project files.

### Features

- Export current project (.szproject)
- Import project from file
- Select domains to export
- Include/exclude history
- Progress indicators

### Export Options

- **All Domains** - Export everything
- **Selected Domains** - Choose specific domains
- **Include History** - Include chat traces
- **Include Tests** - Include test definitions

### Props

```typescript
interface ProjectScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Settings Screen

**File:** `components/screens/SettingsScreen.tsx`

System configuration interface.

### Tabs

1. **General** - App preferences
2. **Connection** - Kernel URL
3. **AI Model** - Inference provider settings
4. **Security** - Password change
5. **Advanced** - Debug options

### Connection Settings

- **Kernel URL** - LocalNode endpoint
- **WebSocket** - Real-time updates (future)
- **Timeout** - Request timeout

### AI Model Settings

| Provider | Settings |
|----------|----------|
| Local | Endpoint URL, Model name |
| OpenAI | API Key, Model (GPT-4, etc.) |
| Gemini | API Key, Model (Flash/Pro) |

### Props

```typescript
interface SettingsScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Context Screen

**File:** `components/screens/ContextScreen.tsx`

Inspect context window construction.

### Features

- View current context window
- See loaded symbols
- Check token counts
- Debug context issues
- Preview what LLM sees

### Display Sections

- **System Prompt** - Base instructions
- **Stable Context** - Global domains
- **User Context** - Personal domains
- **Dynamic Context** - Retrieved symbols

### Props

```typescript
interface ContextScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}
```

## Help Screen

**File:** `components/screens/HelpScreen.tsx`

Documentation and help resources.

### Sections

- **Quick Start** - Getting started guide
- **Keyboard Shortcuts** - Hotkeys
- **API Reference** - Link to docs
- **About** - Version info, license

### Props

```typescript
interface HelpScreenProps {
  onNavigate: (screen: string) => void;
}
```

## Server Connect Screen

**File:** `components/screens/ServerConnectScreen.tsx`

Configure kernel connection.

### Features

- Kernel URL input
- Connection test
- Save configuration
- Error handling

### Props

```typescript
interface ServerConnectScreenProps {
  onConnect: () => void;
  onNavigate: (screen: string) => void;
}
```

## Screen Navigation

### From Header

The Header component provides navigation buttons:

```typescript
const screens = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'symbol-dev', label: 'Forge', icon: Hammer },
  { id: 'symbol-store', label: 'Store', icon: Database },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tests', label: 'Tests', icon: Beaker },
  { id: 'project', label: 'Project', icon: Folder },
  { id: 'settings', label: 'Settings', icon: Settings }
];
```

### Programmatic Navigation

```typescript
// In a component
const handleSymbolClick = (symbol: Symbol) => {
  setSelectedSymbol(symbol);
  onNavigate('symbol-dev');
};
```

### Screen Registry

Located in `components/utils/screenRegistry.ts`:

```typescript
export const SCREENS = {
  LOGIN: 'login',
  SETUP: 'setup',
  CHAT: 'chat',
  SYMBOL_DEV: 'symbol-dev',
  // ... etc
} as const;
```

## Screen State Management

### App-Level State

```typescript
// App.tsx
const [currentScreen, setCurrentScreen] = useState('chat');
const [user, setUser] = useState<User | null>(null);

const renderScreen = () => {
  const props = { user, onNavigate: setCurrentScreen };
  
  switch (currentScreen) {
    case 'chat': return <ChatScreen {...props} />;
    case 'symbol-dev': return <SymbolDevScreen {...props} />;
    // ... etc
  }
};
```

### Screen-Specific State

Each screen manages its own local state:

```typescript
const ChatScreen: React.FC<ChatScreenProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Screen-specific logic
};
```
