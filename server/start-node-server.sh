#!/bin/bash

echo "Starting Pantheon Node.js Signaling Server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
else
    echo "Warning: No .env file found. Using default values or environment variables."
fi

# Start the server
echo "Starting server on port ${PORT:-3001}..."
npm start