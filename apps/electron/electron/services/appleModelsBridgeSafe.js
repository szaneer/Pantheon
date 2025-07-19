/**
 * Safe Apple Foundation Models Bridge
 * Handles OS version checking and graceful fallbacks
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const osVersionCheck = require('./osVersionCheck');

const execAsync = promisify(exec);

class AppleModelsBridgeSafe {
  constructor() {
    this.isAvailable = null;
    this.unsupportedReason = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return this.isAvailable;
    }

    try {
      // First check OS compatibility
      const osSupport = await osVersionCheck.supportsAppleFoundationModels();
      
      if (!osSupport.supported) {
        this.isAvailable = false;
        this.unsupportedReason = osSupport.reason;
        console.log(`⚠️ Apple Foundation Models not supported: ${osSupport.reason}`);
        this.initialized = true;
        return false;
      }

      // Then check actual availability
      await this.checkAvailability();
      this.initialized = true;
      return this.isAvailable;
    } catch (error) {
      console.error('Failed to initialize Apple Models Bridge:', error);
      this.isAvailable = false;
      this.unsupportedReason = error.message;
      this.initialized = true;
      return false;
    }
  }

  async checkAvailability() {
    // Don't attempt to import if OS doesn't support it
    if (this.unsupportedReason) {
      return false;
    }

    try {
      // First verify the framework exists
      const frameworkPath = '/System/Library/Frameworks/FoundationModels.framework';
      try {
        await fs.access(frameworkPath);
      } catch (error) {
        this.isAvailable = false;
        this.unsupportedReason = 'FoundationModels.framework not found';
        return false;
      }

      // Simple Swift script to check availability
      const swiftCode = `
import Foundation

// Check if we can import FoundationModels
#if canImport(FoundationModels)
import FoundationModels

if #available(macOS 15.0, *) {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        print("AVAILABLE")
    case .unavailable(let reason):
        print("UNAVAILABLE:\\(reason)")
    @unknown default:
        print("UNKNOWN")
    }
} else {
    print("UNAVAILABLE:Requires macOS 15.0 or later")
}
#else
    print("UNAVAILABLE:FoundationModels framework not available")
#endif
`;

      const result = await this.runSwiftCode(swiftCode);
      this.isAvailable = result.includes('AVAILABLE') && !result.includes('UNAVAILABLE');
      
      if (!this.isAvailable && result.includes('UNAVAILABLE:')) {
        this.unsupportedReason = result.split('UNAVAILABLE:')[1].trim();
      }
      
      console.log('Apple Foundation Models availability:', result.trim());
      return this.isAvailable;
    } catch (error) {
      console.error('Failed to check Apple Foundation Models:', error);
      this.isAvailable = false;
      this.unsupportedReason = error.message;
      
      // Check if it's a compilation error due to missing framework
      if (error.message.includes('no such module') || error.message.includes('FoundationModels')) {
        this.unsupportedReason = 'FoundationModels framework not available on this system';
      }
      
      return false;
    }
  }

  async runSwiftCode(code) {
    const tempFile = path.join(require('os').tmpdir(), `apple_models_${Date.now()}.swift`);
    
    try {
      await fs.writeFile(tempFile, code, 'utf8');
      
      // Use swiftc with SDK path to ensure proper compilation
      const compileCommand = os.arch() === 'arm64' 
        ? `swift ${tempFile}` 
        : `swift -sdk $(xcrun --show-sdk-path) ${tempFile}`;
      
      const { stdout, stderr } = await execAsync(compileCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 10000 // 10 seconds for compilation check
      });
      
      if (stderr && !stderr.includes('warning')) {
        // Check for specific import errors
        if (stderr.includes('no such module') || stderr.includes('cannot find')) {
          throw new Error('FoundationModels framework not available on this system');
        }
        throw new Error(stderr);
      }
      
      return stdout || '';
    } catch (error) {
      console.error('Error running Swift code:', error);
      throw error;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  async getModels() {
    if (!await this.initialize()) {
      return [];
    }

    if (!this.isAvailable) {
      console.log(`Cannot get models: ${this.unsupportedReason}`);
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
    if (!await this.initialize()) {
      throw new Error(`Apple Foundation Models not available: ${this.unsupportedReason}`);
    }

    if (!this.isAvailable) {
      throw new Error(`Apple Foundation Models not available: ${this.unsupportedReason}`);
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

    // Swift code to generate response with proper availability checks
    const swiftCode = `
import Foundation

#if canImport(FoundationModels)
import FoundationModels

if #available(macOS 15.0, *) {
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
    
    // Wait for the async task to complete
    _ = semaphore.wait(timeout: .now() + 60)
    exit(0)
} else {
    print("ERROR:Requires macOS 15.0 or later")
    exit(1)
}
#else
    print("ERROR:FoundationModels framework not available")
    exit(1)
#endif
`;

    try {
      console.log('🍎 Starting Apple Foundation Model chat completion...');
      const startTime = Date.now();
      const output = await this.runSwiftCode(swiftCode);
      const duration = Date.now() - startTime;
      console.log(`🍎 Swift execution completed in ${duration}ms`);
      
      if (!output) {
        throw new Error('No output from Swift code');
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

  getUnsupportedReason() {
    return this.unsupportedReason;
  }

  async getSystemRequirements() {
    const systemInfo = await osVersionCheck.getSystemInfo();
    const supportInfo = await osVersionCheck.supportsAppleFoundationModels();
    
    return {
      currentSystem: systemInfo,
      requirements: {
        os: 'macOS 15.0+ (Sequoia)',
        chip: 'Apple Silicon (M1 or later)',
        framework: 'FoundationModels.framework',
        appleIntelligence: 'Must be enabled in System Settings'
      },
      meetsRequirements: supportInfo.supported,
      reason: supportInfo.reason
    };
  }
}

module.exports = new AppleModelsBridgeSafe();