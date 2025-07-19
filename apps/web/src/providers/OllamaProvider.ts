import axios from 'axios';
import { LLMProvider } from './LLMProvider';
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
        console.warn('Ollama might not be running. Start it with: ollama serve');
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
}