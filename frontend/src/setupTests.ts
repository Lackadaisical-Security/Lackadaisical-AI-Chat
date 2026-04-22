import '@testing-library/jest-dom';

// Set up environment variables for tests (used after babel transforms import.meta.env to process.env)
process.env.VITE_API_URL = 'http://localhost:3001';
process.env.MODE = 'test';
process.env.DEV = 'false';
process.env.PROD = 'false';

// Ensure pending timers/promises don't leak between tests
afterEach(() => {
  jest.clearAllTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollIntoView for tests
Element.prototype.scrollIntoView = jest.fn();

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  callback: IntersectionObserverCallback;
  root = null;
  rootMargin = '';
  thresholds = [];
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn().mockReturnValue([]);
}

global.IntersectionObserver = IntersectionObserverMock as any;
