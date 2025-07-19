import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Server, Key, ChevronRight } from 'lucide-react';

const Login: React.FC = () => {
  const [signalingServerUrl, setSignalingServerUrl] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Server URL, 2: Auth Key
  const { signIn } = useAuth();

  useEffect(() => {
    // Load saved signaling server URL if exists
    const loadSavedUrl = async () => {
      const savedUrl = await window.electronAPI?.getStoreValue('signalingServerUrl');
      if (savedUrl) {
        setSignalingServerUrl(savedUrl);
      }
    };
    loadSavedUrl();
  }, []);

  const handleServerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signalingServerUrl) {
      setError('Please enter a signaling server URL');
      return;
    }

    // Save the signaling server URL
    await window.electronAPI?.setStoreValue('signalingServerUrl', signalingServerUrl);
    // Update the environment for the current session
    process.env.VITE_SIGNALING_SERVER_URL = signalingServerUrl;
    
    setStep(2);
    setError('');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(authKey || undefined);
    } catch (error: any) {
      setError(error.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAuth = async () => {
    setError('');
    setLoading(true);

    try {
      await signIn(); // No auth key
    } catch (error: any) {
      setError(error.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-600">
              <Server className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Configure Signaling Server
            </h2>
            <p className="mt-2 text-center text-sm text-gray-400">
              Enter the URL of your Pantheon signaling server
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleServerSubmit}>
            <div>
              <input
                type="url"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="https://your-server.com or http://localhost:3001"
                value={signalingServerUrl}
                onChange={(e) => setSignalingServerUrl(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-500">
                Default: http://localhost:3001
              </p>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-600">
            <Key className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Authentication (Optional)
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your authentication key or continue without one
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuthSubmit}>
          <div>
            <input
              type="text"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Authentication Key (optional)"
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex-1 flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect with Key'}
            </button>
            
            <button
              type="button"
              onClick={handleSkipAuth}
              disabled={loading}
              className="group relative flex-1 flex justify-center py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Continue Without Key'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Change Signaling Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;