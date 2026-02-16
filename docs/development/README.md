# Development Guide

Guide for contributing to SignalZero LocalChat.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Coding Standards](#coding-standards)
4. [Component Guidelines](#component-guidelines)
5. [Testing](#testing)
6. [Adding Features](#adding-features)
7. [Debugging](#debugging)

## Development Setup

### 1. Prerequisites

- Node.js v18+
- npm or yarn
- Git

### 2. Clone and Install

```bash
cd ~/workspace/LocalNode/SignalZero-LocalChat
npm install
```

### 3. Start Development

```bash
# Terminal 1: Start LocalNode (backend)
cd ../SignalZero-LocalNode
npm run dev

# Terminal 2: Start LocalChat (frontend)
npm run dev
```

Open http://localhost:3000

### 4. IDE Setup (VS Code)

Recommended extensions:
- ESLint
- Prettier
- TypeScript Importer
- Tailwind CSS IntelliSense

## Project Structure

```
SignalZero-LocalChat/
├── App.tsx                 # Main app component
├── index.tsx               # Entry point
├── types.ts                # Global types
├── components/
│   ├── screens/            # Full-page views
│   ├── panels/             # Sidebar panels
│   ├── utils/              # Component utilities
│   ├── ChatInput.tsx       # Chat components
│   ├── ChatMessage.tsx
│   ├── Header.tsx
│   ├── ToolIndicator.tsx
│   └── TraceVisualizer.tsx
├── services/               # API services
│   ├── api.ts              # API client
│   ├── userService.ts
│   ├── domainService.ts
│   └── ...
├── docs/                   # Documentation
├── tests/                  # Test files
├── public/                 # Static assets
└── dist/                   # Build output
```

## Coding Standards

### TypeScript

- Enable strict mode
- No `any` types
- Define interfaces for props
- Use union types for variants

```typescript
// Good
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}

// Avoid
interface ButtonProps {
  variant: string;
  onClick: Function;
  children: any;
}
```

### React Components

Functional components with hooks:

```typescript
import React, { useState, useEffect } from 'react';

interface Props {
  title: string;
}

export const MyComponent: React.FC<Props> = ({ title }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Side effect
  }, []);

  return <div>{title}</div>;
};
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | PascalCase | `ChatInput.tsx` |
| Components | PascalCase | `ChatInput` |
| Hooks | camelCase with `use` | `useAuth` |
| Services | camelCase | `userService` |
| Types/Interfaces | PascalCase | `ChatMessageProps` |
| Constants | SCREAMING_SNAKE | `API_URL` |

### File Organization

One component per file:

```typescript
// ChatInput.tsx
export const ChatInput: React.FC<Props> = () => { };
export default ChatInput;

// Don't do this
export const ChatInput = () => { };
export const ChatButton = () => { }; // Separate file
```

## Component Guidelines

### Props Interface

Always define props interface:

```typescript
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}
```

### Default Props

Use default parameters:

```typescript
const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary',
  size = 'md',
  disabled = false,
  children 
}) => {
  // Component
};
```

### Event Handlers

Prefix with `handle`:

```typescript
const handleClick = () => { };
const handleSubmit = (e: FormEvent) => { };
const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => { };
```

### Conditional Rendering

Use early returns for loading/error states:

```typescript
const MyComponent: React.FC<Props> = ({ data, isLoading, error }) => {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <EmptyState />;

  return <DataDisplay data={data} />;
};
```

### useEffect Dependencies

Always include all dependencies:

```typescript
useEffect(() => {
  loadData(userId);
}, [userId]); // ✅ Include userId

useEffect(() => {
  loadData();
}, []); // ⚠️ Only if truly only-on-mount
```

## State Management

### Local State

Use `useState` for component-specific state:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [value, setValue] = useState('');
```

### Lifting State

Lift state to common ancestor when needed:

```typescript
// Parent
const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

<DomainList 
  selected={selectedDomain} 
  onSelect={setSelectedDomain} 
/>
<DomainDetails domain={selectedDomain} />
```

### Avoid Prop Drilling

For deeply nested state, consider context (if needed in future):

```typescript
// Currently: Pass props down
// Future: React Context or Zustand if complexity grows
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/myComponent.test.ts
```

### Test Structure

```typescript
import { describe, it, expect } from 'node:test';
import { render, screen } from '@testing-library/react';
import { ChatInput } from '../components/ChatInput';

describe('ChatInput', () => {
  it('renders input field', () => {
    render(<ChatInput onSend={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSend when submitted', () => {
    const onSend = mock.fn();
    render(<ChatInput onSend={onSend} value="Hello" />);
    
    fireEvent.click(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
```

### What to Test

- Component rendering
- User interactions
- Prop changes
- Error states
- Edge cases

## Adding Features

### Adding a New Screen

1. Create file in `components/screens/`:

```typescript
// components/screens/MyScreen.tsx
import React from 'react';

interface MyScreenProps {
  user: User;
  onNavigate: (screen: string) => void;
}

export const MyScreen: React.FC<MyScreenProps> = ({ user, onNavigate }) => {
  return (
    <div className="my-screen">
      <h1>My Screen</h1>
    </div>
  );
};
```

2. Add to App.tsx:

```typescript
case 'my-screen':
  return <MyScreen user={user} onNavigate={setCurrentScreen} />;
```

3. Add navigation button in Header.tsx

4. Add to screen registry

### Adding a New Service

1. Create file in `services/`:

```typescript
// services/myService.ts
import { apiFetch } from './api';

export const myOperation = async (data: MyData): Promise<Result> => {
  const response = await apiFetch('/api/my-endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response.json();
};
```

2. Export from index if needed

3. Add tests in `tests/myService.test.ts`

### Adding a New Component

1. Create component file
2. Define props interface
3. Export component
4. Add tests
5. Document in components README

## Debugging

### React DevTools

Install browser extension for:
- Component tree inspection
- Props/state viewing
- Performance profiling

### Console Logging

Use logger service:

```typescript
import { logger } from './services/logger';

logger.info('Component mounted', { userId });
logger.error('API failed', error);
logger.debug('Debug data', { state });
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug LocalChat",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

### Common Issues

**Issue:** Changes not reflecting
**Fix:** Check HMR is working, hard reload (Ctrl+F5)

**Issue:** Type errors not showing
**Fix:** Run `npx tsc --noEmit`

**Issue:** API calls failing
**Fix:** Verify LocalNode is running on correct port

## Build Process

### Development

```bash
npm run dev
```
- Vite dev server
- Hot module replacement
- Source maps enabled
- Type checking in separate process

### Production

```bash
npm run build
```
- TypeScript compilation
- Vite bundling
- Code minification
- Asset optimization

Output in `dist/` directory.

## Performance Guidelines

### Memoization

Use `useMemo` for expensive calculations:

```typescript
const filteredData = useMemo(() => {
  return data.filter(item => item.matches(search));
}, [data, search]);
```

Use `useCallback` for stable function references:

```typescript
const handleSubmit = useCallback(() => {
  submitForm(data);
}, [data]);
```

### Lazy Loading

Lazy load screens for code splitting:

```typescript
const ChatScreen = lazy(() => import('./components/screens/ChatScreen'));

// In render
<Suspense fallback={<Loading />}>
  <ChatScreen />
</Suspense>
```

### Avoid Unnecessary Renders

- Use correct React keys
- Split large components
- Lift static content out

## Submitting Changes

### Before Committing

1. Run tests: `npm test`
2. Check types: `npx tsc --noEmit`
3. Test manually in browser
4. Update documentation

### Commit Message Format

```
type(scope): description

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(chat): add @ mention autocomplete
fix(api): handle 401 errors correctly
docs(readme): update installation steps
```

### Pull Request Checklist

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Types check passes
- [ ] Manual testing done
- [ ] Documentation updated
