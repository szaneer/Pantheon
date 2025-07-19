# Pantheon Electron App

Desktop application for hosting and accessing LLM models with P2P sharing capabilities.

## Features

- Host local models (Ollama, Apple Foundation Models)
- Share models with other devices via P2P
- Access remote models from other Pantheon hosts
- Native desktop experience for macOS, Windows, Linux
- System tray integration
- Automatic model discovery

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Building

### macOS (Universal Binary)
```bash
npm run dist:mac
```

### Windows
```bash
npm run dist:win
```

### Linux
```bash
npm run dist:linux
```

## Configuration

On first launch, you'll be prompted to:
1. **Configure Signaling Server** - Enter your server URL
2. **Set Authentication** - Optional auth key

The app will guide you through:
- Installing Ollama (if desired)
- Downloading AI models
- Enabling model hosting

## Supported Model Providers

- **Ollama** - Run open-source models locally
- **Apple Foundation Models** - Native macOS AI models (macOS 15.1+)

## Auto-Update

The app checks for updates automatically. New versions can be installed with one click.

## Development

```bash
# Run development server
npm run dev

# Build without packaging
npm run build

# Create distribution packages
npm run dist
```

## Environment Variables

Create `.env` file from `.env.example`:

- `VITE_SIGNALING_SERVER_URL` - Default signaling server
- `VITE_AUTH_KEY` - Default auth key
- `VITE_OLLAMA_URL` - Ollama API URL