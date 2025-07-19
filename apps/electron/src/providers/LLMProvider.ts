import { LLMModel } from '../types/api/models';
import { ChatMessage, ChatResponse } from '../types/api/chat';

export type StreamCallback = (token: string) => void;
export type CompleteCallback = () => void;

export abstract class LLMProvider {
  abstract name: string;
  abstract getModels(): Promise<LLMModel[]>;
  abstract chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse>;
  abstract chatStream?(
    modelId: string, 
    messages: ChatMessage[], 
    onToken: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void>;
  abstract isAvailable(): Promise<boolean>;
}