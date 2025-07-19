# Vercel Deployment Guide

## Quick Deploy

1. Install Vercel CLI (if not already installed):
```bash
npm i -g vercel
```

2. Deploy to Vercel:
```bash
vercel
```

3. Follow the prompts:
   - Set up and deploy: Yes
   - Which scope: Select your account
   - Link to existing project: No (create new)
   - Project name: pantheon-web (or your preferred name)
   - Directory: ./
   - Build settings will be auto-detected from vercel.json

## Environment Variables

No environment variables are needed for basic deployment since the signaling server URL is hardcoded to the ngrok endpoint.

## Post-Deployment

After deployment, Vercel will provide you with a URL like:
- https://pantheon-web.vercel.app

The app will automatically connect to the ngrok signaling server at:
- https://narwhal-skilled-lizard.ngrok-free.app

## Updating the Signaling Server URL

To change the signaling server URL later:

1. Edit `src/config/p2p.ts`
2. Update the production URL in `getSignalingServerUrl()` 
3. Remove the ngrok header code from:
   - `src/services/p2pClientServiceV2.ts` (line 115-117)
   - `src/services/tunnelAuthService.ts` (lines 140-142 and 101-103)
4. Redeploy with `vercel --prod`

## Notes

- The ngrok-skip-browser-warning header is automatically added to all requests to ngrok URLs
- This header can be easily removed once you move to a permanent hosting solution
- The app uses Firebase authentication, so users will need to log in with their Firebase credentials