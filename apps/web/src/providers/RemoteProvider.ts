import axios from 'axios';
import { LLMProvider } from './LLMProvider';
import { LLMModel } from '../types/api/models';
import { ChatMessage, ChatResponse } from '../types/api/chat';

export class RemoteLLMProvider extends LLMProvider {
  name = 'Remote';
  private endpoint: string;

  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.endpoint}/health`, { timeout: 5000 });
      return true;
    } catch (error: any) {
      console.warn('Remote provider is not available:', error.message);
      return false;
    }
  }

  async getModels(): Promise<LLMModel[]> {
    try {
      const response = await axios.get(`${this.endpoint}/models`);
      const models = response.data.models || [];
      
      return models.map((model: any) => ({
        id: model.id,
        name: model.id,
        displayName: model.name || model.id,
        provider: model.provider || this.name,
        deviceId: model.id,
        deviceName: model.name || model.id,
        endpoint: this.endpoint,
        isRemote: true
      }));
    } catch (error) {
      console.error('Failed to fetch remote models:', error);
      return [];
    }
  }

  async chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await axios.post(`${this.endpoint}/chat`, {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });

      return response.data;
    } catch (error) {
      console.error('Failed to chat with remote model:', error);
      throw new Error('Failed to communicate with remote model');
    }
  }
}