const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const https = require('https');
const { createWriteStream } = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

class OllamaManager {
  constructor() {
    this.ollamaProcess = null;
    this.isRunning = false;
    this.downloadProgress = 0;
    this.ollamaPath = null;
    this.ollamaDataDir = path.join(app.getPath('userData'), 'ollama');
    this.ollamaBinaryDir = path.join(app.getPath('userData'), 'ollama-binary');
    this.modelCache = new Map();
    this.eventHandlers = new Map();
  }

  async initialize() {
    console.log('🚀 Initializing Ollama Manager...');
    
    // Create necessary directories
    await this.ensureDirectories();
    
    // Check if Ollama is already installed
    const isInstalled = await this.checkOllamaInstalled();
    
    if (!isInstalled) {
      console.log('⚠️ Ollama not found. Will need to download.');
      return { installed: false, running: false };
    }
    
    // Check if Ollama is running
    const isRunning = await this.checkOllamaRunning();
    
    return { installed: true, running: isRunning };
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.ollamaDataDir, { recursive: true });
      await fs.mkdir(this.ollamaBinaryDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error);
    }
  }

  async checkOllamaInstalled() {
    // First check if we have a bundled version
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'ollama.exe' : 'ollama';
    this.ollamaPath = path.join(this.ollamaBinaryDir, binaryName);
    
    try {
      await fs.access(this.ollamaPath);
      console.log('✅ Found bundled Ollama at:', this.ollamaPath);
      return true;
    } catch {
      // Check system installation with multiple methods
      const possiblePaths = [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        '/usr/bin/ollama'
      ];
      
      // First try common paths directly
      for (const testPath of possiblePaths) {
        try {
          await fs.access(testPath);
          this.ollamaPath = testPath;
          console.log('✅ Found system Ollama at:', this.ollamaPath);
          return true;
        } catch {
          // Continue to next path
        }
      }
      
      // Try which command
      try {
        const { stdout } = await execAsync('which ollama');
        if (stdout.trim()) {
          this.ollamaPath = stdout.trim();
          console.log('✅ Found system Ollama via which at:', this.ollamaPath);
          return true;
        }
      } catch (error) {
        console.log('which command failed:', error.message);
      }
      
      // Try whereis command (Linux/Unix)
      try {
        const { stdout } = await execAsync('whereis ollama');
        const paths = stdout.split(' ').slice(1).filter(p => p.trim() && !p.includes(':'));
        if (paths.length > 0) {
          this.ollamaPath = paths[0];
          console.log('✅ Found system Ollama via whereis at:', this.ollamaPath);
          return true;
        }
      } catch {
        // Command not available or failed
      }
      
      // Final check: if Ollama service is running, it's probably installed
      if (await this.checkOllamaRunning()) {
        console.log('✅ Ollama is running, assuming it\'s installed');
        this.ollamaPath = 'ollama'; // Use system PATH
        return true;
      }
    }
    
    console.log('❌ Ollama not found in any expected location');
    return false;
  }

  async checkOllamaRunning() {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags');
      return response.ok;
    } catch {
      return false;
    }
  }

  getDownloadUrl() {
    const platform = process.platform;
    const arch = process.arch;
    
    // Note: Ollama provides installers, not raw binaries
    // For a production app, you would need to either:
    // 1. Bundle Ollama with your app build
    // 2. Download and extract from official installers
    // 3. Use Ollama's API to download
    
    // For now, we'll return null and show a message to install manually
    console.warn('Automatic Ollama download not yet implemented. Please install Ollama manually from https://ollama.ai');
    
    return null;
  }

  async downloadOllama(onProgress) {
    const url = this.getDownloadUrl();
    if (!url) {
      throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
    }
    
    console.log('📥 Downloading Ollama from:', url);
    
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'ollama.exe' : 'ollama';
    const downloadPath = path.join(this.ollamaBinaryDir, binaryName + '.tmp');
    const finalPath = path.join(this.ollamaBinaryDir, binaryName);
    
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Pantheon-App' } }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          https.get(response.headers.location, { headers: { 'User-Agent': 'Pantheon-App' } }, (redirectResponse) => {
            this.handleDownloadResponse(redirectResponse, downloadPath, finalPath, onProgress, resolve, reject);
          });
        } else {
          this.handleDownloadResponse(response, downloadPath, finalPath, onProgress, resolve, reject);
        }
      }).on('error', reject);
    });
  }

  handleDownloadResponse(response, downloadPath, finalPath, onProgress, resolve, reject) {
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;
    
    const writer = createWriteStream(downloadPath);
    
    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      this.downloadProgress = (downloadedSize / totalSize) * 100;
      
      if (onProgress) {
        onProgress(this.downloadProgress);
      }
    });
    
    response.pipe(writer);
    
    writer.on('finish', async () => {
      writer.close();
      
      try {
        // Make the binary executable on Unix-like systems
        if (process.platform !== 'win32') {
          await fs.chmod(downloadPath, '755');
        }
        
        // Move to final location
        await fs.rename(downloadPath, finalPath);
        this.ollamaPath = finalPath;
        
        console.log('✅ Ollama downloaded successfully');
        resolve(finalPath);
      } catch (error) {
        reject(error);
      }
    });
    
    writer.on('error', async (error) => {
      try {
        await fs.unlink(downloadPath);
      } catch {}
      reject(error);
    });
  }

  async startOllama() {
    if (this.isRunning) {
      console.log('⚠️ Ollama is already running');
      return;
    }
    
    if (!this.ollamaPath) {
      throw new Error('Ollama not installed');
    }
    
    console.log('🚀 Starting Ollama server...');
    
    // Set environment variables
    const env = {
      ...process.env,
      OLLAMA_MODELS: path.join(this.ollamaDataDir, 'models'),
      OLLAMA_HOST: '127.0.0.1:11434'
    };
    
    // Start Ollama serve
    this.ollamaProcess = spawn(this.ollamaPath, ['serve'], {
      env,
      detached: false
    });
    
    this.ollamaProcess.stdout.on('data', (data) => {
      console.log(`Ollama: ${data}`);
    });
    
    this.ollamaProcess.stderr.on('data', (data) => {
      console.error(`Ollama Error: ${data}`);
    });
    
    this.ollamaProcess.on('close', (code) => {
      console.log(`Ollama process exited with code ${code}`);
      this.isRunning = false;
      this.ollamaProcess = null;
      this.emit('stopped', code);
    });
    
    // Wait for Ollama to start
    await this.waitForOllama();
    
    this.isRunning = true;
    this.emit('started');
  }

  async waitForOllama(maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkOllamaRunning()) {
        console.log('✅ Ollama is running');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Ollama failed to start');
  }

  async stopOllama() {
    if (!this.isRunning || !this.ollamaProcess) {
      console.log('⚠️ Ollama is not running');
      return;
    }
    
    console.log('🛑 Stopping Ollama server...');
    
    // Try graceful shutdown first
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${this.ollamaProcess.pid} /T /F`);
      } else {
        this.ollamaProcess.kill('SIGTERM');
      }
      
      // Wait for process to exit
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.isRunning && this.ollamaProcess) {
            this.ollamaProcess.kill('SIGKILL');
          }
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    } catch (error) {
      console.error('Error stopping Ollama:', error);
    }
  }

  async listModels() {
    if (!await this.checkOllamaRunning()) {
      throw new Error('Ollama is not running');
    }
    
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags');
      const data = await response.json();
      
      // Update cache
      this.modelCache.clear();
      data.models?.forEach(model => {
        this.modelCache.set(model.name, model);
      });
      
      return data.models || [];
    } catch (error) {
      console.error('Failed to list models:', error);
      throw error;
    }
  }

  async pullModel(modelName, onProgress) {
    if (!await this.checkOllamaRunning()) {
      throw new Error('Ollama is not running');
    }
    
    console.log(`📥 Pulling model: ${modelName}`);
    
    const response = await fetch('http://127.0.0.1:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.status) {
              console.log(`Model pull status: ${data.status}`);
              
              if (onProgress) {
                onProgress({
                  status: data.status,
                  digest: data.digest,
                  total: data.total,
                  completed: data.completed,
                  percent: data.total ? (data.completed / data.total) * 100 : 0
                });
              }
            }
            
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              console.warn('Failed to parse JSON:', line);
            } else {
              throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    console.log(`✅ Model ${modelName} pulled successfully`);
    
    // Refresh model list
    await this.listModels();
  }

  async deleteModel(modelName) {
    if (!await this.checkOllamaRunning()) {
      throw new Error('Ollama is not running');
    }
    
    console.log(`🗑️ Deleting model: ${modelName}`);
    
    const response = await fetch('http://127.0.0.1:11434/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete model: ${error}`);
    }
    
    console.log(`✅ Model ${modelName} deleted successfully`);
    
    // Refresh model list
    await this.listModels();
  }

  async getModelInfo(modelName) {
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName);
    }
    
    const models = await this.listModels();
    return models.find(m => m.name === modelName);
  }

  // Event handling
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  // Cleanup
  async cleanup() {
    if (this.isRunning) {
      await this.stopOllama();
    }
  }
}

module.exports = new OllamaManager();