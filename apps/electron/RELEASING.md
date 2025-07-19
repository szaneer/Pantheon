# Release Guide for Pantheon Electron App

## Overview

Pantheon Electron app uses electron-updater for automatic updates. Users will be notified when a new version is available and can update with one click.

## Release Process

### 1. Update Version

Update the version in `package.json`:
```json
{
  "version": "1.0.1"
}
```

### 2. Commit Changes

```bash
git add .
git commit -m "Release v1.0.1"
git push origin main
```

### 3. Create GitHub Release

#### Option A: Using GitHub Actions (Recommended)
```bash
# Create and push a tag
git tag v1.0.1
git push origin v1.0.1
```

This will trigger the GitHub Action to build and publish releases for all platforms.

#### Option B: Manual Release
```bash
# Build for your platform
npm run release:mac    # macOS
npm run release:win    # Windows
npm run release:linux  # Linux

# Or build for all platforms (requires appropriate build environment)
npm run release
```

### 4. Publish Release

1. Go to your GitHub repository's releases page
2. Edit the draft release created by the build
3. Add release notes
4. Publish the release

## Auto-Update Configuration

The app is configured to:
- Check for updates on startup
- Check for updates every 4 hours
- Allow manual update checks via Help menu
- Download updates in the background
- Prompt users to restart when update is ready

## Version Numbering

Follow semantic versioning:
- MAJOR.MINOR.PATCH (e.g., 1.0.0)
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

## Testing Updates

1. Build a test release with a higher version number
2. Install the current version
3. Run the app and check for updates
4. Verify the update downloads and installs correctly

## Troubleshooting

- **Updates not detected**: Check GitHub release is published (not draft)
- **Download fails**: Verify release assets are uploaded correctly
- **Installation fails**: Check code signing settings in electron-builder.yml
- **Linux updates**: Auto-updates work best with AppImage format

## Security Notes

- Updates are downloaded over HTTPS from GitHub
- electron-updater verifies downloads
- For additional security, consider code signing (requires certificates)