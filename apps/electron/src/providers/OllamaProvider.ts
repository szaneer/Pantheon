import axios from 'axios';
import { LLMProvider, StreamCallback, CompleteCallback } from './LLMProvider';
import { LLMModel } from '../types/api/models';
import { ChatMessage, ChatResponse } from '../types/api/chat';

export class OllamaProvider extends LLMProvider {
  name = 'Ollama';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    const isDev = window.location.port === '3000' || window.location.hostname === 'localhost';
    if (isDev && !baseUrl) {
      this.baseUrl = '/api/ollama';
    } else {
      this.baseUrl = baseUrl || 'http://127.0.0.1:11434';
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return true;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        // Check if we have the Ollama manager available (Electron only)
        if (window.electronAPI?.ollama) {
          console.log('Ollama not running, checking if managed...');
          
          try {
            const status = await window.electronAPI.ollama.initialize();
            
            if (status.installed && !status.running) {
              console.log('Starting managed Ollama instance...');
              const startResult = await window.electronAPI.ollama.start();
              
              if (startResult.success) {
                // Wait a bit for Ollama to start
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Try again
                try {
                  await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
                  return true;
                } catch {
                  return false;
                }
              }
            }
          } catch (err) {
            console.error('Failed to auto-start Ollama:', err);
          }
        } else {
          console.warn('Ollama might not be running. Start it with: ollama serve');
        }
      }
      return false;
    }
  }

  async getModels(): Promise<LLMModel[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      
      if (!window.electronAPI) {
        const deviceId = 'fallback_device_' + Date.now();
        const deviceName = 'Local Device';
        
        return response.data.models.map((model: any) => ({
          id: model.name,
          name: model.name,
          provider: this.name,
          deviceId,
          deviceName,
          endpoint: this.baseUrl,
          isRemote: false
        }));
      }
      
      const deviceId = await window.electronAPI.getDeviceId();
      const deviceName = await window.electronAPI.getStoreValue('deviceName') || 'Local Device';
      
      return response.data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        provider: this.name,
        deviceId,
        deviceName,
        endpoint: this.baseUrl,
        isRemote: false
      }));
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  async chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false
      });

      return {
        message: response.data.message.content,
        model: modelId
      };
    } catch (error) {
      console.error('Failed to chat with Ollama:', error);
      throw new Error('Failed to communicate with Ollama');
    }
  }

  async chatStream(
    modelId: string, 
    messages: ChatMessage[], 
    onToken: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                onToken(data.message.content);
              }
              if (data.done) {
                onComplete();
              }
            } catch (e) {
              console.error('Failed to parse streaming response:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to stream chat with Ollama:', error);
      throw new Error('Failed to stream with Ollama');
    }
  }
}