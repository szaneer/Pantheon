import React, { useState, useEffect } from 'react';
import { Download, Play, Square, Trash2, RefreshCw, Server, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export const OllamaManager: React.FC = () => {
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'not-installed' | 'not-running' | 'running'>('checking');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // Popular models to suggest
  const popularModels = [
    { name: 'llama2', description: 'Meta\'s Llama 2 model', size: '3.8GB' },
    { name: 'mistral', description: 'Mistral 7B model', size: '4.1GB' },
    { name: 'codellama', description: 'Code-focused Llama model', size: '3.8GB' },
    { name: 'phi', description: 'Microsoft\'s Phi-2 model', size: '1.7GB' },
    { name: 'orca-mini', description: 'Smaller ORCA model', size: '1.9GB' },
    { name: 'vicuna', description: 'Fine-tuned LLaMA model', size: '3.8GB' }
  ];

  useEffect(() => {
    checkOllamaStatus();
    setupProgressListeners();

    return () => {
      window.electronAPI?.ollama.removeDownloadProgress();
      window.electronAPI?.ollama.removePullProgress();
    };
  }, []);

  const setupProgressListeners = () => {
    window.electronAPI?.ollama.onDownloadProgress((event: any, progress: number) => {
      setDownloadProgress(progress);
    });

    window.electronAPI?.ollama.onPullProgress((event: any, data: any) => {
      setPullProgress(prev => ({
        ...prev,
        [data.modelName]: data
      }));
    });
  };

  const checkOllamaStatus = async () => {
    try {
      const initResult = await window.electronAPI?.ollama.initialize();
      
      if (!initResult.success) {
        setOllamaStatus('not-installed');
        return;
      }

      if (initResult.installed) {
        if (initResult.running) {
          setOllamaStatus('running');
          await loadModels();
        } else {
          setOllamaStatus('not-running');
        }
      } else {
        setOllamaStatus('not-installed');
      }
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      setOllamaStatus('not-installed');
    }
  };

  const downloadOllama = async () => {
    setLoading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      const result = await window.electronAPI?.ollama.download();
      
      if (result.success) {
        setOllamaStatus('not-running');
        setDownloadProgress(100);
      } else {
        setError(result.error || 'Failed to download Ollama');
      }
    } catch (error) {
      setError('Failed to download Ollama');
      console.error('Download error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startOllama = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI?.ollama.start();
      
      if (result.success) {
        setOllamaStatus('running');
        // Wait a bit for Ollama to fully start
        setTimeout(() => loadModels(), 2000);
      } else {
        setError(result.error || 'Failed to start Ollama');
      }
    } catch (error) {
      setError('Failed to start Ollama');
      console.error('Start error:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopOllama = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI?.ollama.stop();
      
      if (result.success) {
        setOllamaStatus('not-running');
        setModels([]);
      } else {
        setError(result.error || 'Failed to stop Ollama');
      }
    } catch (error) {
      setError('Failed to stop Ollama');
      console.error('Stop error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const modelData = await window.electronAPI?.ollama.listModels();
      
      // Handle both array of strings (old format) and array of objects (new format)
      if (modelData && modelData.length > 0) {
        if (typeof modelData[0] === 'string') {
          // Old format - convert to objects
          const modelObjects = modelData.map((name: string) => ({
            name,
            size: 0,
            digest: '',
            modified_at: new Date().toISOString()
          }));
          setModels(modelObjects);
        } else {
          // New format - use directly
          setModels(modelData);
        }
      } else {
        setModels([]);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const pullModel = async (modelName: string) => {
    setPullingModel(modelName);
    setError(null);

    try {
      const result = await window.electronAPI?.ollama.pullModel(modelName);
      
      if (result.success) {
        await loadModels();
      } else {
        setError(result.error || `Failed to pull model ${modelName}`);
      }
    } catch (error) {
      setError(`Failed to pull model ${modelName}`);
      console.error('Pull error:', error);
    } finally {
      setPullingModel(null);
      setPullProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelName];
        return newProgress;
      });
    }
  };

  const deleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) {
      return;
    }

    setError(null);

    try {
      const result = await window.electronAPI?.ollama.deleteModel(modelName);
      
      if (result.success) {
        await loadModels();
      } else {
        setError(result.error || `Failed to delete model ${modelName}`);
      }
    } catch (error) {
      setError(`Failed to delete model ${modelName}`);
      console.error('Delete error:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (ollamaStatus) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'not-running':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'not-installed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader className="w-5 h-5 text-gray-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (ollamaStatus) {
      case 'running':
        return 'Ollama is running';
      case 'not-running':
        return 'Ollama is installed but not running';
      case 'not-installed':
        return 'Ollama is not installed';
      default:
        return 'Checking Ollama status...';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Server className="w-6 h-6 mr-2" />
        Ollama Management
      </h2>

      {/* Status Section */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-gray-300">{getStatusText()}</span>
          </div>
          
          <div className="flex space-x-2">
            {ollamaStatus === 'not-installed' && (
              <div className="flex flex-col space-y-2">
                <p className="text-sm text-gray-400">
                  Ollama needs to be installed to manage models locally.
                </p>
                <a
                  href="https://ollama.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-fit"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download from Ollama.ai
                </a>
                <button
                  onClick={checkOllamaStatus}
                  className="text-sm text-gray-400 hover:text-gray-300"
                >
                  Click here after installing to refresh
                </button>
              </div>
            )}
            
            {ollamaStatus === 'not-running' && (
              <button
                onClick={startOllama}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4 mr-2" />
                {loading ? 'Starting...' : 'Start Ollama'}
              </button>
            )}
            
            {ollamaStatus === 'running' && (
              <>
                <button
                  onClick={loadModels}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
                <button
                  onClick={stopOllama}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {loading ? 'Stopping...' : 'Stop Ollama'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Download Progress */}
        {downloadProgress > 0 && downloadProgress < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Downloading Ollama...</span>
              <span>{Math.round(downloadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Models Section */}
      {ollamaStatus === 'running' && (
        <>
          {/* Installed Models */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Installed Models</h3>
            
            {models.length === 0 ? (
              <p className="text-gray-400">No models installed. Pull a model to get started.</p>
            ) : (
              <div className="space-y-2">
                {models.map((model) => (
                  <div key={model.name} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">{model.name}</h4>
                      <p className="text-sm text-gray-400">
                        Size: {model.size ? formatBytes(model.size) : 'Unknown'} 
                        {model.modified_at && (
                          <>
                            {' • '}
                            Modified: {new Date(model.modified_at).toLocaleDateString() !== 'Invalid Date' 
                              ? new Date(model.modified_at).toLocaleDateString() 
                              : 'Unknown'}
                          </>
                        )}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => deleteModel(model.name)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Models */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Available Models</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {popularModels.map((model) => {
                const isInstalled = models.some(m => m.name === model.name);
                const isPulling = pullingModel === model.name;
                const progress = pullProgress[model.name];
                
                return (
                  <div key={model.name} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium">{model.name}</h4>
                        <p className="text-sm text-gray-400">{model.description}</p>
                        <p className="text-xs text-gray-500">Size: {model.size}</p>
                      </div>
                      
                      {!isInstalled && (
                        <button
                          onClick={() => pullModel(model.name)}
                          disabled={isPulling || pullingModel !== null}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isPulling ? 'Pulling...' : 'Pull'}
                        </button>
                      )}
                      
                      {isInstalled && (
                        <span className="text-green-400 text-sm">Installed</span>
                      )}
                    </div>
                    
                    {/* Pull Progress */}
                    {progress && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{progress.status}</span>
                          <span>{Math.round(progress.percent || 0)}%</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percent || 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-900 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
};