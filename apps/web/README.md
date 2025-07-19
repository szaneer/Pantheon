# Pantheon Web App

Web interface for accessing remote LLM models through the Pantheon P2P network.

## Features

- Access models hosted on other devices in your network
- Real-time chat interface
- WebRTC P2P connections for low latency
- Dynamic signaling server configuration
- Optional authentication

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3003`.

## Building for Production

```bash
# Build static files
npm run build

# Preview production build
npm run preview
```

## Docker Deployment

```bash
# Build Docker image
docker build -t pantheon-web .

# Run container
docker run -p 80:80 pantheon-web
```

## Configuration

On first launch, you'll be prompted to enter:
1. **Signaling Server URL** - Address of your Pantheon signaling server
2. **Authentication Key** - Optional key if your server requires authentication

These settings are saved in browser localStorage.

## Environment Variables

Create a `.env` file based on `.env.example`:

- `VITE_SIGNALING_SERVER_URL` - Pre-configure signaling server URL
- `VITE_OLLAMA_URL` - Local Ollama instance URL