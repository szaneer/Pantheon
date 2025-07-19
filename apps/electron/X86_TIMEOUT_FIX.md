# x86 Mac Timeout Fix Documentation

## Problem Summary
x86 (Intel) Mac users experience timeout issues when communicating with web clients through P2P connections. This is due to:

1. **WebRTC module compatibility** - Pre-built binaries may not work correctly on x86
2. **Slower ICE gathering** - x86 hardware takes longer to gather network candidates
3. **Connection establishment delays** - Older hardware needs more time for handshakes
4. **Different network stack behavior** - Intel Macs handle networking differently than ARM

## Implemented Fixes

### 1. Architecture Detection (`p2pServiceV2-x86-fix.js`)
- Detects x86 architecture automatically
- Applies optimized settings for Intel Macs
- Provides fallback WebRTC loading mechanisms

### 2. Extended Timeouts for x86
```javascript
// x86 timeouts (2x normal)
CONNECTION_TIMEOUT: 120000      // 2 minutes
ICE_GATHERING_TIMEOUT: 30000    // 30 seconds  
REQUEST_TIMEOUT: 60000          // 60 seconds
KEEP_ALIVE_INTERVAL: 10000      // 10 seconds
```

### 3. Optimized ICE Configuration
- Reduced candidate pool size (5 vs 10)
- Single ICE gathering pass (not continual)
- Extended candidate selection timeout (20s vs 10s)
- More retransmits for reliability (15 vs 10)

### 4. Compatibility Checker
Run `npm run test:x86` to check:
- Architecture details
- WebRTC module availability
- System resources
- Potential issues

### 5. Native Module Rebuild
For x86 users experiencing issues:
```bash
npm run rebuild:x86
```

This script:
- Cleans existing WebRTC modules
- Attempts multiple installation methods
- Rebuilds for the specific Electron version
- Verifies successful installation

## Building for x86

### Development
```bash
# Test in development
npm run dev

# Check compatibility
npm run test:x86
```

### Production Build
```bash
# Build specifically for x86
npm run dist:mac:x64

# Or build universal (includes both architectures)
npm run dist:mac:universal
```

## Troubleshooting

### 1. "WebRTC module not available"
```bash
# Rebuild native modules
npm run rebuild:x86

# If that fails, try manual rebuild
cd node_modules/@roamhq/wrtc
node-gyp rebuild --target=27.3.11 --arch=x64
```

### 2. Connection Still Timing Out
- Check if running through Rosetta 2 (performance impact)
- Ensure sufficient system resources (RAM/CPU)
- Try forcing TURN relay mode:
  ```javascript
  // In config.js
  p2p: {
    forceRelay: true
  }
  ```

### 3. ICE Gathering Failures
- Check firewall settings
- Ensure TURN servers are accessible
- Look for "No TURN relay candidates" in logs

## Performance Tips for x86 Users

1. **Close unnecessary applications** - Free up CPU/memory
2. **Use wired connection** - More stable than WiFi
3. **Disable VPN** - Can interfere with P2P
4. **Update macOS** - Latest versions have better WebRTC support
5. **Consider ARM build** - If using Apple Silicon Mac

## Console Output

x86 users will see:
```
🏗️ Running on x64 architecture
⚙️ x86 optimizations enabled
🔍 x86 Compatibility Check Report
================================
Architecture: x64
Platform: darwin 
...
```

## For Developers

### Adding New x86 Optimizations

1. Update `p2pServiceV2-x86-fix.js` with new settings
2. Test on actual x86 hardware
3. Verify no regression on ARM64
4. Document changes here

### Key Files
- `src/services/p2pServiceV2.js` - Main P2P service
- `src/services/p2pServiceV2-x86-fix.js` - x86 specific fixes
- `src/services/checkX86Compatibility.js` - Compatibility checker
- `scripts/rebuild-x86.sh` - Native module rebuild script

## Future Improvements

1. **Dynamic timeout adjustment** - Based on connection quality
2. **Precompiled x86 binaries** - Ship with working WebRTC modules
3. **Connection quality indicator** - Show users when connections are slow
4. **Automatic fallback to TURN** - When direct connection fails