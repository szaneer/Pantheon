# Custom WebRTC Build Guide

This guide explains how to build and integrate a custom WebRTC framework for Pantheon that supports both Intel (x86_64) and Apple Silicon (arm64) Macs.

## Overview

Instead of relying on pre-built WebRTC modules that may not support all architectures, we build WebRTC from source and create a universal binary framework.

## Prerequisites

- macOS (required for building the framework)
- Xcode and Command Line Tools
- Python 3
- Git
- At least 20GB of free disk space
- 8GB+ RAM recommended

## Building the WebRTC Framework

### Quick Build

Run the automated build script:

```bash
npm run build:webrtc
```

This script will:
1. Clone Google's depot_tools
2. Fetch the WebRTC source code
3. Build for both x86_64 and arm64
4. Create a universal binary using `lipo`
5. Install the framework in `frameworks/WebRTC.framework`

### Manual Build Steps

If you prefer to build manually or the script fails:

1. **Clone depot_tools**:
   ```bash
   git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
   export PATH=$PATH:$(pwd)/depot_tools
   ```

2. **Fetch WebRTC source**:
   ```bash
   fetch --nohooks webrtc_ios
   gclient sync
   ```

3. **Generate build targets**:
   ```bash
   cd src
   
   # For x86_64
   gn gen out/mac_x64 --args='target_os="mac" target_cpu="x64" is_component_build=false is_debug=false rtc_libvpx_build_vp9=false enable_stripping=true rtc_enable_protobuf=false'
   
   # For arm64
   gn gen out/mac_arm64 --args='target_os="mac" target_cpu="arm64" is_component_build=false is_debug=false rtc_libvpx_build_vp9=false enable_stripping=true rtc_enable_protobuf=false'
   ```

4. **Build both architectures**:
   ```bash
   ninja -C out/mac_x64 mac_framework_objc
   ninja -C out/mac_arm64 mac_framework_objc
   ```

5. **Create universal binary**:
   ```bash
   cd ..
   cp -R src/out/mac_x64/WebRTC.framework WebRTC.framework
   lipo -create -output WebRTC.framework/WebRTC \
     src/out/mac_x64/WebRTC.framework/WebRTC \
     src/out/mac_arm64/WebRTC.framework/WebRTC
   ```

6. **Copy to project**:
   ```bash
   cp -R WebRTC.framework /path/to/pantheon/apps/electron/frameworks/
   ```

## Integration

The custom WebRTC framework is integrated through several layers:

### 1. WebRTC Loader (`src/services/webrtc-loader.js`)

This module automatically selects the best available WebRTC implementation:
- Custom WebRTC Framework (preferred on macOS)
- @roamhq/wrtc (fallback)
- wrtc (fallback)
- electron-webrtc (last resort)

### 2. Native Bindings (`native-bindings/webrtc-wrapper.js`)

Provides a wrtc-compatible interface using either:
- Native C++ bindings to the framework (when built)
- JavaScript fallback implementation (for development)

### 3. P2P Service Integration

The P2P service uses the WebRTC loader transparently:
```javascript
const wrtc = require('./webrtc-loader');
```

## Building Native Bindings (Optional)

For better performance, you can build native Node.js bindings:

```bash
npm run build:webrtc:bindings
```

This requires:
- node-gyp installed globally
- Python 2.7 or 3.x
- Xcode Command Line Tools

## Troubleshooting

### Build Failures

1. **"No module named 'importlib_metadata'"**
   ```bash
   pip3 install importlib_metadata
   ```

2. **"Could not find depot_tools"**
   ```bash
   export PATH=$PATH:/path/to/depot_tools
   ```

3. **Out of disk space**
   - The WebRTC source is ~15GB
   - Build artifacts need another ~10GB
   - Consider using an external drive

### Runtime Issues

1. **"No WebRTC implementation available"**
   - Run `npm run build:webrtc`
   - Check that `frameworks/WebRTC.framework` exists
   - Try the fallback: `npm install @roamhq/wrtc`

2. **Architecture mismatch**
   ```bash
   # Verify the framework is universal
   lipo -info frameworks/WebRTC.framework/WebRTC
   ```

3. **Code signing issues**
   ```bash
   codesign --force --deep --sign - frameworks/WebRTC.framework
   ```

## Testing

1. **Check WebRTC implementation**:
   ```bash
   node -e "console.log(require('./src/services/webrtc-loader').getImplementationInfo())"
   ```

2. **Run P2P tests**:
   ```bash
   npm test -- --grep "P2P"
   ```

3. **Test on different architectures**:
   - Intel Mac: Should use x86_64 slice
   - Apple Silicon: Should use arm64 slice
   - Rosetta 2: Should work with either

## Performance

The custom WebRTC build offers:
- Native performance on both architectures
- No Rosetta 2 translation overhead
- Smaller bundle size (framework is stripped)
- Better compatibility with macOS security features

## Maintenance

- WebRTC is actively developed, consider updating quarterly
- Check for security updates: https://webrtc.org/security/
- Test thoroughly after updates

## Resources

- [WebRTC Official Docs](https://webrtc.org/native-code/development/)
- [Chromium depot_tools](https://chromium.googlesource.com/chromium/tools/depot_tools.git)
- [WebRTC Build Instructions](https://webrtc.googlesource.com/src/+/main/docs/native-code/development/)