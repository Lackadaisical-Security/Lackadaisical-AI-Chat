import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../src/store';

/**
 * Unit tests for Zustand Store
 * These test the actual store logic without mocking external services
 * API calls are not tested here - those are covered by E2E tests
 */

describe('Zustand Store - Unit Tests', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.clearAll();
    });
  });

  describe('Message Management', () => {
    it('should add a message to the store', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          content: 'Hello, world!',
          role: 'user',
          timestamp: new Date().toISOString(),
        });
      });
      
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello, world!');
      expect(result.current.messages[0].role).toBe('user');
    });

    it('should update an existing message', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          content: 'Original content',
          role: 'user',
          timestamp: new Date().toISOString(),
        });
      });
      
      act(() => {
        result.current.updateMessage('msg-1', { content: 'Updated content' });
      });
      
      expect(result.current.messages[0].content).toBe('Updated content');
    });

    it('should set multiple messages at once', () => {
      const { result } = renderHook(() => useAppStore());
      const messages = [
        { id: '1', content: 'First', role: 'user' as const, timestamp: new Date().toISOString() },
        { id: '2', content: 'Second', role: 'assistant' as const, timestamp: new Date().toISOString() },
      ];
      
      act(() => {
        result.current.setMessages(messages);
      });
      
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[1].role).toBe('assistant');
    });
  });

  describe('Session Management', () => {
    it('should set current session', () => {
      const { result } = renderHook(() => useAppStore());
      const session = {
        id: 'session-1',
        name: 'Test Session',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        totalTokens: 0,
      };
      
      act(() => {
        result.current.setCurrentSession(session);
      });
      
      expect(result.current.currentSession).toEqual(session);
    });

    it('should add a session to the list', () => {
      const { result } = renderHook(() => useAppStore());
      const session = {
        id: 'session-1',
        name: 'New Session',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        totalTokens: 0,
      };
      
      act(() => {
        result.current.addSession(session);
      });
      
      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].name).toBe('New Session');
    });

    it('should update a session', () => {
      const { result } = renderHook(() => useAppStore());
      const session = {
        id: 'session-1',
        name: 'Original Name',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        totalTokens: 0,
      };
      
      act(() => {
        result.current.addSession(session);
      });
      
      act(() => {
        result.current.updateSession('session-1', { name: 'Updated Name' });
      });
      
      expect(result.current.sessions[0].name).toBe('Updated Name');
    });

    it('should delete a session', () => {
      const { result } = renderHook(() => useAppStore());
      const session = {
        id: 'session-1',
        name: 'To Delete',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        totalTokens: 0,
      };
      
      act(() => {
        result.current.addSession(session);
      });
      
      expect(result.current.sessions).toHaveLength(1);
      
      act(() => {
        result.current.deleteSession('session-1');
      });
      
      expect(result.current.sessions).toHaveLength(0);
    });
  });

  describe('UI State', () => {
    it('should toggle sidebar state', () => {
      const { result } = renderHook(() => useAppStore());
      
      expect(result.current.sidebarOpen).toBe(false);
      
      act(() => {
        result.current.setSidebarOpen(true);
      });
      
      expect(result.current.sidebarOpen).toBe(true);
    });

    it('should set theme', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.setTheme('dark');
      });
      
      expect(result.current.theme).toBe('dark');
    });

    it('should manage streaming state', () => {
      const { result } = renderHook(() => useAppStore());
      
      expect(result.current.isStreaming).toBe(false);
      
      act(() => {
        result.current.setIsStreaming(true);
      });
      
      expect(result.current.isStreaming).toBe(true);
    });
  });

  describe('Memory Preferences State', () => {
    it('should have correct initial state for memory preferences', () => {
      const { result } = renderHook(() => useAppStore());
      
      expect(result.current.memoryPreferences).toBeNull();
      expect(result.current.crossSessionEnabled).toBe(false);
      expect(result.current.sessionSummaries).toEqual([]);
    });
  });

  describe('Toast Management', () => {
    it('should add and remove toasts', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.addToast({
          type: 'success',
          message: 'Test toast',
        });
      });
      
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Test toast');
      
      const toastId = result.current.toasts[0].id;
      
      act(() => {
        result.current.removeToast(toastId);
      });
      
      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('Settings', () => {
    it('should update settings', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.updateSettings({
          notifications: false,
          soundEnabled: true,
        });
      });
      
      expect(result.current.settings.notifications).toBe(false);
      expect(result.current.settings.soundEnabled).toBe(true);
    });

    it('should have Lacky as default companion name', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.settings.companionName).toBe('Lacky');
    });

    it('should update companion name', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.updateSettings({ companionName: 'Aria' });
      });
      
      expect(result.current.settings.companionName).toBe('Aria');
    });

    it('should preserve companion name when updating other settings', () => {
      const { result } = renderHook(() => useAppStore());
      
      act(() => {
        result.current.updateSettings({ companionName: 'Nova' });
      });
      
      act(() => {
        result.current.updateSettings({ soundEnabled: true });
      });
      
      expect(result.current.settings.companionName).toBe('Nova');
      expect(result.current.settings.soundEnabled).toBe(true);
    });
  });

  describe('Clear All', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useAppStore());
      
      // Add some state
      act(() => {
        result.current.addMessage({
          id: '1',
          content: 'Test',
          role: 'user',
          timestamp: new Date().toISOString(),
        });
        result.current.setTheme('dark');
        result.current.setSidebarOpen(true);
      });
      
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.theme).toBe('dark');
      
      // Clear all
      act(() => {
        result.current.clearAll();
      });
      
      // Verify reset
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.theme).toBe('light');
      expect(result.current.sidebarOpen).toBe(false);
      expect(result.current.currentSession).toBeNull();
      expect(result.current.memoryPreferences).toBeNull();
    });
  });
});
