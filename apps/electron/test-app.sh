#!/bin/bash

# Test script to run the built Electron app with debugging

echo "🧪 Testing Pantheon..."
echo ""

# Check if app exists
APP_PATH="dist/mac-arm64/Pantheon.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ App not found at $APP_PATH"
    echo "Please run: npm run dist:mac"
    exit 1
fi

echo "📱 Found app at: $APP_PATH"
echo ""

# Run with debugging enabled
echo "🚀 Launching app with debugging..."
echo "Note: On first launch, you may need to right-click and select 'Open'"
echo ""

# Launch with console output visible
"$APP_PATH/Contents/MacOS/Pantheon" --enable-logging --v=1

echo ""
echo "✅ App closed"