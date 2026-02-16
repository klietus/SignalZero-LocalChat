# SignalZero LocalChat Documentation

Welcome to the SignalZero LocalChat documentation. This is the frontend web interface for the SignalZero symbolic reasoning system.

## Quick Links

- [Getting Started](getting-started/README.md) - Installation and first steps
- [Architecture](architecture/README.md) - System design and components
- [Services](services/README.md) - API service layer documentation
- [Screens](screens/README.md) - Application screens and views
- [Components](components/README.md) - React components
- [Development](development/README.md) - Contributing guide
- [Deployment](deployment/README.md) - Production deployment

## What is LocalChat?

LocalChat is a React-based web interface that provides:
- Interactive chat with the SignalZero symbolic kernel
- Symbol and domain visualization
- Project import/export
- System configuration
- User authentication and management

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **React Markdown** - Markdown rendering

## Project Structure

```
SignalZero-LocalChat/
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
├── components/          # React components
│   ├── screens/        # Full-screen views
│   ├── panels/         # Side panel components
│   ├── ChatInput.tsx   # Message input
│   ├── ChatMessage.tsx # Message display
│   └── ...
├── services/           # API and business logic
│   ├── api.ts          # API client
│   ├── userService.ts  # User management
│   └── ...
├── types.ts            # TypeScript types
└── dist/               # Build output
```

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## License

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

Commercial use prohibited without explicit license. Contact: klietus@gmail.com
