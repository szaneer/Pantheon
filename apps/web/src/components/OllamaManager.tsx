import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Download, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Server,
  HardDrive,
  Globe
} from 'lucide-react';

interface Model {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface PopularModel {
  name: string;
  description: string;
  size: string;
  tags: string[];
}

const popularModels: PopularModel[] = [
  { 
    name: "llama3.2", 
    description: "Latest Llama model, great for general tasks", 
    size: "2.0GB",
    tags: ["general", "fast", "recommended"]
  },
  { 
    name: "llama3.2:1b", 
    description: "Smaller Llama variant, faster responses", 
    size: "1.3GB",
    tags: ["fast", "lightweight"]
  },
  { 
    name: "mistral", 
    description: "Fast and efficient model", 
    size: "4.1GB",
    tags: ["efficient", "multilingual"]
  },
  { 
    name: "phi3", 
    description: "Microsoft's small but capable model", 
    size: "2.2GB",
    tags: ["small", "efficient"]
  },
  { 
    name: "gemma2:2b", 
    description: "Google's efficient model", 
    size: "1.6GB",
    tags: ["google", "lightweight"]
  },
  { 
    name: "codellama", 
    description: "Specialized for code generation", 
    size: "3.8GB",
    tags: ["code", "programming"]
  }
];

export const OllamaManager: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ [key: string]: number }>({});
  const [pullingModels, setPullingModels] = useState<Set<string>>(new Set());
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [checkingOllama, setCheckingOllama] = useState(true);

  // Check if we can connect to a local Ollama instance (for web, this would need CORS)
  const checkOllamaAvailability = async () => {
    try {
      // Note: This assumes Ollama is running with CORS enabled
      // Users would need to run: OLLAMA_ORIGINS=* ollama serve
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setOllamaAvailable(true);
        const data = await response.json();
        setModels(data.models || []);
      } else {
        setOllamaAvailable(false);
      }
    } catch (err) {
      setOllamaAvailable(false);
    } finally {
      setCheckingOllama(false);
    }
  };

  useEffect(() => {
    checkOllamaAvailability();
    // Poll for updates if expanded
    const interval = isExpanded ? setInterval(checkOllamaAvailability, 5000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExpanded]);

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const pullModel = async (modelName: string) => {
    if (pullingModels.has(modelName)) return;
    
    setPullingModels(prev => new Set(prev).add(modelName));
    setPullProgress(prev => ({ ...prev, [modelName]: 0 }));
    setError(null);

    try {
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.total && data.completed) {
              const progress = (data.completed / data.total) * 100;
              setPullProgress(prev => ({ ...prev, [modelName]: progress }));
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      // Refresh models list
      await checkOllamaAvailability();
    } catch (err) {
      console.error('Pull error:', err);
      setError(`Failed to pull ${modelName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPullingModels(prev => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
      setPullProgress(prev => {
        const next = { ...prev };
        delete next[modelName];
        return next;
      });
    }
  };

  const deleteModel = async (modelName: string) => {
    if (deletingModels.has(modelName)) return;
    
    setDeletingModels(prev => new Set(prev).add(modelName));
    setError(null);

    try {
      const response = await fetch('http://localhost:11434/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`);
      }

      // Refresh models list
      await checkOllamaAvailability();
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete ${modelName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingModels(prev => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    }
  };

  if (checkingOllama) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm text-gray-400">Checking Ollama availability...</span>
        </div>
      </div>
    );
  }

  if (!ollamaAvailable) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-500 mb-3">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-semibold">Ollama Not Available</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          To use local models, you need to:
        </p>
        <ol className="text-sm text-gray-400 space-y-2 ml-4">
          <li>1. Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ollama.ai</a></li>
          <li>2. Run Ollama with CORS enabled:
            <code className="block mt-1 bg-gray-900 px-2 py-1 rounded text-xs">
              OLLAMA_ORIGINS=* ollama serve
            </code>
          </li>
          <li>3. Refresh this page</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg">
      <div
        className="p-4 cursor-pointer hover:bg-gray-700 transition-colors flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold">Local Models (Ollama)</h3>
          <span className="text-sm text-gray-400">
            {models.length} model{models.length !== 1 ? 's' : ''} installed
          </span>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Installed Models */}
          {models.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Installed Models</h4>
              <div className="space-y-2">
                {models.map((model) => (
                  <div key={model.digest} className="bg-gray-900 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-gray-500">
                            {formatSize(model.size)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Modified: {formatDate(model.modified_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteModel(model.name);
                        }}
                        disabled={deletingModels.has(model.name)}
                        className="p-2 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                      >
                        {deletingModels.has(model.name) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Popular Models */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              {models.length > 0 ? 'Download More Models' : 'Popular Models'}
            </h4>
            <div className="space-y-2">
              {popularModels.map((model) => {
                const isInstalled = models.some(m => m.name === model.name);
                const isPulling = pullingModels.has(model.name);
                const progress = pullProgress[model.name] || 0;

                return (
                  <div key={model.name} className="bg-gray-900 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{model.name}</span>
                          {isInstalled && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{model.size}</span>
                          {model.tags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-800 px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!isInstalled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pullModel(model.name);
                          }}
                          disabled={isPulling}
                          className="p-2 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                        >
                          {isPulling ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 text-blue-500" />
                          )}
                        </button>
                      )}
                    </div>
                    {isPulling && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Downloading... {progress.toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-4">
            <p>Note: Ollama must be running with CORS enabled for web access.</p>
            <p>Run: <code className="bg-gray-900 px-1 rounded">OLLAMA_ORIGINS=* ollama serve</code></p>
          </div>
        </div>
      )}
    </div>
  );
};