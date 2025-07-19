import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import p2pClientServiceV2 from './services/p2pClientServiceV2';
import Login from './components/Login';
import WebChat from './components/WebChat';
import Settings from './components/Settings';
import Layout from './components/Layout';
import Loading from './components/Loading';
import ErrorBoundary from './components/ErrorBoundary';
import { DebugLogs } from './components/DebugLogs';


function AppContent() {
  const { user, loading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Add global error handlers for better reload recovery
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      // Don't prevent default behavior, let error boundary handle it
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Don't prevent default behavior
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setIsInitialized(true);
    }
  }, [loading]);

  // Initialize P2P service when app starts
  useEffect(() => {
    console.log('🌐 P2P client service ready (initialization happens on auth)');

    // Cleanup on unmount
    return () => {
      p2pClientServiceV2.disconnect();
    };
  }, []);

  if (!isInitialized || loading) {
    return <Loading />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<ErrorBoundary><WebChat /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
            <Route path="/debug" element={<ErrorBoundary><DebugLogs /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 