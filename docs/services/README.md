# Services Documentation

The service layer provides API communication and business logic for LocalChat.

## Service Overview

| Service | Purpose | Key Functions |
|---------|---------|---------------|
| `api.ts` | API client wrapper | `apiFetch()`, `getHeaders()` |
| `userService.ts` | Authentication | `login()`, `logout()`, `getCurrentUser()` |
| `domainService.ts` | Domain management | `listDomains()`, `createDomain()` |
| `contextService.ts` | Symbol operations | `searchSymbols()`, `createSymbol()` |
| `agentService.ts` | Agent management | `listAgents()`, `runAgent()` |
| `testService.ts` | Test operations | `listTests()`, `runTest()` |
| `projectService.ts` | Import/export | `exportProject()`, `importProject()` |
| `settingsService.ts` | Configuration | `getSettings()`, `updateSettings()` |
| `vectorService.ts` | Vector search | `search()`, `getEmbedding()` |
| `toolsService.ts` | Tool execution | `executeTool()`, `listTools()` |
| `traceService.ts` | Trace viewing | `getTrace()`, `listTraces()` |
| `config.ts` | App configuration | `getApiUrl()`, constants |
| `logger.ts` | Logging | `info()`, `error()`, `debug()` |

## API Client (api.ts)

Centralized HTTP client with authentication and error handling.

### Configuration

```typescript
// Automatic auth header injection
export const getHeaders = () => {
  const token = localStorage.getItem('signalzero_auth_token') || '';
  return {
    'Content-Type': 'application/json',
    'x-auth-token': token
  };
};
```

### Main API Function

```typescript
export const apiFetch = async (path: string, options?: ApiOptions) => {
  const url = `${getApiUrl()}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers }
  });

  // Auto-logout on 401 (except auth endpoints)
  if (response.status === 401 && !path.includes('/auth/status')) {
    localStorage.removeItem('signalzero_auth_token');
    window.location.reload();
  }

  return response;
};
```

### Error Handling

- 401 Unauthorized → Auto logout and reload
- 500+ Server errors → Logged, error message returned
- Network errors → Caught and logged

## User Service

**File:** `services/userService.ts`

Handles authentication and user management.

### Methods

#### `login(username: string, password: string): Promise<LoginResponse>`

Authenticate and store token.

```typescript
const result = await login('admin', 'password');
// Stores token in localStorage automatically
```

#### `logout(): void`

Clear auth token and reload.

```typescript
logout(); // Clears localStorage, reloads page
```

#### `getCurrentUser(): Promise<User>`

Get currently authenticated user.

```typescript
const user = await getCurrentUser();
// { id: 'user_xxx', username: 'admin', role: 'admin' }
```

#### `setup(config: SetupConfig): Promise<void>`

Initial system setup (first run).

```typescript
await setup({
  username: 'admin',
  password: 'secure123',
  inferenceProvider: 'local',
  inferenceEndpoint: 'http://localhost:1234/v1'
});
```

## Domain Service

**File:** `services/domainService.ts`

Manages symbolic domains.

### Methods

#### `listDomains(): Promise<Domain[]>`

List all accessible domains.

```typescript
const domains = await listDomains();
// [{ id: 'root', name: 'Root', isGlobal: true }, ...]
```

#### `getDomain(id: string): Promise<Domain>`

Get domain details.

#### `createDomain(domain: CreateDomainRequest): Promise<Domain>`

Create new domain.

```typescript
await createDomain({
  id: 'my-domain',
  name: 'My Domain',
  description: 'Custom domain'
});
```

#### `deleteDomain(id: string): Promise<void>`

Delete a domain.

## Context Service

**File:** `services/contextService.ts`

Manages symbols and context operations.

### Methods

#### `searchSymbols(query: string, options?: SearchOptions): Promise<Symbol[]>`

Semantic search for symbols.

```typescript
const symbols = await searchSymbols('coercion detection', {
  domain: 'cyber_sec',
  limit: 10
});
```

#### `getSymbol(id: string): Promise<Symbol>`

Get symbol by ID.

#### `createSymbol(domainId: string, symbol: CreateSymbolRequest): Promise<Symbol>`

Create new symbol.

```typescript
await createSymbol('cyber_sec', {
  id: 'new-pattern',
  name: 'New Pattern',
  content: 'Pattern description...'
});
```

#### `updateSymbol(id: string, updates: Partial<Symbol>): Promise<Symbol>`

Update existing symbol.

#### `deleteSymbol(id: string): Promise<void>`

Delete a symbol.

## Agent Service

**File:** `services/agentService.ts`

Manages autonomous agents.

### Methods

#### `listAgents(): Promise<Agent[]>`

List all agents.

#### `getAgent(id: string): Promise<Agent>`

Get agent details.

#### `createAgent(agent: CreateAgentRequest): Promise<Agent>`

Create new agent.

```typescript
await createAgent({
  name: 'Security Monitor',
  domain: 'cyber_sec',
  schedule: '0 */6 * * *', // Every 6 hours
  prompt: 'Monitor for new CVEs...'
});
```

#### `runAgent(id: string): Promise<void>`

Execute agent immediately.

#### `deleteAgent(id: string): Promise<void>`

Remove an agent.

## Test Service

**File:** `services/testService.ts`

Manages regression tests.

### Methods

#### `listTests(): Promise<Test[]>`

List all tests.

#### `runTest(id: string): Promise<TestResult>`

Execute a test.

```typescript
const result = await runTest('test_123');
// { passed: true, output: '...', duration: 1500 }
```

#### `createTest(test: CreateTestRequest): Promise<Test>`

Create new test.

#### `deleteTest(id: string): Promise<void>`

Remove a test.

## Project Service

**File:** `services/projectService.ts`

Handles project import/export.

### Methods

#### `exportProject(options?: ExportOptions): Promise<Blob>`

Export project as `.szproject` file.

```typescript
const blob = await exportProject({
  domainIds: ['root', 'cyber_sec'],
  includeHistory: true
});

