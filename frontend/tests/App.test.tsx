import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../src/App';

// Mock the necessary components to avoid routing issues in tests
jest.mock('../src/components/Companion/CompanionInterface', () => {
  return function MockCompanionInterface() {
    return <div data-testid="companion-interface">Companion Interface</div>;
  };
});

jest.mock('../src/components/Chat/ChatInterface', () => {
  return function MockChatInterface() {
    return <div data-testid="chat-interface">Chat Interface</div>;
  };
});

jest.mock('../src/components/Journal/JournalInterface', () => {
  return function MockJournalInterface() {
    return <div data-testid="journal-interface">Journal Interface</div>;
  };
});

jest.mock('../src/components/Plugins/PluginInterface', () => {
  return function MockPluginInterface() {
    return <div data-testid="plugin-interface">Plugin Interface</div>;
  };
});

jest.mock('../src/components/Settings/SettingsInterface', () => {
  return function MockSettingsInterface() {
    return <div data-testid="settings-interface">Settings Interface</div>;
  };
});

describe('App', () => {
  it('renders the application title in the sidebar', () => {
    render(<App />);
    // The actual text in Layout.tsx is "Lackadaisical AI"
    expect(screen.getByText(/Lackadaisical AI/i)).toBeInTheDocument();
  });

  it('renders the Your AI Companion subtitle', () => {
    render(<App />);
    expect(screen.getByText(/Your AI Companion/i)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Journal')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows AI connection status', () => {
    render(<App />);
    // Initial state shows "Disconnected" until health check completes
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
