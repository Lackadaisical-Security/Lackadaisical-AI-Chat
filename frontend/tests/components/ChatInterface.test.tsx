import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mock store state
const createMockStore = (overrides = {}) => ({
  currentSession: { id: 'test-session', name: 'Test Session', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0, totalTokens: 0 },
  messages: [],
  sessions: [],
  isStreaming: false,
  setCurrentSession: jest.fn(),
  addMessage: jest.fn(),
  setIsStreaming: jest.fn(),
  sidebarOpen: false,
  setSidebarOpen: jest.fn(),
  updateAssistantMessage: jest.fn(),
  loadSessionMessages: jest.fn(),
  contextWindow: null,
  contextLoading: false,
  contextError: null,
  memoryStats: null,
  memoryStatsLoading: false,
  addSession: jest.fn(),
  deleteSession: jest.fn(),
  updateSession: jest.fn(),
  fetchContext: jest.fn(),
  clearContext: jest.fn(),
  fetchMemoryStats: jest.fn(),
  clearMemoryStats: jest.fn(),
  ...overrides,
});

let mockStoreState = createMockStore();

// Mock the store
jest.mock('../../src/store', () => ({
  useAppStore: jest.fn(() => mockStoreState),
}));

// Mock the API service
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    streamMessage: jest.fn().mockResolvedValue({ data: { content: 'Mock response' } }),
    createSession: jest.fn().mockResolvedValue({ data: { id: 'new-session', name: 'New Chat' } }),
    getSessions: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock the streaming response hook
jest.mock('../../src/hooks/useStreamingResponse', () => ({
  __esModule: true,
  default: () => ({
    isStreaming: false,
    streamContent: '',
    stopStreaming: jest.fn(),
    cleanup: jest.fn(),
  }),
}));

// Import the component after mocks are set up
import ChatInterface from '../../src/components/Chat/ChatInterface';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      {component}
    </MemoryRouter>
  );
};

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = createMockStore();
  });

  it('renders welcome message when no messages', () => {
    renderWithRouter(<ChatInterface />);
    expect(screen.getByText('Welcome to Lackadaisical AI Chat')).toBeInTheDocument();
  });

  it('renders the chat input placeholder', () => {
    renderWithRouter(<ChatInterface />);
    // The placeholder includes feature hints
    expect(screen.getByPlaceholderText(/Type your message/)).toBeInTheDocument();
  });

  it('renders the New Chat button', () => {
    renderWithRouter(<ChatInterface />);
    // There might be multiple "New Chat" elements, we just need to verify at least one exists
    const newChatElements = screen.getAllByText('New Chat');
    expect(newChatElements.length).toBeGreaterThan(0);
  });

  it('renders session name in header', () => {
    renderWithRouter(<ChatInterface />);
    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('shows message count', () => {
    renderWithRouter(<ChatInterface />);
    // The new format shows "0 messages • Model Name"
    expect(screen.getByText(/0 messages/)).toBeInTheDocument();
  });

  it('allows typing in the input field', () => {
    renderWithRouter(<ChatInterface />);
    const input = screen.getByPlaceholderText(/Type your message/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Test message' } });
    expect(input.value).toBe('Test message');
  });

  it('renders messages when they exist', () => {
    mockStoreState = createMockStore({
      messages: [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { id: '2', role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
      ],
    });

    renderWithRouter(<ChatInterface />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('displays "New Chat" when no session name is available', () => {
    mockStoreState = createMockStore({
      currentSession: null,
    });

    renderWithRouter(<ChatInterface />);
    // When no session, it shows "New Chat"
    const headers = screen.getAllByText('New Chat');
    expect(headers.length).toBeGreaterThan(0);
  });
});
