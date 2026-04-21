import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './components/ui/ThemeProvider';
import ChatInterface from './components/Chat/ChatInterface';
import JournalInterface from './components/Journal/JournalInterface';
import PluginInterface from './components/Plugins/PluginInterface';
import SettingsInterface from './components/Settings/SettingsInterface';
import CompanionInterface from './components/Companion/CompanionInterface';
import IDEWorkspace from './components/IDE/IDEWorkspace';
import EmulatorPanel from './components/Emulator/EmulatorPanel';
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<CompanionInterface />} />
                <Route path="companion" element={<CompanionInterface />} />
                <Route path="chat" element={<ChatInterface />} />
                <Route path="ide" element={<IDEWorkspace />} />
                <Route path="emulator" element={<EmulatorPanel />} />
                <Route path="journal" element={<JournalInterface />} />
                <Route path="plugins" element={<PluginInterface />} />
                <Route path="settings" element={<SettingsInterface />} />
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
  );
};

export default App; 