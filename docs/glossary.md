# Glossary

Key terms and concepts in SignalZero LocalChat.

## Core Concepts

### Symbol
A discrete unit of meaning in the symbolic system. Has a name, content, and domain.

### Domain
A collection of related symbols. Can be global (shared) or user-specific.

### Context Window
The assembled set of symbols and prompts sent to the LLM for generation.

### Trace
A record of reasoning steps taken during a chat interaction.

### Forge
The symbol development interface for creating and editing symbols.

### Store
The symbol registry for browsing and searching all symbols.

## UI Concepts

### Screen
A full-page view in the application (Chat, Forge, Store, etc.).

### Panel
A sidebar component that complements the main screen.

### Component
A reusable React UI element (buttons, inputs, etc.).

### @ Mention
Typing `@` in chat to reference a symbol by name.

### Stream/Streaming
Real-time display of LLM responses as they're generated.

## Technical Terms

### React
JavaScript library for building user interfaces.

### TypeScript
Typed superset of JavaScript used for development.

### Vite
Build tool and development server used by LocalChat.

### JSX
JavaScript XML syntax for React components.

### Hook
React function for state and lifecycle (useState, useEffect, etc.).

### Props
Properties passed to React components.

### State
Component-managed data that triggers re-renders when changed.

### LocalStorage
Browser storage for persisting auth tokens.

## Services

### API Client
The `api.ts` service that handles HTTP requests to LocalNode.

### UserService
Manages authentication and user operations.

### DomainService
Handles domain CRUD operations.

### ContextService
Manages symbol operations and search.

## Authentication

### Session Token
Short-lived token (24h) stored in localStorage for web sessions.

### API Key
Persistent key for programmatic access.

### Auth Header
HTTP header (`x-auth-token`) containing the session token.

## Deployment

### Static Build
Compiled HTML/JS/CSS files for deployment.

### Nginx
Web server and reverse proxy commonly used for deployment.

### Docker
Containerization platform for packaging applications.

### Reverse Proxy
Server that forwards client requests to backend services.

### SPA
Single Page Application - loads once, updates dynamically.

## Network

### CORS
Cross-Origin Resource Sharing - browser security feature.

### SSE
Server-Sent Events - protocol for server-to-client streaming.

### Proxy
Intermediate server that forwards requests.

### Endpoint
URL path that accepts API requests.

## Build

### Bundle
Combined JavaScript file output from build process.

### Minification
Removing unnecessary characters from code to reduce size.

### Source Map
File mapping minified code back to original source for debugging.

### Hot Reload
Automatic browser refresh on code changes during development.

## AI/ML Terms

### LLM
Large Language Model - the AI model used for chat (GPT-4, Llama, etc.).

### Inference
The process of generating a response from the AI model.

### Embedding
Vector representation of text for semantic search.

### Semantic Search
Finding symbols by meaning rather than exact match.

### Token
Unit of text processed by LLMs (roughly 4 characters or 0.75 words).

## File Extensions

### .tsx
TypeScript React component files.

### .ts
TypeScript files (services, utilities).

### .szproject
SignalZero project export file format.
