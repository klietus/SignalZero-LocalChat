# SignalZero Local Chat (Frontend)

SignalZero Local Chat is the visual interface for the **SignalZero Kernel**. It provides a rich, interactive environment for engaging with the recursive symbolic system, managing projects, visualizing reasoning traces, and configuring the kernel.

## Features

*   **Interactive Chat Interface:** Engage with the kernel, view streaming responses, and interact with tool outputs.
*   **Symbolic Visualization:** Explore domain symbols, their relationships, and metadata through dedicated panels.
*   **Trace Inspector:** Visualize the reasoning steps and tool executions (traces) behind each response.
*   **Project Management:**
    *   **Export/Import:** Save and load your entire project state (domains, symbols, tests, agents) as `.szproject` files.
    *   **Sample Project:** Includes a built-in sample project to get started quickly.
*   **System Configuration:**
    *   **Setup Wizard:** Guided first-run experience to set up admin credentials and AI models.
    *   **Model Switching:** Easily switch between Local (Llama 3), OpenAI, and Gemini inference providers.
    *   **Connection Settings:** Configure Redis and ChromaDB connections directly from the UI.
*   **Security:** Secure login screen with token-based authentication.

## Prerequisites

*   **Node.js** (v18 or higher)
*   **SignalZero Kernel** (LocalNode) running on `http://localhost:3001` (default)

## Setup & Installation

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configuration**
    The application defaults to connecting to the kernel at `http://localhost:3001`. You can configure this via the UI if your setup differs.

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`.

4.  **Build for Production**
    ```bash
    npm run build
    ```
    The build artifacts will be in the `dist` directory.

## First Run

When you launch the application for the first time (or after clearing the database), you will be presented with the **System Initialization** wizard:

1.  **License Agreement:** You must accept the **CC BY-NC 4.0** license (Non-Commercial Use).
2.  **Admin Account:** Create a secure username and password for the system.
3.  **AI Model:** Configure your primary inference provider (Local, OpenAI, or Gemini).
4.  **Sample Project:** Optionally load the included sample project to explore SignalZero's capabilities immediately.

## Usage Guide

*   **Chat:** Use the main chat window to query the system. Use `@` to reference symbols or domains contextually.
*   **Forge (Symbol Dev):** Create and edit symbols manually. Define patterns, invariants, and activation conditions.
*   **Store (Registry):** Browse and search the entire symbol registry across all domains.
*   **Agents:** Manage background autonomous agents that run on defined schedules.
*   **Tests:** Create and run regression tests to ensure your symbolic system behaves as expected.

## License

**Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**

Commercial use of this software is strictly prohibited under this license. To obtain a license for commercial use, please contact: `klietus@gmail.com`.