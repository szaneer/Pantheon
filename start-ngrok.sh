#!/bin/bash

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok is not installed. Please install it first:"
    echo "  brew install ngrok/ngrok/ngrok"
    echo "  or visit: https://ngrok.com/download"
    exit 1
fi

# Check if auth token is set
if grep -q "YOUR_NGROK_AUTH_TOKEN" ngrok.yml; then
    echo "Please update ngrok.yml with your auth token first!"
    echo "Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

echo "Starting ngrok tunnels for Pantheon..."
echo "- Signaling Server: http://localhost:3001"
echo "- Web App: http://localhost:3002"
echo ""

# Check if we should run in background
if [ "$1" = "--background" ] || [ "$1" = "-b" ]; then
    echo "Starting ngrok in background..."
    ngrok start --all --config ./ngrok.yml --log=stdout > ngrok.log 2>&1 &
    echo "ngrok PID: $!"
    echo "Check ngrok.log for tunnel URLs"
    echo ""
    echo "To view tunnels: ngrok api tunnels list"
    echo "To stop: pkill ngrok"
else
    # Start ngrok with the config file (foreground)
    ngrok start --all --config ./ngrok.yml
fi