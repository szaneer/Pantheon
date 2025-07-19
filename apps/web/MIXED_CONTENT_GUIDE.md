# Mixed Content Handling Guide

## 🔒 **HTTPS vs HTTP Connection Issues**

When using the Pantheon web client over HTTPS (like on Vercel), browsers block connections to HTTP devices due to "mixed content" security policies.

## 🚀 **Solutions for HTTP Device Connections**

### **Option 1: Use Easy Hosting (Recommended)**
- Enable "Easy Hosting" on your devices
- This creates HTTPS tunnel URLs that work from anywhere
- Example: `https://abc123.loca.lt` instead of `http://192.168.1.100:8610`

### **Option 2: Run Web Client via HTTP**
```bash
# Serve the web client over HTTP (no mixed content issues)
npm run serve-http

# Access at: http://localhost:3001
# Or from other devices: http://YOUR_IP:3001
```

### **Option 3: Browser Configuration** 
Some browsers allow disabling mixed content blocking:

**Chrome/Edge:**
- Add `--disable-web-security --user-data-dir=/tmp/chrome_dev` flags
- ⚠️ Only for development - reduces security

**Firefox:**
- Set `security.mixed_content.block_active_content` to `false` in `about:config`
- ⚠️ Only for development - reduces security

## 🔧 **Development Recommendations**

### **For Local Development:**
```bash
# Run web client with HTTP for testing
npm run dev-http
```

### **For Production Deployment:**
1. **Primary:** Use Easy Hosting with tunnels (HTTPS everywhere)
2. **Alternative:** Deploy web client to HTTP-only server for compatibility

## 🌐 **Network Configuration**

### **CSP Headers Applied:**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; connect-src 'self' http: https: ws: wss:; img-src 'self' data: blob: http: https:;">
```

### **CORS Configuration:**
- Origin: `*` (all origins allowed)
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Content-Type, Authorization, x-device-secret, x-pantheon-routing, x-pantheon-user`

## 🛡️ **Security Considerations**

### **Easy Hosting (Most Secure):**
- ✅ End-to-end HTTPS encryption
- ✅ No browser security warnings
- ✅ Works from anywhere
- ✅ No network configuration needed

### **HTTP Web Client (Development Only):**
- ⚠️ Unencrypted connections
- ⚠️ Network traffic visible
- ⚠️ Only suitable for trusted networks
- ✅ No mixed content issues

## 📊 **Connection Status Indicators**

The web client shows:
- 🚇 **Tunnel URLs** for easy hosting devices
- ⚠️ **Mixed content warnings** when HTTPS ↔ HTTP issues detected
- 🔌 **Connection status** for each device

## 🔍 **Troubleshooting**

### **"Mixed content blocked" errors:**
1. Check if device has Easy Hosting enabled
2. Use tunnel URL instead of direct IP
3. Try HTTP web client: `npm run serve-http`

### **CORS errors:**
1. Verify device API secret is correct
2. Check device is online and accessible
3. Test direct connection: `curl http://device-ip:port/health`

### **Connection timeouts:**
1. Verify network connectivity
2. Check firewall settings
3. Test with local devices first