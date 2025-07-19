import { LLMProvider, StreamCallback, CompleteCallback } from '../../providers/LLMProvider';
import { OllamaProvider } from '../../providers/OllamaProvider';
import { RemoteLLMProvider } from '../../providers/RemoteProvider';
import { AppleFoundationProvider } from '../../providers/AppleFoundationProvider';
import { ModelRegistry } from './ModelRegistry';
import { PantheonRouter } from './PantheonRouter';
import { LLMModel } from '../../types/api/models';
import { ChatMessage, ChatResponse } from '../../types/api/chat';

export class LLMService {
  private modelRegistry: ModelRegistry;
  private pantheonRouter: PantheonRouter;

  constructor() {
    this.modelRegistry = new ModelRegistry();
    this.pantheonRouter = new PantheonRouter();
    
    // Initialize default providers
    this.modelRegistry.addProvider('ollama', new OllamaProvider());
    this.modelRegistry.addProvider('apple-foundation', new AppleFoundationProvider());
  }

  setCurrentUserId(userId: string) {
    this.modelRegistry.setCurrentUserId(userId);
    this.pantheonRouter.setCurrentUserId(userId);
  }

  addProvider(id: string, provider: LLMProvider) {
    this.modelRegistry.addProvider(id, provider);
  }

  async getAllModels(): Promise<LLMModel[]> {
    return await this.modelRegistry.getAllModels();
  }

  async chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    // Try direct local access first
    const directResponse = await this.tryDirectLocalModel(modelId, messages);
    if (directResponse) {
      return directResponse;
    }
    
    // Get model from registry
    const targetModel = await this.modelRegistry.findModel(modelId);
    
    if (!targetModel) {
      throw new Error(`Model ${modelId} not found in registry or local providers`);
    }
    
    // Route based on model type
    if (targetModel.isRemote) {
      const [deviceId, actualModelId] = targetModel.id.split('|');
      return await this.pantheonRouter.routeToRemoteDevice(deviceId, actualModelId, messages);
    }
    
    return await this.chatWithLocalModel(targetModel, messages);
  }

  private async tryDirectLocalModel(modelId: string, messages: ChatMessage[]): Promise<ChatResponse | null> {
    const result = await this.modelRegistry.findLocalModel(modelId);
    
    if (result) {
      const response = await result.provider.chat(result.model.id, messages);
      
      return {
        ...response,
        model: `Local:${result.model.name}`,
        pantheonRouted: false,
        deviceId: 'local',
        deviceName: 'Local Device'
      };
    }
    
    return null;
  }

  private async chatWithLocalModel(targetModel: LLMModel, messages: ChatMessage[]): Promise<ChatResponse> {
    const result = await this.modelRegistry.findLocalModel(targetModel.id);
    
    if (!result) {
      throw new Error(`Model ${targetModel.id} not found in any available local provider`);
    }

    const response = await result.provider.chat(result.model.id, messages);
    
    return {
      ...response,
      model: `Local:${targetModel.name}`,
      pantheonRouted: false,
      deviceId: 'local',
      deviceName: 'Local Device'
    };
  }

  async chatStream(
    modelId: string, 
    messages: ChatMessage[],
    onToken: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    // Try direct local access first
    const localResult = await this.modelRegistry.findLocalModel(modelId);
    if (localResult && localResult.provider.chatStream) {
      await localResult.provider.chatStream(localResult.model.id, messages, onToken, onComplete);
      return;
    }
    
    // Get model from registry
    const targetModel = await this.modelRegistry.findModel(modelId);
    
    if (!targetModel) {
      throw new Error(`Model ${modelId} not found in registry or local providers`);
    }
    
    // Route based on model type
    if (targetModel.isRemote) {
      // For now, remote models fall back to non-streaming
      const response = await this.chat(modelId, messages);
      onToken(response.message);
      onComplete();
      return;
    }
    
    await this.chatStreamWithLocalModel(targetModel, messages, onToken, onComplete);
  }

  private async chatStreamWithLocalModel(
    targetModel: LLMModel, 
    messages: ChatMessage[],
    onToken: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    const result = await this.modelRegistry.findLocalModel(targetModel.id);
    
    if (!result) {
      throw new Error(`Model ${targetModel.id} not found in any available local provider`);
    }

    if (!result.provider.chatStream) {
      // Fall back to non-streaming
      const response = await result.provider.chat(result.model.id, messages);
      onToken(response.message);
      onComplete();
      return;
    }

    await result.provider.chatStream(result.model.id, messages, onToken, onComplete);
  }

  async addRemoteProvider(endpoint: string): Promise<void> {
    const provider = new RemoteLLMProvider(endpoint);
    if (await provider.isAvailable()) {
      this.addProvider(`remote-${Date.now()}`, provider);
    } else {
      throw new Error('Remote provider is not available');
    }
  }
}