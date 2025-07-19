import { LLMModel, ChatMessage, ChatResponse } from '@pantheon/types';

export abstract class LLMProvider {
  abstract name: string;
  abstract getModels(): Promise<LLMModel[]>;
  abstract chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse>;
  abstract isAvailable(): Promise<boolean>;
}