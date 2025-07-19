import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    global: 'globalThis',
    'process.env': '{}',
  },
  resolve: {
    alias: {
      util: 'util',
      process: 'process/browser',
      buffer: 'buffer',
      stream: 'stream-browserify',
      events: 'events'
    },
  },
  optimizeDeps: {
    include: [
      'process', 
      'process/browser', 
      'buffer', 
      'simple-peer',
      'socket.io-client',
      'events'
    ]
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        globals: {
          'process': 'process'
        }
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 3003, // Use different port from main app  
    host: '0.0.0.0', // Allow external connections
    strictPort: true, // Don't try other ports if 3003 is taken
    cors: {
      origin: true, // Allow all origins during development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-device-secret', 'x-pantheon-routing', 'x-pantheon-user']
    },
    headers: {
      // Additional headers to allow mixed content
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-secret, x-pantheon-routing, x-pantheon-user',
    },
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    },
  },
}) 