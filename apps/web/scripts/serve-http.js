#!/usr/bin/env node

import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const distPath = path.join(__dirname, '../dist');

// Enable CORS for all origins
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-secret', 'x-pantheon-routing', 'x-pantheon-user']
}));

// Set headers to allow mixed content
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-secret, x-pantheon-routing, x-pantheon-user');
  
  // Don't set upgrade-insecure-requests header
  res.setHeader('Content-Security-Policy', 'default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: blob: http: https:; connect-src \'self\' http: https: ws: wss:; img-src \'self\' data: blob: http: https:;');
  
  next();
});

// Serve static files from dist
app.use(express.static(distPath));

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 Pantheon Web Client serving at http://localhost:${port}`);
  console.log(`📡 Accessible from any device at http://YOUR_IP:${port}`);
  console.log(`✅ HTTP server allows connections to HTTP devices without mixed content issues`);
});