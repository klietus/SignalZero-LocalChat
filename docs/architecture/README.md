# Architecture Overview

This document describes the high-level architecture of SignalZero LocalChat.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SignalZero LocalChat                      │
│                       (React + Vite)                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Screens    │  │   Panels     │  │   Components     │  │
│  │   (Views)    │  │   (Sidebar)  │  │   (Shared)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                   │             │
│         └──────────────────┼───────────────────┘             │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   State/Props   │                        │
│                   │   (React)       │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│    ┌────▼────┐      ┌──────▼──────┐    ┌──────▼──────┐      │
│    │ Service │      │   Local     │    │   Router    │      │
│    │  Layer  │      │   Storage   │    │   (State)   │      │
│    └────┬────┘      └─────────────┘    └─────────────┘      │
│         │                                                     │
│    ┌────▼────────────────────────────────────────────┐       │
│    │              SignalZero LocalNode                │       │
│    │              (REST API / SSE)                   │       │
│    └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Application Flow

### Authentication Flow

```
1. App loads → Check auth status via /api/auth/status
2. If not initialized → Show SetupScreen
3. If not authenticated → Show LoginScreen
4. If authenticated → Show ChatScreen
```

### Chat Flow

```
1. User types message → ChatInput component
2. Message sent → api.sendMessage()
3. API POST /api/chat → LocalNode
4. Stream response → ChatMessage component
5. Tool calls → ToolIndicator component
6. Complete → Message rendered with markdown
```

## Directory Structure

```
components/
├── screens/           # Full-page views
│   ├── LoginScreen.tsx
│   ├── SetupScreen.tsx
│   ├── ChatScreen.tsx
│   ├── SymbolDevScreen.tsx
│   ├── SymbolStoreScreen.tsx
│   ├── AgentsScreen.tsx
│   ├── TestRunnerScreen.tsx
│   ├── ProjectScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── ContextScreen.tsx
│   ├── HelpScreen.tsx
│   └── ServerConnectScreen.tsx
│
├── panels/            # Sidebar panels
│   ├── ContextListPanel.tsx
│   ├── DomainPanel.tsx
│   ├── SymbolDetailPanel.tsx
│   ├── TracePanel.tsx
│   └── HelpPanel.tsx
│
├── utils/             # Component utilities
│   └── screenRegistry.ts
│
├── ChatInput.tsx      # Message input with @ mentions
├── ChatMessage.tsx    # Message bubble display
├── Header.tsx         # App header with nav
└── ToolIndicator.tsx  # Tool execution indicator

services/
├── api.ts             # API client wrapper
├── userService.ts     # Auth and user operations
├── domainService.ts   # Domain CRUD
├── contextService.ts  # Context/symbol operations
├── agentService.ts    # Agent management
├── testService.ts     # Test runner
├── projectService.ts  # Import/export
├── settingsService.ts # Configuration
├── vectorService.ts   # Vector search
├── toolsService.ts    # Tool execution
├── traceService.ts    # Trace viewing
├── gemini.ts          # Gemini AI integration
├── config.ts          # Configuration values
└── logger.ts          # Logging utility
```

## State Management

LocalChat uses **React state and props** (no Redux/Zustand):

### Local State
- Component-specific UI state (useState)
- Form inputs, modal visibility, loading states

### Shared State
- Passed via props from App.tsx
- Current user, active screen, selected domain

### Persistent State
- localStorage for auth token
- Server-side state via LocalNode

### Key State Flows

```typescript
// App.tsx - Top-level state
const [currentScreen, setCurrentScreen] = useState('chat');
const [user, setUser] = useState(null);
const [selectedDomain, setSelectedDomain] = useState(null);

// Passed down to screens
<ChatScreen 
  user={user}
  selectedDomain={selectedDomain}
  onNavigate={setCurrentScreen}
/>
```

## Component Patterns

### Screen Components

Full-page views that replace each other:

```typescript
interface ScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
  // screen-specific props
}

const ChatScreen: React.FC<ScreenProps> = ({ user, onNavigate }) => {
  // Screen logic
};
```

### Panel Components

Sidebar panels that complement screens:

```typescript
interface PanelProps {
  selectedSymbol: Symbol | null;
  onSymbolSelect: (symbol: Symbol) => void;
}

const SymbolDetailPanel: React.FC<PanelProps> = ({ 
  selectedSymbol, 
  onSymbolSelect 
}) => {
  // Panel logic
};
```

### Shared Components

Reusable UI elements:

```typescript
// ChatInput.tsx
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

// ChatMessage.tsx
interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}
```

## Service Layer

### API Client (api.ts)

Centralized fetch wrapper:

```typescript
// Handles auth headers, error handling, logging
export const apiFetch = async (path: string, options?: ApiOptions) => {
  const headers = getHeaders(); // Adds auth token
  const response = await fetch(url, { ...options, headers });
  // Error handling, logging
  return response;
};
```

### Service Modules

Domain-specific API operations:

```typescript
// userService.ts
export const login = (username: string, password: string) =>
  apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const getCurrentUser = () =>
  apiFetch('/users/me');
```

## Routing

Simple screen-based routing (no React Router):

```typescript
// App.tsx
const renderScreen = () => {
  switch (currentScreen) {
    case 'login': return <LoginScreen {...props} />;
    case 'chat': return <ChatScreen {...props} />;
    case 'symbol-dev': return <SymbolDevScreen {...props} />;
    // ... other screens
  }
};
```

Navigation via header buttons and in-app links.

## Data Flow

### Server → UI

```
LocalNode → API Response → Service → Component State → Render
```

### UI → Server

```
User Action → Component Handler → Service → API Request → LocalNode
```

### Real-time Updates

- **Chat Streaming:** Server-Sent Events (SSE) for streaming responses
- **Tool Status:** Polling or SSE for tool execution updates
- **No WebSockets:** REST + SSE for simplicity

## Authentication

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  LoginForm  │────▶│  userService│────▶│  POST /login│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐
│  Store Token│◀────│   api.ts    │◀────│   Token     │
│  localStorage     │  (setHeader)│     │  Response   │
└─────────────┘     └─────────────┘     └─────────────┘
```

Token stored in `localStorage`, attached to all requests via `x-auth-token` header.

## Build Process

### Development (Vite)

```
Source TSX → Vite Dev Server → Hot Module Replacement
                    │
                    ▼
              Proxy /api/* → LocalNode
```

### Production

```
Source TSX → TypeScript Compiler → JS + Types
      │
      ▼
   Vite Build → Bundle + Minify
      │
      ▼
   dist/ → index.html + assets/
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

Requires ES2020+ support.

## Performance Considerations

- Code splitting by screen (lazy loading)
- Virtual scrolling for large symbol lists
- Debounced search inputs
- Memoized expensive computations

## Security

- All API requests include auth token
- Token stored in localStorage (XSS risk, acceptable for local use)
- No sensitive data in URLs
- CSP headers in production
