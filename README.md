# Pantheon - Unified LLM Hub

A comprehensive platform for managing and accessing Large Language Models (LLMs) across multiple interfaces with P2P model sharing capabilities.

## 🏗️ Architecture

This monorepo contains:
- **Web App** (`apps/web`) - React-based web interface for accessing remote models
- **Electron App** (`apps/electron`) - Desktop application with local model hosting and P2P support  
- **Server** (`server`) - P2P signaling server for device coordination

## 🎯 Features

- **Multi-Model Support**: Run models via Ollama, Apple Foundation Models, and more
- **P2P Model Sharing**: Share models between your devices via WebRTC
- **Cross-Platform**: Web interface and desktop apps for macOS, Windows, Linux
- **Simple Authentication**: Optional auth key for securing your network
- **Dynamic Configuration**: Configure signaling server on first launch

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Ollama (optional, for local models)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/Pantheon.git
cd Pantheon

# Install dependencies
npm install
```

### Running the Components

#### 1. Start the Signaling Server
```bash
cd server
npm install
npm start
```

The server will run on `http://localhost:3001` by default.

#### 2. Run the Electron App (Desktop)
```bash
cd apps/electron
npm install
npm run dev
```

#### 3. Run the Web App
```bash
cd apps/web
npm install
npm run dev
```

The web app will be available at `http://localhost:3003`.

## 🐳 Docker Deployment

### Server
```bash
cd server
docker-compose up -d
```

### Web App
```bash
cd apps/web
docker build -t pantheon-web .
docker run -p 80:80 pantheon-web
```

## 🔧 Configuration

### Server Environment Variables
- `PORT` - Server port (default: 3001)
- `AUTH_KEY` - Optional authentication key
- `TWILIO_ACCOUNT_SID` - Twilio account for TURN servers (optional)
- `TWILIO_AUTH_TOKEN` - Twilio auth token (optional)

### Client Configuration
Both web and electron apps will prompt for:
1. **Signaling Server URL** - Your server's address
2. **Authentication Key** - Optional key if server requires auth

## 📱 Building Desktop Apps

### macOS (Universal Binary)
```bash
cd apps/electron
npm run dist:mac
```

### Windows
```bash
cd apps/electron
npm run dist:win
```

### Linux
```bash
cd apps/electron
npm run dist:linux
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.