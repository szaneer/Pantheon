// Re-export types for backward compatibility
export type { LLMModel } from '../types/api/models';
export type { ChatMessage, ChatResponse } from '../types/api/chat';

// Re-export providers for backward compatibility
export { LLMProvider } from '../providers/LLMProvider';
export { OllamaProvider } from '../providers/OllamaProvider';
export { RemoteLLMProvider } from '../providers/RemoteProvider';

// Import and re-export the refactored service
import { LLMService as RefactoredLLMService } from './llm/LLMService';

// Use the refactored service but keep the same export name for compatibility
export class LLMService extends RefactoredLLMService {}

export const llmService = new LLMService();

// Expose to global window for Electron main process access
if (typeof window !== 'undefined') {
  (window as any).llmService = llmService;
} 