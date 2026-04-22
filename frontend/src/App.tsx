import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './components/ui/ThemeProvider';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ChatInterface from './components/Chat/ChatInterface';
import JournalInterface from './components/Journal/JournalInterface';
import PluginInterface from './components/Plugins/PluginInterface';
import SettingsInterface from './components/Settings/SettingsInterface';
import CompanionInterface from './components/Companion/CompanionInterface';
import IDEWorkspace from './components/IDE/IDEWorkspace';
import EmulatorPanel from './components/Emulator/EmulatorPanel';
import SessionsInterface from './components/Sessions/SessionsInterface';
import Layout from './components/Layout/Layout';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Router>
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<CompanionInterface />} />
                  <Route path="companion" element={<CompanionInterface />} />
                  <Route path="chat" element={<ErrorBoundary><ChatInterface /></ErrorBoundary>} />
                  <Route path="sessions" element={<ErrorBoundary><SessionsInterface /></ErrorBoundary>} />
                  <Route path="ide" element={<ErrorBoundary><IDEWorkspace /></ErrorBoundary>} />
                  <Route path="emulator" element={<ErrorBoundary><EmulatorPanel /></ErrorBoundary>} />
                  <Route path="journal" element={<ErrorBoundary><JournalInterface /></ErrorBoundary>} />
                  <Route path="plugins" element={<ErrorBoundary><PluginInterface /></ErrorBoundary>} />
                  <Route path="settings" element={<ErrorBoundary><SettingsInterface /></ErrorBoundary>} />
                </Route>
              </Routes>
            
            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--color-card)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                },
                success: {
                  iconTheme: {
                    primary: 'var(--color-success)',
                    secondary: 'white',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'var(--color-danger)',
                    secondary: 'white',
                  },
                },
              }}
            />
          </div>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App; 