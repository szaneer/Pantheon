import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Download, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  Terminal,
  Sparkles,
  Shield,
  Zap,
  Users,
  Info,
  ExternalLink
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to Pantheon',
    description: 'Your personal AI assistant that runs on your device',
    icon: <Sparkles className="w-8 h-8 text-blue-500" />
  },
  {
    id: 'models',
    title: 'AI Models (Optional)',
    description: 'Choose and download AI models to run locally',
    icon: <Cpu className="w-8 h-8 text-purple-500" />
  },
  {
    id: 'hosting',
    title: 'Enable Model Hosting',
    description: 'Share your AI models with your other devices',
    icon: <Users className="w-8 h-8 text-green-500" />
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'You\'re ready to start using Pantheon',
    icon: <CheckCircle className="w-8 h-8 text-green-500" />
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'installed' | 'not-installed'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [appleModels, setAppleModels] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // Check for available models
  useEffect(() => {
    const checkModels = async () => {
      try {
        // Check Ollama status
        const isInstalled = await window.electronAPI.ollama.checkInstallation();
        setOllamaStatus(isInstalled ? 'installed' : 'not-installed');
        
        if (isInstalled) {
          const modelList = await window.electronAPI.ollama.listModels();
          // Handle both array of strings and array of objects
          if (modelList && modelList.length > 0) {
            if (typeof modelList[0] === 'string') {
              setModels(modelList);
            } else {
              // Extract just the names for the OnboardingWizard
              setModels(modelList.map((m: any) => m.name));
            }
          } else {
            setModels([]);
          }
        }

        // Check for Apple Foundation models
        const localModels = await window.electronAPI.llm.listLocalModels();
        const appleFoundationModels = localModels.filter(model => 
          model.provider === 'Apple Foundation' || 
          model.owned_by === 'apple' || 
          model.id.includes('apple') ||
          model.id.includes('com.apple.foundation')
        );
        setAppleModels(appleFoundationModels);
      } catch (error) {
        console.error('Failed to check models:', error);
        setOllamaStatus('not-installed');
      }
    };

    if (currentStep === 1) {
      checkModels();
      
      // Set up periodic checking for Ollama installation
      const interval = setInterval(checkModels, 2000);
      setCheckInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [currentStep]);

  // Clean up interval when moving away from step
  useEffect(() => {
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        setCheckInterval(null);
      }
    };
  }, [checkInterval]);

  const handleInstallOllama = async () => {
    try {
      await window.electronAPI.ollama.openDownloadPage();
    } catch (error) {
      console.error('Failed to open Ollama download page:', error);
    }
  };

  const handleDownloadModel = async (modelName: string) => {
    setIsDownloading(true);
    setSelectedModel(modelName);
    setDownloadProgress(0);

    try {
      // Start the download
      await window.electronAPI.ollama.pullModel(modelName);
      
      // Simulate progress (in real app, you'd get actual progress events)
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // Wait for completion
      setTimeout(async () => {
        clearInterval(progressInterval);
        setDownloadProgress(100);
        setIsDownloading(false);
        
        // Refresh model list
        const modelList = await window.electronAPI.ollama.listModels();
        // Handle both array of strings and array of objects
        if (modelList && modelList.length > 0) {
          if (typeof modelList[0] === 'string') {
            setModels(modelList);
          } else {
            // Extract just the names for the OnboardingWizard
            setModels(modelList.map((m: any) => m.name));
          }
        } else {
          setModels([]);
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to download model:', error);
      setIsDownloading(false);
    }
  };

  const handleEnableHosting = async () => {
    try {
      // Enable hosting in the P2P service
      await window.electronAPI.p2p.enableHosting();
      
      // Set to start on app launch
      await window.electronAPI.setStoreValue('modelHostingEnabled', true);
      await window.electronAPI.setStoreValue('autoStartHosting', true);
      
      setHostingEnabled(true);
      
      console.log('Model hosting enabled successfully');
    } catch (error) {
      console.error('Failed to enable model hosting:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-8">
              <div className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                <Sparkles className="w-16 h-16 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900">Welcome to Pantheon!</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Your personal AI assistant that runs entirely on your device. 
              No cloud, no subscriptions, just pure AI power at your fingertips.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="p-6 bg-blue-50 rounded-lg">
                <Shield className="w-10 h-10 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">100% Private</h3>
                <p className="text-sm text-gray-600">
                  Your data never leaves your device. Complete privacy guaranteed.
                </p>
              </div>
              
              <div className="p-6 bg-purple-50 rounded-lg">
                <Zap className="w-10 h-10 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                <p className="text-sm text-gray-600">
                  Run AI models locally for instant responses without internet delays.
                </p>
              </div>
              
              <div className="p-6 bg-green-50 rounded-lg">
                <Users className="w-10 h-10 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Share Across Devices</h3>
                <p className="text-sm text-gray-600">
                  Access your AI from any of your devices seamlessly.
                </p>
              </div>
            </div>
          </div>
        );

      case 1: // Models Setup
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Cpu className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">AI Models Available</h2>
              <p className="text-gray-600">
                Choose which AI models to use with Pantheon
              </p>
            </div>

            {/* Apple Foundation Models */}
            {appleModels.length > 0 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <div className="p-2 bg-white rounded-lg shadow-sm mr-4">
                      <Sparkles className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">Apple Intelligence Models</h3>
                      <p className="text-gray-700 mb-4">
                        Your Mac includes built-in AI models that work instantly without any downloads.
                      </p>
                      <div className="space-y-2">
                        {appleModels.map((model) => (
                          <div key={model.id} className="flex items-center justify-between bg-white rounded-md p-3">
                            <div>
                              <h4 className="font-medium text-gray-900">{model.name}</h4>
                              <p className="text-sm text-gray-600">{model.metadata?.description || 'On-device AI model'}</p>
                            </div>
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-5 h-5 mr-2" />
                              <span className="text-sm font-medium">Ready</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ollama Models */}
            <div className="space-y-4">
              <div className={`border rounded-lg p-6 ${
                ollamaStatus === 'checking' ? 'border-gray-200 bg-gray-50' :
                ollamaStatus === 'installed' ? 'border-green-200 bg-green-50' :
                'border-yellow-200 bg-yellow-50'
              }`}>
                <div className="flex items-start">
                  <div className="p-2 bg-white rounded-lg shadow-sm mr-4">
                    <Terminal className="w-6 h-6 text-gray-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Ollama Models {ollamaStatus === 'checking' && '(Checking...)'}
                    </h3>
                    
                    {ollamaStatus === 'checking' && (
                      <div className="flex items-center">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                        <span className="text-gray-600">Checking for Ollama installation...</span>
                      </div>
                    )}

                    {ollamaStatus === 'not-installed' && (
                      <>
                        <p className="text-gray-700 mb-4">
                          Ollama lets you download and run additional AI models locally. 
                          It's optional but recommended for more model choices.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleInstallOllama}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Ollama
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </button>
                          <span className="text-sm text-gray-600">
                            Installation will be detected automatically
                          </span>
                        </div>
                      </>
                    )}

                    {ollamaStatus === 'installed' && (
                      <div className="space-y-4">
                        <div className="flex items-center text-green-700">
                          <CheckCircle className="w-5 h-5 mr-2" />
                          <span className="font-medium">Ollama is installed!</span>
                        </div>

                        {models.length > 0 ? (
                          <div>
                            <p className="text-sm text-gray-600 mb-3">Installed Ollama models:</p>
                            <div className="space-y-2">
                              {models.map((model) => (
                                <div key={model} className="flex items-center justify-between bg-white rounded-md p-3">
                                  <span className="font-medium text-gray-900">{model}</span>
                                  <div className="flex items-center text-green-600">
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Ready</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-700 mb-4">
                              No models installed yet. Here are some recommendations:
                            </p>
                            <div className="space-y-3">
                              {['llama3.2', 'mistral', 'phi3'].map((model) => {
                                const isCurrentlyDownloading = isDownloading && selectedModel === model;
                                
                                return (
                                  <div key={model} className="bg-white rounded-md p-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="font-medium text-gray-900">{model}</h4>
                                        <p className="text-sm text-gray-600">
                                          {model === 'llama3.2' && 'Best overall performance'}
                                          {model === 'mistral' && 'Fast and efficient'}
                                          {model === 'phi3' && 'Smallest size'}
                                        </p>
                                      </div>
                                      
                                      {isCurrentlyDownloading ? (
                                        <div className="flex items-center">
                                          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                                          <span className="text-sm text-gray-600">{downloadProgress}%</span>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleDownloadModel(model)}
                                          disabled={isDownloading}
                                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                          Download
                                        </button>
                                      )}
                                    </div>
                                    
                                    {isCurrentlyDownloading && (
                                      <div className="mt-3">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${downloadProgress}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> You can skip this step and add more models later from Settings. 
                {appleModels.length > 0 && ' Your Apple Intelligence models are ready to use!'}
              </p>
            </div>
          </div>
        );

      case 2: // Hosting Setup
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Users className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Enable Model Hosting</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Share your AI models with your other devices. Access Pantheon from your phone, 
                tablet, or another computer using the same AI models.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">How it works:</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Your computer becomes a personal AI server for your devices
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Other devices connect securely using your account
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  All communication is encrypted and private
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Works on your local network or over the internet
                </li>
              </ul>
            </div>

            {!hostingEnabled ? (
              <div className="text-center">
                <button
                  onClick={handleEnableHosting}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Enable Model Hosting
                </button>
                <p className="text-sm text-gray-600 mt-3">
                  You can change this setting anytime in preferences
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Model Hosting Enabled!</h3>
                    <p className="text-gray-700">
                      Your AI models are now available to your other devices.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Privacy Note:</strong> Your AI models and conversations never leave your devices. 
                Pantheon uses peer-to-peer technology to connect your devices directly.
              </p>
            </div>
          </div>
        );

      case 3: // Complete
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-8">
              <div className="p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full">
                <CheckCircle className="w-16 h-16 text-white" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900">You're All Set!</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Pantheon is ready to use. Start chatting with your AI assistant!
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 max-w-2xl mx-auto text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Tips:</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Ask anything - your AI runs locally and privately
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Access from other devices at your-web-app.com
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Download more models anytime from Settings
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Your computer needs to be on for other devices to connect
                </li>
              </ul>
            </div>
            
            <button
              onClick={onComplete}
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
            >
              Start Using Pantheon
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        // Can proceed if we have any models (Apple or Ollama) or if user wants to skip
        return true; // Always allow proceeding from models page
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${
                  index < steps.length - 1 ? 'flex-1' : ''
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    index <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-3 ${
                      index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            {steps.map((step) => (
              <span key={step.id}>{step.title}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between">
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 0}
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          
          {currentStep < steps.length - 1 && (
            <div className="flex items-center gap-3">
              {currentStep === 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors text-gray-600 hover:text-gray-800"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {currentStep === 1 && (models.length > 0 || appleModels.length > 0) ? 'Continue' : 'Next'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};