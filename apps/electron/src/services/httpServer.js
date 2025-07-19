/**
 * HTTP Server for Pantheon Electron App
 * Handles incoming chat requests from the router
 */

const express = require('express');
const cors = require('cors');

class HTTPServer {
  constructor() {
    this.app = express();
    this.server = null;
    // Load config to get HTTP port
    const config = require('../../config.js');
    this.port = process.env.PORT || config.device?.httpPort || 3001;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: true, // Allow all origins for now
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-user-id', 'x-pantheon-router'],
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`📥 HTTP Request: ${req.method} ${req.url} from ${req.ip}`);
      next();
    });

    // P2P mode - no API secret authentication needed
    // Requests are routed through P2P coordination server
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Pantheon Electron Device',
        timestamp: new Date(),
        version: '1.0.0'
      });
    });
    
    // Models endpoint
    this.app.get('/models', async (req, res) => {
      try {
        console.log('📋 Models request received from:', req.ip);
        const httpServerHandler = require('../../electron/services/httpServerHandler.js');
        const models = await httpServerHandler.getModels();
        res.json({
          models: models,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to get models:', error);
        res.status(500).json({
          error: {
            message: 'Failed to get models',
            type: 'internal_error'
          }
        });
      }
    });

    // OpenAI-compatible models endpoint
    this.app.get('/v1/models', async (req, res) => {
      try {
        console.log('📋 OpenAI models request received from:', req.ip);
        const httpServerHandler = require('../../electron/services/httpServerHandler.js');
        const models = await httpServerHandler.getModels();
        res.json({
          object: 'list',
          data: models
        });
      } catch (error) {
        console.error('Failed to get models:', error);
        res.status(500).json({
          error: {
            message: 'Failed to get models',
            type: 'internal_error'
          }
        });
      }
    });

    // Queue status endpoint
    this.app.get('/v1/queue/status', (req, res) => {
      try {
        const httpServerHandler = require('../../electron/services/httpServerHandler.js');
        const status = httpServerHandler.getQueueStatus();
        res.json({
          status: 'success',
          queues: status,
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          error: {
            message: 'Failed to get queue status',
            type: 'internal_error'
          }
        });
      }
    });

    // Chat completions endpoint (OpenAI-compatible)
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        console.log('🤖 Chat request received:', {
          model: req.body.model,
          messages: req.body.messages?.length + ' messages',
          stream: req.body.stream
        });

        const { model, messages, stream = false } = req.body;

        if (!model || !messages) {
          return res.status(400).json({
            error: {
              message: 'Missing required fields: model and messages',
              type: 'invalid_request_error'
            }
          });
        }

        // Try to use the HTTP server handler directly if in Electron main process
        try {
          const httpServerHandler = require('../../electron/services/httpServerHandler.js');
          // Extract client ID from headers or use IP as fallback
          const clientId = req.headers['x-client-id'] || req.headers['x-user-id'] || req.ip;
          const response = await httpServerHandler.createChatCompletion(req.body, clientId);
          
          // Handle streaming response if needed
          if (stream && response.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            response.handler(
              (content) => {
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: model,
                  choices: [{
                    index: 0,
                    delta: { content },
                    finish_reason: null
                  }]
                })}\n\n`);
              },
              () => {
                res.write(`data: ${JSON.stringify({
                  id: 'chatcmpl-' + Date.now(),
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: model,
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                  }]
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              }
            );
            return;
          }
          
          // Non-streaming response
          return res.json(response);
        } catch (error) {
          console.error('Failed to process chat request:', error);
          // Continue to fallback
        }

        // Fallback response if not in Electron
        const responseContent = `Hello! I received your message to model "${model}". This is a test response from the Pantheon device. Your message was: "${messages[messages.length - 1]?.content || 'No message'}"`;

        if (stream) {
          // Streaming response
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Transfer-Encoding', 'chunked');
          res.setHeader('Cache-Control', 'no-cache');
          
          // Send response in chunks
          const words = responseContent.split(' ');
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            res.write(`data: ${JSON.stringify({
              id: 'chatcmpl-' + Date.now(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: model,
              choices: [{
                index: 0,
                delta: { content: word },
                finish_reason: null
              }]
            })}\\n\\n`);
            
            // Small delay for streaming effect
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send final chunk
          res.write(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          })}\\n\\n`);
          
          res.write('data: [DONE]\\n\\n');
          res.end();
        } else {
          // Non-streaming response
          res.json({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: responseContent
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0),
              completion_tokens: responseContent.length,
              total_tokens: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) + responseContent.length
            }
          });
        }

      } catch (error) {
        console.error('❌ Chat completion error:', error);
        res.status(500).json({
          error: {
            message: 'Internal server error',
            type: 'server_error',
            details: error.message
          }
        });
      }
    });


    // Catch-all route
    this.app.use((req, res) => {
      console.log(`⚠️ Unknown endpoint: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        error: {
          message: 'Endpoint not found',
          type: 'not_found'
        }
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '0.0.0.0', (error) => {
        if (error) {
          console.error('❌ Failed to start HTTP server:', error);
          reject(error);
        } else {
          console.log(`🚀 Pantheon HTTP server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 HTTP server stopped');
          resolve();
        });
      });
    }
  }

  getPort() {
    return this.port;
  }

  isRunning() {
    return this.server && this.server.listening;
  }
}

module.exports = { HTTPServer };