// Download
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'my-project.szproject';
a.click();
```

#### `importProject(file: File): Promise<void>`

Import project from file.

```typescript
const file = fileInput.files[0];
await importProject(file);
```

## Settings Service

**File:** `services/settingsService.ts`

Manages application configuration.

### Methods

#### `getSettings(): Promise<Settings>`

Get current settings.

```typescript
const settings = await getSettings();
// { inferenceProvider: 'local', inferenceEndpoint: '...', ... }
```

#### `updateSettings(settings: Partial<Settings>): Promise<void>`

Update settings.

```typescript
await updateSettings({
  inferenceProvider: 'openai',
  openaiApiKey: 'sk-...'
});
```

## Vector Service

**File:** `services/vectorService.ts`

Semantic search and embeddings.

### Methods

#### `search(query: string, options?: SearchOptions): Promise<SearchResult[]>`

Vector-based symbol search.

```typescript
const results = await search('trust patterns', {
  limit: 5,
  threshold: 0.7
});
// [{ symbol: {...}, score: 0.89 }, ...]
```

## Tools Service

**File:** `services/toolsService.ts`

Tool execution and management.

### Methods

#### `listTools(): Promise<Tool[]>`

List available tools.

#### `executeTool(name: string, params: object): Promise<ToolResult>`

Execute a tool.

```typescript
const result = await executeTool('web_search', {
  query: 'symbolic reasoning'
});
```

## Trace Service

**File:** `services/traceService.ts`

Reasoning trace viewing.

### Methods

#### `getTrace(id: string): Promise<Trace>`

Get trace by ID.

```typescript
const trace = await getTrace('trace_123');
// { id: '...', input: '...', output: '...', steps: [...] }
```

#### `listTraces(options?: ListOptions): Promise<Trace[]>`

List traces with pagination.

## Configuration Service

**File:** `services/config.ts`

Application configuration values.

### Exports

```typescript
export const getApiUrl = (): string => {
  // From env or default
  return import.meta.env.VITE_KERNEL_URL || 'http://localhost:3001';
};

export const APP_NAME = 'SignalZero LocalChat';
export const APP_VERSION = '1.0.0';
```

## Logger Service

**File:** `services/logger.ts`

Structured logging utility.

### Methods

#### `info(message: string, data?: object): void`

Log informational message.

```typescript
logger.info('User logged in', { userId: 'user_123' });
```

#### `error(message: string, error?: Error): void`

Log error with stack trace.

```typescript
logger.error('API call failed', error);
```

#### `debug(message: string, data?: object): void`

Debug logging (dev only).

## Usage Patterns

### Data Fetching in Components

```typescript
const MyComponent: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await domainService.listDomains();
        setDomains(data);
      } catch (err) {
        logger.error('Failed to load domains', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return /* JSX */;
};
```

### Error Handling

```typescript
try {
  await userService.login(username, password);
} catch (err) {
  if (err.status === 401) {
    showError('Invalid credentials');
  } else {
    showError('Network error');
  }
}
```

### File Upload

```typescript
const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setUploading(true);
  try {
    await projectService.importProject(file);
    showSuccess('Project imported');
  } catch (err) {
    showError('Import failed');
  } finally {
    setUploading(false);
  }
};
```
