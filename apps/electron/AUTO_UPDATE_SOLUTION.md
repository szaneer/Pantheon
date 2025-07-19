# Auto-Update Issues and Solutions

## The Problem
You're experiencing 403 (Forbidden) errors when the auto-updater tries to download release assets. This happens because:

1. **Fine-grained tokens have limitations** - They don't work well with GitHub's asset download URLs
2. **Asset URLs are temporary** - GitHub generates temporary URLs that expire
3. **Authentication headers aren't always passed** - electron-updater doesn't always include the token

## Solutions

### Option 1: Use a Classic Personal Access Token (Recommended)
1. Go to https://github.com/settings/tokens/new
2. Select scope: `repo` (full control of private repositories)
3. Replace your fine-grained token with the classic token

### Option 2: Make the Repository Public
1. Keep your source code in a private repo
2. Create a public repo just for releases
3. Update electron-builder.yml to point to the public repo

### Option 3: Use a Custom Update Server
Set up your own update server that proxies requests with proper authentication.

### Option 4: Manual Updates Only
Disable auto-updates and direct users to download from GitHub releases page.

## Quick Fix
For now, since you're already on the latest version (1.0.3), auto-update won't trigger anyway. 
When you release 1.0.4, consider using a classic token or making a public releases repo.

## Testing Auto-Update
To properly test:
1. Build and release version 1.0.4
2. Install version 1.0.3 on a test machine
3. The auto-updater should detect 1.0.4

The current errors are happening because electron-updater can't download the release assets with your fine-grained token.
