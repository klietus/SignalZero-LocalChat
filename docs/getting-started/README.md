# Getting Started

This guide will help you get SignalZero LocalChat running on your machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Development Mode](#development-mode)
4. [Connecting to the Kernel](#connecting-to-the-kernel)
5. [First Run](#first-run)
6. [Building for Production](#building-for-production)

## Prerequisites

### Required

- **Node.js** v18 or higher
- **npm** or **yarn**
- **SignalZero LocalNode** (backend) running

### Optional

- **Docker** (for containerized deployment)
- **Git** (for version control)

## Installation

### 1. Install Dependencies

```bash
cd ~/workspace/LocalNode/SignalZero-LocalChat
npm install
```

This installs all React dependencies, TypeScript, Vite, and other build tools.

### 2. Verify LocalNode is Running

The UI connects to the backend kernel. Ensure LocalNode is running:

```bash
# In another terminal, from SignalZero-LocalNode directory
npm run dev
```

Verify it's accessible:
```bash
curl http://localhost:3001/api/auth/status
```

## Development Mode

Start the development server:

```bash
npm run dev
```

This will:
- Start the Vite dev server on port 3000
- Enable hot module replacement (HMR)
- Proxy API requests to LocalNode

Open your browser to **http://localhost:3000**

### Development Features

- **Hot Reload** - Changes to code automatically refresh the browser
- **Source Maps** - Debug TypeScript directly in browser dev tools
- **Type Checking** - TypeScript errors shown in terminal and browser

## Connecting to the Kernel

### Default Connection

By default, LocalChat connects to:
```
http://localhost:3001
```

### Custom Kernel URL

If your LocalNode runs on a different host or port:

1. Open **Settings** in the UI
2. Navigate to **Connection** tab
3. Enter the kernel URL (e.g., `http://192.168.1.100:3001`)
4. Click **Save**

### Environment Variable

For Docker or production builds, set:
```bash
VITE_KERNEL_URL=http://your-kernel:3001
```

## First Run

When you first open LocalChat, you'll see the **System Initialization** wizard:

### 1. License Agreement

Read and accept the **CC BY-NC 4.0** license (non-commercial use only).

### 2. Create Admin Account

- Choose a username
- Set a secure password
- This becomes the system administrator

### 3. Configure AI Model

Select your inference provider:

| Provider | Configuration |
|----------|---------------|
| **Local** | Enter endpoint URL (e.g., `http://localhost:1234/v1`) |
| **OpenAI** | Enter API key |
| **Gemini** | Enter API key |

### 4. Load Sample Project (Optional)

The sample project includes:
- Example domains and symbols
- Pre-configured agents
- Demo test cases

Click **Load Sample** to explore immediately, or **Skip** to start fresh.

## Building for Production

### Build Command

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Serves the built files locally for testing.

### Build Output

```
dist/
├── index.html          # Main HTML file
├── assets/             # JS, CSS, and other assets
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
└── ...
```

## Docker Deployment

See [Deployment Guide](../deployment/README.md) for containerized deployment options.

## Troubleshooting

### "Cannot connect to kernel" Error

**Problem:** UI shows connection error

**Solutions:**
1. Verify LocalNode is running:
   ```bash
   curl http://localhost:3001/api/auth/status
   ```

2. Check kernel URL in Settings

3. Verify no CORS issues (browser dev console)

### npm install fails

**Problem:** Dependency installation errors

**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Build fails

**Problem:** TypeScript compilation errors

**Solutions:**
```bash
# Check types
npx tsc --noEmit

# See detailed errors
npm run build 2>&1 | head -50
```

## Next Steps

- [Architecture Overview](../architecture/README.md) - Understand the UI structure
- [Screens Guide](../screens/README.md) - Learn the available views
- [Development Guide](../development/README.md) - Contributing to the project
