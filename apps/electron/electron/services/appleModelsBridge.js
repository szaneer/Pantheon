/**
 * Simplified Apple Foundation Models Bridge
 * Uses child_process to execute Swift commands
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class AppleModelsBridge {
  constructor() {
    this.isAvailable = null;
    this.checkAvailability();
  }

  async checkAvailability() {
    try {
      // Simple Swift script to check availability
      const swiftCode = `
import Foundation
import FoundationModels

let model = SystemLanguageModel.default
switch model.availability {
case .available:
    print("AVAILABLE")
case .unavailable(let reason):
    print("UNAVAILABLE:\\(reason)")
@unknown default:
    print("UNKNOWN")
}
`;

      const result = await this.runSwiftCode(swiftCode);
      this.isAvailable = result.includes('AVAILABLE');
      console.log('Apple Foundation Models availability:', result.trim());
      return this.isAvailable;
    } catch (error) {
      console.error('Failed to check Apple Foundation Models:', error);
      this.isAvailable = false;
      return false;
    }
  }

  async runSwiftCode(code) {
    const tempFile = path.join(require('os').tmpdir(), `apple_models_${Date.now()}.swift`);
    
    try {
      await fs.writeFile(tempFile, code, 'utf8');
      // Increase timeout to 65 seconds (5 seconds more than Swift internal timeout)
      const { stdout, stderr } = await execAsync(`swift ${tempFile}`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for larger responses
        timeout: 65000 // 65 seconds
      });
      
      if (stderr && !stderr.includes('warning')) {
        console.error('Swift stderr:', stderr);
        throw new Error(stderr);
      }
      
      return stdout || '';
    } catch (error) {
      console.error('Error running Swift code:', error);
      if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
        throw new Error('Swift execution timed out after 65 seconds. The model may be taking too long to generate a response.');
      }
      throw error;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  async getModels() {
    if (!this.isAvailable) {
      await this.checkAvailability();
    }

    if (!this.isAvailable) {
      return [];
    }

    return [{
      id: 'com.apple.foundation.language',
      name: 'Apple Language Model',
      object: 'model',
      created: Date.now(),
      owned_by: 'apple',
      metadata: {
        name: 'Apple Language Model',
        description: 'On-device language model powering Apple Intelligence',
        type: 'language',
        capabilities: ['chat', 'completion', 'text-generation', 'summarization'],
        maxTokens: 4096
      }
    }];
  }

  async createChatCompletion(request) {
    if (!this.isAvailable) {
      throw new Error('Apple Foundation Models not available');
    }

    const { messages } = request;
    
    // Build the prompt from messages
    let prompt = '';
    let systemPrompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else if (msg.role === 'user') {
        prompt = msg.content; // Use the last user message
      }
    }

    // Swift code to generate response
    const swiftCode = `
import Foundation
import FoundationModels

let session = LanguageModelSession()
let prompt = Prompt("${prompt.replace(/"/g, '\\"')}"${systemPrompt ? `, instructions: "${systemPrompt.replace(/"/g, '\\"')}"` : ''})

let semaphore = DispatchSemaphore(value: 0)

Task {
    do {
        let response = try await session.respond(to: prompt)
        print("RESPONSE_START")
        print(response.content)
        print("RESPONSE_END")
        semaphore.signal()
    } catch {
        print("ERROR:\\(error)")
        semaphore.signal()
    }
}

// Wait for the async task to complete (60 seconds timeout for longer responses)
_ = semaphore.wait(timeout: .now() + 60)
exit(0)
`;

    try {
      console.log('🍎 Starting Apple Foundation Model chat completion...');
      const startTime = Date.now();
      const output = await this.runSwiftCode(swiftCode);
      const duration = Date.now() - startTime;
      console.log(`🍎 Swift execution completed in ${duration}ms`);
      console.log('Swift output:', output);
      
      if (!output) {
        throw new Error('No output from Swift code - possible timeout or crash');
      }
      
      // Extract response between markers
      const match = output.match(/RESPONSE_START\n([\s\S]*?)\nRESPONSE_END/);
      if (match) {
        const content = match[1].trim();
        
        return {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'com.apple.foundation.language',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: content
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: Math.ceil(prompt.length / 4),
            completion_tokens: Math.ceil(content.length / 4),
            total_tokens: Math.ceil((prompt.length + content.length) / 4)
          }
        };
      } else if (output.includes('ERROR:')) {
        throw new Error(output.split('ERROR:')[1].trim());
      } else {
        throw new Error('Unexpected output format');
      }
    } catch (error) {
      console.error('Chat completion error:', error);
      throw error;
    }
  }
}

module.exports = new AppleModelsBridge();