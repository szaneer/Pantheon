import React, { useState, useEffect } from 'react';
import { Brain, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';

interface MacOSModel {
  id: string;
  name: string;
  type: string;
  description: string;
  framework: string;
  capabilities: string[];
  available?: boolean;
  note?: string;
}

interface SystemInfo {
  platform: string;
  frameworks: string[];
  capabilities: {
    textAnalysis: boolean;
    imageAnalysis: boolean;
    speechRecognition: boolean;
    coreML: boolean;
    createML: boolean;
  };
  notes: string[];
}

export const MacOSModels: React.FC = () => {
  const [models, setModels] = useState<MacOSModel[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    loadMacOSModels();
  }, []);

  const loadMacOSModels = async () => {
    try {
      setLoading(true);
      
      // Check if we're in Electron
      if (!window.electronAPI?.getMacOSModels) {
        console.log('Not in Electron environment or macOS models not available');
        return;
      }

      const result = await window.electronAPI.getMacOSModels();
      if (result.success) {
        setModels(result.models);
        setSystemInfo(result.systemInfo);
      }
    } catch (error) {
      console.error('Failed to load macOS models:', error);
    } finally {
      setLoading(false);
    }
  };

  const testNaturalLanguage = async () => {
    try {
      const testText = "Apple's new Foundation Models bring powerful AI capabilities to macOS and iOS devices.";
      const result = await window.electronAPI.testMacOSML({
        type: 'sentiment',
        text: testText
      });
      
      if (result.success) {
        setTestResult(`Sentiment analysis result: ${JSON.stringify(result.data, null, 2)}`);
      } else {
        setTestResult(`Error: ${result.error}`);
      }
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2 text-gray-400">Checking macOS ML capabilities...</p>
      </div>
    );
  }

  if (!systemInfo || models.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-400">macOS ML frameworks not available on this system</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-semibold text-white">macOS Machine Learning Models</h2>
      </div>

      {/* System Info */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Info className="w-4 h-4" />
          System Information
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Available Frameworks:</span>
            <div className="flex gap-2">
              {systemInfo.frameworks.map(fw => (
                <span key={fw} className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded">
                  {fw}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="flex items-center gap-2">
              {systemInfo.capabilities.textAnalysis ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">Text Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              {systemInfo.capabilities.imageAnalysis ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">Image Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              {systemInfo.capabilities.speechRecognition ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">Speech Recognition</span>
            </div>
            <div className="flex items-center gap-2">
              {systemInfo.capabilities.coreML ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">Core ML</span>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">Important Notes</h3>
        <ul className="space-y-1">
          {systemInfo.notes.map((note, idx) => (
            <li key={idx} className="text-xs text-blue-300 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Available Models */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Available Capabilities</h3>
        <div className="grid gap-3">
          {models.map(model => (
            <div key={model.id} className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-white">{model.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                </div>
                <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                  {model.framework}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {model.capabilities.map(cap => (
                  <span key={cap} className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
              
              {model.note && (
                <p className="text-xs text-yellow-500 italic">{model.note}</p>
              )}
              
              <div className="flex items-center gap-2">
                {model.available ? (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Available Now
                  </span>
                ) : (
                  <span className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Requires Setup
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Natural Language */}
      {systemInfo.capabilities.textAnalysis && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Test Natural Language Processing</h3>
          <button
            onClick={testNaturalLanguage}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Test Sentiment Analysis
          </button>
          {testResult && (
            <pre className="bg-gray-800 p-3 rounded text-xs text-gray-300 overflow-auto">
              {testResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};