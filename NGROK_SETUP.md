# ngrok Setup Guide

## Prerequisites

1. Install ngrok:
   ```bash
   brew install ngrok/ngrok/ngrok
   ```
   Or download from: https://ngrok.com/download

2. Sign up for a free ngrok account: https://ngrok.com/signup

3. Get your auth token: https://dashboard.ngrok.com/get-started/your-authtoken

## Configuration

1. Update `ngrok.yml` with your auth token:
   ```yaml
   authtoken: YOUR_ACTUAL_AUTH_TOKEN_HERE
   ```

## Usage

Run the start script to expose both services:

```bash
./start-ngrok.sh
```

This will create tunnels for:
- **Signaling Server** (port 3001) - For WebRTC signaling
- **Web App** (port 3002) - For local web app testing

## Tunnel URLs

After starting ngrok, you'll see URLs like:
```
Signaling Server: https://abc123.ngrok-free.app
Web App:          https://xyz789.ngrok-free.app
```

## Using with Specific Tunnel

To start only one tunnel:
```bash
# Only signaling server
ngrok start signaling-server --config ngrok.yml

# Only web app
ngrok start web-app --config ngrok.yml
```

## Free Tier Limitations

- 1 online ngrok process
- 4 tunnels per ngrok process
- 40 connections per minute
- Random URLs (change on restart)

## Tips

1. **Stable URLs**: Upgrade to a paid plan for custom domains
2. **Multiple Tunnels**: Both tunnels run in one ngrok process
3. **CORS**: The ngrok-skip-browser-warning header is already configured in the web app

## Troubleshooting

- **Auth Error**: Make sure you've added your auth token to ngrok.yml
- **Port in Use**: Ensure ports 3001 and 3002 are free
- **Connection Limit**: Free tier has connection limits, upgrade if needed