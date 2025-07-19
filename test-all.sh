#!/bin/bash

# Test all Pantheon components locally
# This script starts the signaling server, electron app, and web client

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Pantheon Local Test Environment${NC}"
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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Start signaling server
echo -e "${YELLOW}1. Starting Signaling Server...${NC}"
cd server
if [ ! -f .env ]; then
    echo -e "${YELLOW}   Creating .env file from example...${NC}"
    cp env.example .env
fi

# Build and run signaling server in Docker
docker build -t pantheon-signaling-server . > /dev/null 2>&1
docker rm -f pantheon-signaling-test > /dev/null 2>&1
docker run -d --name pantheon-signaling-test \
    -p 3001:3001 \
    -e PORT=3001 \
    -e FIREBASE_DATABASE_URL=https://ptest-5df60.firebaseio.com \
    -e "CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8100" \
    -v "$(pwd)/secrets:/app/secrets:ro" \
    pantheon-signaling-server > /dev/null 2>&1

# Wait for server to start
echo -e "   Waiting for server to start..."
sleep 3

# Check if server is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}   ✅ Signaling server running on http://localhost:3001${NC}"
else
    echo -e "${RED}   ❌ Failed to start signaling server${NC}"
    exit 1
fi

cd ..

# Start Electron app
echo -e "\n${YELLOW}2. Starting Electron App...${NC}"
cd apps/electron

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
fi

# Start electron in dev mode (background)
echo -e "   Starting Electron app..."
npm run dev > electron.log 2>&1 &
ELECTRON_PID=$!

echo -e "${GREEN}   ✅ Electron app starting (check electron.log for details)${NC}"
echo -e "   Note: Electron window will open automatically"

cd ../..

# Start Web client
echo -e "\n${YELLOW}3. Starting Web Client...${NC}"
cd apps/web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
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
echo -e "Services:"
echo -e "  - Signaling Server: http://localhost:3001"
echo -e "  - Electron App: Running (check window)"
echo -e "  - Web Client: http://localhost:5173"
echo ""
echo -e "Logs:"
echo -e "  - Signaling Server: docker logs pantheon-signaling-test"
echo -e "  - Electron App: apps/electron/electron.log"
echo -e "  - Web Client: apps/web/web.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Monitor health
while true; do
    # Check if services are still running
    if ! curl -s http://localhost:3001/health > /dev/null; then
        echo -e "\n${RED}❌ Signaling server stopped unexpectedly${NC}"
        break
    fi
    
    if ! kill -0 $ELECTRON_PID 2>/dev/null; then
        echo -e "\n${RED}❌ Electron app stopped unexpectedly${NC}"
        break
    fi
    
    if ! kill -0 $WEB_PID 2>/dev/null; then
        echo -e "\n${RED}❌ Web client stopped unexpectedly${NC}"
        break
    fi
    
    sleep 10
done

# If we get here, something failed
echo -e "\n${RED}One or more services stopped unexpectedly. Check the logs for details.${NC}"