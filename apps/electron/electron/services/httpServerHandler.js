/**
 * HTTP Server Handler for Main Process
 * Handles model queries and chat completions from the HTTP server
 */

const axios = require('axios');
const appleFoundationModels = require('../../src/services/appleFoundationModels.js');
const appleModelsBridge = require('./appleModelsBridge.js');
const queueManager = require('./queueManager.js');

class HTTPServerHandler {
  constructor() {
    this.ollamaBaseUrl = 'http://127.0.0.1:11434';
  }

  /**
   * Get all available models (Ollama + Apple Foundation)
   */
  async getModels() {
    console.log('🔍 HTTPServerHandler.getModels() called');
    const models = [];

    // Get Ollama models
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
      if (response.data && response.data.models) {
        models.push(...response.data.models.map(model => ({
          id: model.name,
          name: model.name,
          object: 'model',
          created: model.modified_at ? new Date(model.modified_at).getTime() : Date.now(),
          owned_by: 'ollama',
          provider: 'Ollama',
          size: model.size,
          digest: model.digest,
          modified_at: model.modified_at
        })));
      }
    } catch (error) {
      console.error('Failed to get Ollama models:', error.message);
    }

    // Get Apple Foundation models if supported
    try {
      console.log('🍎 Checking Apple Foundation Models availability...');
      // Try bridge first
      const bridgeAvailable = await appleModelsBridge.checkAvailability();
      console.log('🍎 Bridge available:', bridgeAvailable);
      
      if (bridgeAvailable) {
        const appleModels = await appleModelsBridge.getModels();
        console.log('🍎 Apple models from bridge:', appleModels);
        models.push(...appleModels.map(model => ({
          ...model,
          provider: 'Apple Foundation'
        })));
      } else if (await appleFoundationModels.checkSupport()) {
        console.log('🍎 Trying fallback service...');
        // Fallback to original service
        const appleModels = await appleFoundationModels.getModels();
        console.log('🍎 Apple models from service:', appleModels);
        models.push(...appleModels.map(model => ({
          ...model,
          provider: 'Apple Foundation'
        })));
      } else {
        console.log('🍎 Apple Foundation Models not available');
      }
    } catch (error) {
      console.error('Failed to get Apple models:', error.message);
    }

    console.log(`📋 HTTPServerHandler returning ${models.length} total models`);
    return models;
  }

  /**
   * Create chat completion with queue management
   */
  async createChatCompletion(request, clientId = 'default') {
    const { model, messages, stream = false } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a promise that will be resolved when the request is processed
    return new Promise((resolve, reject) => {
      queueManager.enqueue({
        id: requestId,
        clientId,
        modelId: model,
        data: request,
        callback: async (result) => {
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          
          if (result.success && result.execute) {
            try {
              const response = await result.execute(() => this._processRequest(model, messages, stream));
              resolve(response);
            } catch (error) {
              reject(error);
            }
          }
        }
      });
    });
  }
  
  /**
   * Internal method to process the actual request
   */
  async _processRequest(model, messages, stream) {
    const request = { model, messages, stream };

    // Extract the actual model name by removing prefix if present
    let actualModel = model.startsWith('electron_') ? model.replace('electron_', '') : model;
    
    // Handle display name to ID mapping for Apple Foundation models
    if (actualModel === 'Apple Language Model') {
      actualModel = 'com.apple.foundation.language';
    }

    // Check if it's an Apple Foundation model
    if (actualModel.startsWith('com.apple.foundation')) {
      // Create request with actual model name
      const appleRequest = { model: actualModel, messages, stream };
      
      // Try bridge first
      if (await appleModelsBridge.checkAvailability()) {
        return await appleModelsBridge.createChatCompletion(appleRequest);
      } else if (await appleFoundationModels.checkSupport()) {
        // Fallback to original service
        return await appleFoundationModels.createChatCompletion(appleRequest);
      } else {
        throw new Error('Apple Foundation Models not supported on this system');
      }
    }

    // Otherwise, use Ollama
    try {
      // Convert messages to Ollama format
      const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      
      const ollamaRequest = {
        model: actualModel, // Use the cleaned model name without electron_ prefix
        prompt,
        stream: false // We'll handle streaming ourselves
      };

      const response = await axios.post(
        `${this.ollamaBaseUrl}/api/generate`,
        ollamaRequest,
        { responseType: stream ? 'stream' : 'json' }
      );

      if (stream) {
        // Return a stream handler function for /api/generate
        return {
          stream: true,
          handler: (onData, onEnd) => {
            response.data.on('data', (chunk) => {
              try {
                const lines = chunk.toString().split('\n').filter(line => line.trim());
                lines.forEach(line => {
                  const data = JSON.parse(line);
                  if (data.response) {
                    onData(data.response);
                  }
                });
              } catch (error) {
                console.error('Error parsing stream chunk:', error);
              }
            });
            
            response.data.on('end', onEnd);
            response.data.on('error', (error) => {
              console.error('Stream error:', error);
              onEnd();
            });
          }
        };
      }

      // Non-streaming response for /api/generate
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response.data.response || ''
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('Ollama chat completion error:', error);
      throw error;
    }
  }
  
  /**
   * Get queue status
   */
  getQueueStatus() {
    return queueManager.getQueueStatus();
  }
}

module.exports = new HTTPServerHandler();