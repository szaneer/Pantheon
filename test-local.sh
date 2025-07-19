#!/bin/bash

# Test all Pantheon components locally without Docker
# This script starts the signaling server, electron app, and web client

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Pantheon Local Test Environment (No Docker)${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down all services...${NC}"
    
    # Kill all background processes
    jobs -p | xargs -r kill 2>/dev/null
    
    # Kill processes by port if they're still running
    lsof -ti:3001 | xargs -r kill 2>/dev/null
    lsof -ti:3002 | xargs -r kill 2>/dev/null
    lsof -ti:5173 | xargs -r kill 2>/dev/null
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start signaling server
echo -e "${YELLOW}1. Starting Signaling Server...${NC}"
cd server

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}   Creating .env file...${NC}"
    cat > .env << EOF
PORT=3001
FIREBASE_DATABASE_URL=https://ptest-5df60.firebaseio.com
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8100,file://
EOF
fi

# Start server
echo -e "   Starting server..."
npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}   ✅ Signaling server running on http://localhost:3001${NC}"
else
    echo -e "${RED}   ❌ Failed to start signaling server${NC}"
    echo -e "   Check server/server.log for details"
    exit 1
fi

cd ..

# Start Electron app
echo -e "\n${YELLOW}2. Starting Electron App...${NC}"
cd apps/electron

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install
fi

# Start electron in dev mode (background)
echo -e "   Starting Electron app..."
npm run dev > electron.log 2>&1 &
ELECTRON_PID=$!

echo -e "${GREEN}   ✅ Electron app starting (window will open)${NC}"

cd ../..

# Start Web client
echo -e "\n${YELLOW}3. Starting Web Client...${NC}"
cd apps/web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install
fi

# Start web client (background)
echo -e "   Starting Web client..."
npm run dev > web.log 2>&1 &
WEB_PID=$!

# Wait for web client to start
sleep 5

echo -e "${GREEN}   ✅ Web client starting on http://localhost:5173${NC}"

cd ../..

# Print status
echo -e "\n${GREEN}🎉 All services are running!${NC}"
echo ""
echo -e "${YELLOW}Services:${NC}"
echo -e "  📡 Signaling Server: http://localhost:3001/health"
echo -e "  🖥️  Electron App: Running (check window)"
echo -e "  🌐 Web Client: http://localhost:5173"
echo ""
echo -e "${YELLOW}Test Instructions:${NC}"
echo -e "  1. Login to both Electron and Web apps with the same account"
echo -e "  2. In Electron app: Enable model hosting (top right toggle)"
echo -e "  3. In Web app: Select a remote model from the dropdown"
echo -e "  4. Send messages between the apps!"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  - Signaling Server: tail -f server/server.log"
echo -e "  - Electron App: tail -f apps/electron/electron.log"
echo -e "  - Web Client: tail -f apps/web/web.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep running
wait