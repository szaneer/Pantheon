import React, { useState, useEffect } from 'react';
import { Cpu, Info, CheckCircle, XCircle } from 'lucide-react';

interface AppleModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  metadata: {
    name: string;
    description: string;
    type: string;
    capabilities: string[];
    maxTokens?: number;
  };
}

interface SystemRequirements {
  os: string;
  chip: string;
  memory: string;
  storage: string;
  framework: string;
  appleIntelligence?: string;
}

export const AppleModelsSection: React.FC = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<AppleModel[]>([]);
  const [requirements, setRequirements] = useState<SystemRequirements | null>(null);
  const [error, setError] = useState<string>('');
  const [unsupportedReason, setUnsupportedReason] = useState<string>('');

  useEffect(() => {
    checkAppleModelsSupport();
  }, []);

  const checkAppleModelsSupport = async () => {
    if (!window.electronAPI?.appleModels) {
      setLoading(false);
      return;
    }

    try {
      const supported = await window.electronAPI.appleModels.isSupported();
      setIsSupported(supported);
      
      // Always get requirements to show what's needed
      const reqs = await window.electronAPI.appleModels.getSystemRequirements();
      setRequirements(reqs);

      if (supported) {
        // Try to initialize and get models
        const initResult = await window.electronAPI.appleModels.initialize();
        if (initResult.success) {
          setIsInitialized(true);
          const modelsResult = await window.electronAPI.appleModels.getModels();
          if (modelsResult.success) {
            setModels(modelsResult.models);
          } else {
            setError(modelsResult.error || 'Failed to get models');
            if (modelsResult.unsupportedReason) {
              setUnsupportedReason(modelsResult.unsupportedReason);
            }
          }
        } else {
          setError(initResult.error || 'Failed to initialize Apple Foundation Models');
        }
      } else {
        // Get the models result to get the unsupported reason
        const modelsResult = await window.electronAPI.appleModels.getModels();
        if (modelsResult.unsupportedReason) {
          setUnsupportedReason(modelsResult.unsupportedReason);
        }
      }
    } catch (err) {
      console.error('Failed to check Apple models support:', err);
      setError('Failed to check Apple Foundation Models support');
    } finally {
      setLoading(false);
    }
  };

  if (!window.electronAPI?.appleModels || loading) {
    return null;
  }

  if (!isSupported) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Cpu className="w-5 h-5 mr-2" />
          Apple Foundation Models (Apple Intelligence)
        </h3>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-gray-300">
                {unsupportedReason || 'Apple Foundation Models are not available on this system.'}
              </p>
              {requirements && (
                <div className="mt-3 text-sm text-gray-400">
                  <p className="font-medium mb-2">Requirements:</p>
                  <ul className="space-y-1">
                    <li>• {requirements.os}</li>
                    <li>• {requirements.chip}</li>
                    <li>• {requirements.memory}</li>
                    {requirements.appleIntelligence && (
                      <li>• {requirements.appleIntelligence}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Cpu className="w-5 h-5 mr-2" />
        Apple Foundation Models (Apple Intelligence)
      </h3>

      {/* Status Banner */}
      <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">Coming Soon</p>
            <p className="text-blue-200/80">
              Apple Intelligence APIs are not yet publicly available. This section is prepared for when Apple releases
              their Foundation Models API. The implementation is ready to integrate once the APIs become available.
            </p>
            <p className="text-blue-200/60 mt-2">
              In the meantime, check out the "macOS Machine Learning Models" section below for currently available ML capabilities.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-900 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300">Status</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-400">Available</span>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              On-device AI models powered by Apple Silicon for private, fast inference.
            </p>
          </div>

          {models.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Available Models</h4>
              {models.map((model) => (
                <div key={model.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="text-white font-medium">{model.metadata.name}</h5>
                      <p className="text-sm text-gray-400 mt-1">{model.metadata.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {model.metadata.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 ml-3">
                      {model.metadata.type}
                    </span>
                  </div>
                  {model.metadata.maxTokens && (
                    <div className="mt-2 text-xs text-gray-500">
                      Max tokens: {model.metadata.maxTokens.toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {requirements && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <button
                className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                onClick={() => {
                  const elem = document.getElementById('apple-models-requirements');
                  if (elem) {
                    elem.classList.toggle('hidden');
                  }
                }}
              >
                <Info className="w-4 h-4" />
                <span>System Requirements</span>
              </button>
              <div id="apple-models-requirements" className="hidden mt-3 text-sm text-gray-400">
                <ul className="space-y-1">
                  <li>• Operating System: {requirements.os}</li>
                  <li>• Processor: {requirements.chip}</li>
                  <li>• Memory: {requirements.memory}</li>
                  <li>• Storage: {requirements.storage}</li>
                  <li>• Framework: {requirements.framework}</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};