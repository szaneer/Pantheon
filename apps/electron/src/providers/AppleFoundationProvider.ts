import { LLMProvider } from './LLMProvider';
import { LLMModel } from '../types/api/models';

export class AppleFoundationProvider implements LLMProvider {
  id = 'apple-foundation';
  name = 'Apple Foundation Models';

  async isAvailable(): Promise<boolean> {
    try {
      // Check if we're in Electron and on macOS
      if (!window.electronAPI) {
        return false;
      }

      const platform = await window.electronAPI.getPlatform();
      if (platform !== 'darwin') {
        return false;
      }

      // Check if Apple Foundation Models are available
      const isSupported = await window.electronAPI.appleModels.isSupported();
      return isSupported;
    } catch (error) {
      console.error('Error checking Apple Foundation Models availability:', error);
      return false;
    }
  }

  async getModels(): Promise<LLMModel[]> {
    try {
      if (!window.electronAPI) {
        return [];
      }

      const result = await window.electronAPI.appleModels.getModels();
      if (!result.success || !result.models) {
        return [];
      }
      const models = result.models;
      
      return models.map(model => ({
        id: model.id,
        name: model.metadata.name,
        provider: 'Apple Foundation',
        description: model.metadata.description,
        capabilities: model.metadata.capabilities,
        maxTokens: model.metadata.maxTokens,
        isLocal: true
      }));
    } catch (error) {
      console.error('Error getting Apple Foundation models:', error);
      return [];
    }
  }

  async generateResponse(
    model: LLMModel,
    messages: Array<{ role: string; content: string }>,
    onToken?: (token: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      if (!window.electronAPI) {
        throw new Error('Not in Electron environment');
      }

      const result = await window.electronAPI.appleModels.chat({
        model: model.id,
        messages,
        temperature: 0.7,
        max_tokens: model.maxTokens || 2048
      });

      if (!result.success || !result.response) {
        throw new Error(result.error || 'Failed to generate response');
      }

      const response = result.response;

      // Simulate streaming for consistency
      if (onToken && response.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content;
        const words = content.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const word = i === 0 ? words[i] : ' ' + words[i];
          onToken(word);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error generating response with Apple Foundation model:', error);
      throw error;
    }
  }

  async chat(modelId: string, messages: Array<{ role: string; content: string }>): Promise<any> {
    try {
      if (!window.electronAPI) {
        throw new Error('Not in Electron environment');
      }

      const result = await window.electronAPI.appleModels.chat({
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 2048
      });

      if (!result.success || !result.response) {
        throw new Error(result.error || 'Failed to generate response');
      }

      const response = result.response;
      
      // Transform the response to match ChatResponse interface
      return {
        message: response.choices?.[0]?.message?.content || '',
        model: response.model || modelId,
        usage: response.usage
      };
    } catch (error) {
      console.error('Error in Apple Foundation chat:', error);
      throw error;
    }
  }

  async testConnection(model: LLMModel): Promise<boolean> {
    try {
      // Apple models are always available when supported
      return await this.isAvailable();
    } catch (error) {
      console.error('Error testing Apple Foundation model connection:', error);
      return false;
    }
  }
}