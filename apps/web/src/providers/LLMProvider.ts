import { LLMModel } from '../types/api/models';
import { ChatMessage, ChatResponse } from '../types/api/chat';

export abstract class LLMProvider {
  abstract name: string;
  abstract getModels(): Promise<LLMModel[]>;
  abstract chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse>;
  abstract isAvailable(): Promise<boolean>;
}