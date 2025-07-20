# Pantheon

A decentralized AI chat platform that enables seamless P2P model sharing across devices. Connect your desktop and mobile devices to share local AI models without relying on cloud services.

|Desktop|Web|
|-|-|
|<img width="1312" height="912" alt="Screenshot 2025-07-20 at 12 13 21 PM" src="https://github.com/user-attachments/assets/018c66af-9349-46a2-befa-31d73ca2abf6" />|<img width="572" height="845" alt="Screenshot 2025-07-20 at 12 13 33 PM" src="https://github.com/user-attachments/assets/b65b713a-d83f-4650-b236-766e4e19efbf" />|

## 🌟 Features

- **Peer-to-Peer Model Sharing**: Share AI models directly between devices
- **Cross-Platform**: Electron desktop app and web client
- **Local AI Models**: Support for Ollama, Apple Foundation Models, and more
- **Real-time Chat**: WebRTC-based communication for low-latency conversations
- **Decentralized**: No cloud dependency - your data stays on your devices
- **Easy Setup**: Simple onboarding with automatic device discovery

## 🏗️ Architecture

This repository contains the main Pantheon project with the following components as submodules:

- **[Electron App](https://github.com/szaneer/Pantheon-Electron)** - Desktop application (`apps/electron/`)
- **[Web Client](https://github.com/szaneer/Pantheon-Web)** - Browser-based client (`apps/web/`)
- **[Signaling Server](https://github.com/szaneer/Pantheon-Server)** - P2P coordination server (`server/`)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker (for server deployment)
- Ollama (for local AI models)

### Clone with Submodules

```bash
git clone --recursive https://github.com/szaneer/Pantheon.git
cd Pantheon

# If you already cloned without --recursive:
git submodule update --init --recursive
```

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the signaling server:**
   ```bash
   cd server
   npm install
   npm start
   ```

3. **Launch the desktop app:**
   ```bash
   cd apps/electron
   npm install
   npm run dev
   ```

4. **Or run the web client:**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

### Docker Deployment

For production deployment:

```bash
# Start server and web client
docker-compose up -d

# Server will be available on port 3001
# Web client will be available on port 8080
```

## 🔧 Configuration

### Signaling Server

Configure the server URL during onboarding or in settings:

- **Default**: `http://localhost:3001`
- **Authentication**: Optional auth key for server access

### Supported AI Models

- **Ollama Models**: Any model supported by Ollama
- **Apple Foundation Models**: On macOS devices with Apple Silicon
- **Remote Models**: Access models hosted on other devices

## 📱 Usage

1. **Setup**: Run the onboarding wizard on first launch
2. **Connect**: Devices automatically discover each other on the same network
3. **Share**: Enable model hosting to share your local models
4. **Chat**: Select any available model (local or remote) and start chatting

## 🛠️ Development

### Project Structure

```
Pantheon/
├── apps/
│   ├── electron/          # Desktop application (submodule)
│   └── web/              # Web client (submodule)
├── server/               # Signaling server (submodule)
├── docs/                 # Documentation
└── scripts/              # Build and deployment scripts
```

### Building

```bash
# Build all components
npm run build

# Build specific component
npm run build:electron
npm run build:web
npm run build:server
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🔒 Security & Privacy

- **Local Processing**: AI inference happens on your devices
- **Encrypted Communication**: WebRTC provides encrypted P2P connections
- **No Data Collection**: No telemetry or usage tracking
- **Open Source**: Full transparency with open source code

## ⚖️ Legal Disclaimer

**IMPORTANT: READ BEFORE USING**

This software is provided **"AS IS"** without warranty of any kind. By using this software, you acknowledge and agree that:

- You use this software entirely at your own risk
- The authors and contributors are not liable for any damages, data loss, or security issues
- This is experimental software not intended for production use
- You are responsible for your own data security and privacy
- AI model interactions may produce unexpected or inappropriate content
- P2P connections may expose your device to network security risks

**No warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement are provided.**

## 👥 Attribution

**Author**: Siraj Zaneer  
**Copyright**: © 2025 Siraj Zaneer  
**Project**: Pantheon - Decentralized AI Platform

### Third-Party Dependencies

This project uses various open-source libraries and frameworks. See individual `package.json` files for complete dependency lists and their respective licenses.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

**By using this software, you agree to the terms of the MIT License and the disclaimers above.**

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/szaneer/Pantheon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/szaneer/Pantheon/discussions)

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://reactjs.org/) - UI framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [WebRTC](https://webrtc.org/) - Peer-to-peer connections
- [Ollama](https://ollama.ai/) - Local AI model runtime

---

**Pantheon** - Decentralized AI for everyone 🚀
