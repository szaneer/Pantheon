import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { P2PConnectionProvider } from './contexts/P2PConnectionContext';
import Login from './components/Login';
import Chat from './components/Chat';
import Settings from './components/Settings';
import Layout from './components/Layout';
import Loading from './components/Loading';
import ErrorBoundary from './components/ErrorBoundary';
import { DebugLogs } from './components/DebugLogs';
import { OnboardingWizard } from './components/OnboardingWizard';


function AppContent() {
  const { user, loading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Handle navigation from tray menu
    const handleNavigateTo = (_event: any, path: string) => {
      window.location.href = path;
    };

    window.electronAPI?.onNavigateTo(handleNavigateTo);

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
      window.electronAPI?.removeNavigateTo();
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setIsInitialized(true);
      // Check if user has completed onboarding
      const completed = localStorage.getItem(`onboarding_completed_${user?.uid}`);
      setHasCompletedOnboarding(!!completed);
    }
  }, [loading, user]);

  if (!isInitialized || loading) {
    return <Loading />;
  }

  if (!user) {
    return <Login />;
  }

  if (!hasCompletedOnboarding) {
    return (
      <OnboardingWizard 
        onComplete={() => {
          localStorage.setItem(`onboarding_completed_${user.uid}`, 'true');
          setHasCompletedOnboarding(true);
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Chat userId={user.uid} /></ErrorBoundary>} />
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
      <P2PConnectionProvider>
        <AppContent />
      </P2PConnectionProvider>
    </AuthProvider>
  );
}

export default App; 