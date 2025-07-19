import React, { useState, useEffect } from 'react';

const Loading: React.FC = () => {
  const [showReloadButton, setShowReloadButton] = useState(false);

  useEffect(() => {
    // Show reload button after 10 seconds of loading
    const timer = setTimeout(() => {
      setShowReloadButton(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Loading Pantheon...</p>
        {showReloadButton && (
          <div className="mt-6">
            <p className="text-gray-400 text-sm mb-4">Taking longer than expected?</p>
            <button
              onClick={handleReload}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Reload App
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loading; 