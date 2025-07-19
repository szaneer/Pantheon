#!/bin/bash

# Script to clean sensitive data from the repository
# Run this before committing to ensure no secrets are exposed

set -e

echo "🔐 Cleaning sensitive data from the repository..."

# Files that should never be committed
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "config.js"
    "apps/electron/config.js"
    "apps/web/.env"
    "server/.env"
    "server/secrets/firebase-key.json"
    "*.pem"
    "*.key"
    "*.cert"
)

# Check for sensitive files
echo "🔍 Checking for sensitive files..."
for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "⚠️  Found sensitive file: $file"
        echo "   Adding to .gitignore..."
        echo "$file" >> .gitignore
    fi
done

# Remove duplicates from .gitignore
sort -u .gitignore -o .gitignore

# Check for hardcoded secrets in code
echo "🔍 Scanning for potential secrets in code..."

# Patterns to search for
PATTERNS=(
    "AIzaSy"  # Firebase API key pattern
    "sk-"     # OpenAI API key pattern
    "AC"      # Twilio Account SID pattern
    "firebase.*\.json"
    "apiKey.*:"
    "authToken.*:"
    "password.*:"
    "secret.*:"
)

# Search for patterns
for pattern in "${PATTERNS[@]}"; do
    echo "   Checking for pattern: $pattern"
    # Exclude node_modules, dist, and .git directories
    results=$(grep -r "$pattern" . \
        --exclude-dir=node_modules \
        --exclude-dir=dist \
        --exclude-dir=.git \
        --exclude-dir=out \
        --exclude="*.log" \
        --exclude=".env*" \
        --exclude="clean-secrets.sh" \
        2>/dev/null || true)
    
    if [ ! -z "$result" ]; then
        echo "   ⚠️  Found potential secret matching pattern: $pattern"
        echo "$results" | head -5
    fi
done

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << EOF
# Environment variables
.env
.env.*
!.env.example

# Configuration files with secrets
config.js
!config.example.js

# Firebase service account keys
**/firebase-key.json
**/serviceAccountKey.json

# Certificates and keys
*.pem
*.key
*.cert
*.p12

# IDE and OS files
.DS_Store
.idea/
.vscode/
*.swp
*.swo

# Build outputs
dist/
out/
build/
releases/

# Logs
*.log
logs/

# Dependencies
node_modules/

# Testing
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
*.tmp

# Electron
apps/electron/dist/
apps/electron/out/
apps/electron/releases/

# Server
server/.env
server/secrets/
!server/secrets/.gitkeep
EOF
fi

echo ""
echo "✅ Security scan complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review any warnings above"
echo "2. Move sensitive data to .env files"
echo "3. Update code to read from environment variables"
echo "4. Run 'git status' to check what will be committed"
echo "5. Consider using 'git-secrets' for additional protection"
echo ""
echo "⚠️  Remember: Never commit .env files or API keys!"