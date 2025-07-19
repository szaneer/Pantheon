# Quick Start Guide

Get Pantheon running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Step 1: Setup

```bash
# Run the setup script
npm run setup
```

This will guide you through:
- Firebase configuration
- Ollama detection (optional)

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Start Development

```bash
# Start React development server
npm run dev

# In another terminal, start Electron
npm run electron-dev
```

## Step 4: First Run

1. **Create an account** or sign in
2. **Register your device** in Settings
3. **Start chatting** with available models

## Firebase Setup (if not done via setup script)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication (Email/Password)
4. Create a Firestore database
5. Update `src/config/firebase.ts` with your config

## Ollama Setup (Optional)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2

# Start Ollama
ollama serve
```

## Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
npm install
```

**Firebase connection issues**
- Verify your Firebase config
- Check if Authentication is enabled
- Ensure Firestore rules allow read/write

**Ollama not connecting**
```bash
# Check if Ollama is running
ollama list

# Start Ollama if needed
ollama serve
```

**App won't start**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check out the [API Reference](README.md#api-reference)
- Explore the [Project Structure](README.md#project-structure)

Happy coding! 🚀 