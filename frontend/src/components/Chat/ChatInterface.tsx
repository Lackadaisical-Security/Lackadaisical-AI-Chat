import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { 
  Bot, 
  Settings, 
  Plus, 
  StopCircle, 
  Download, 
  Trash2, 
  Copy, 
  MoreVertical,
  Zap,
  Brain,
  Sparkles,
  MessageSquare,
  RotateCcw,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useAppStore } from '../../store';
import { Message } from '../../types';
import Button from '../ui/Button';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ChatSidebar from './ChatSidebar';
import TypingIndicator from '../ui/TypingIndicator';
import useStreamingResponse from '../../hooks/useStreamingResponse';

// Simple toast function for error handling
const toast = ({ title, description }: { 
  title: string; 
  description: string; 
}) => {
  console.error(`${title}: ${description}`);
  alert(`${title}: ${description}`);
};

// AI Model options - Updated April 2026
const AI_MODELS = [
  // Ollama Local Models
  { id: 'gpt-oss:20b', name: 'GPT-OSS 20B (Local)', provider: 'ollama', description: 'OpenAI open-source reasoning model w/ 256k context' },
  { id: 'gemma4:e4b', name: 'Gemma 4 E4B Vision', provider: 'ollama', description: 'Google vision model for image understanding' },
  { id: 'lackadaisical-uncensored:latest', name: 'Lacky Uncensored', provider: 'ollama', description: 'Unrestricted local AI' },
  { id: 'llama3.3:latest', name: 'Llama 3.3', provider: 'ollama', description: 'Meta flagship local model' },
  { id: 'deepseek-r1:latest', name: 'DeepSeek R1', provider: 'ollama', description: 'Advanced reasoning & thinking' },
  { id: 'qwen2.5:latest', name: 'Qwen 2.5', provider: 'ollama', description: 'Alibaba tool-calling & agentic' },
  { id: 'mistral:latest', name: 'Mistral 7B', provider: 'ollama', description: 'Efficient & fast local model' },
  { id: 'codellama:latest', name: 'Code Llama', provider: 'ollama', description: 'Specialized code generation' },
  { id: 'phi4:latest', name: 'Phi-4', provider: 'ollama', description: 'Microsoft lightweight reasoning' },
  // OpenAI Models
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', description: 'OpenAI flagship reasoning & coding' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', description: 'Fast, cost-effective GPT-5.4' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: '1M token long context model' },
  { id: 'o4-mini', name: 'O4 Mini', provider: 'openai', description: 'Budget reasoning model' },
  { id: 'o3', name: 'O3', provider: 'openai', description: 'Advanced reasoning' },
  { id: 'gpt-4o', name: 'GPT-4o (Legacy)', provider: 'openai', description: 'Multimodal vision & audio' },
  // Anthropic Models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', description: 'Anthropic flagship, 1M context' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Balanced speed & intelligence' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fastest Claude, low-latency' },
  // Google Models
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Google flagship, 2M context' },
  { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', provider: 'google', description: 'High-speed multimodal' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', description: 'Agentic reasoning, 1M context' },
  // xAI Models
  { id: 'grok-4.20-beta', name: 'Grok 4.20 Beta', provider: 'xai', description: 'xAI flagship, 2M context, multi-agent' },
  { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', provider: 'xai', description: 'Fast reasoning, 2M context' },
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'Enterprise reasoning' },
  { id: 'grok-code-fast-1', name: 'Grok Code Fast', provider: 'xai', description: 'Agentic code workflows' },
];

const ChatInterface: React.FC = () => {
  const location = useLocation();
  const {
    currentSession,
    messages,
    setCurrentSession,
    addMessage,
    sidebarOpen,
    setSidebarOpen,
    updateAssistantMessage,
    loadSessionMessages,
    settings,
    updateSettings,
    theme,
    setTheme,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Enhanced UI state
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState('ollama-default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [chatTemperature, setChatTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);

  // Handle pre-filled message from companion dashboard
  useEffect(() => {
    const state = location.state as { prefilledMessage?: string; companionMode?: boolean } | null;
    if (state?.prefilledMessage && inputValue === '') {
      setInputValue(state.prefilledMessage);
      // Clear the state to avoid re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Streaming response hook
  const {
    isStreaming,
    streamContent,
    stopStreaming,
    cleanup
  } = useStreamingResponse({
    onChunkReceived: (chunk) => {
      if (chunk.type === 'content' && chunk.content && currentAssistantMessageId) {
        // Update the assistant message in real-time
        updateAssistantMessage(currentAssistantMessageId, streamContent + (chunk.content || ''));
      }
    },
    onComplete: (fullResponse, metadata) => {
      console.log('Streaming completed:', { fullResponse, metadata });
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    },
    onError: (error) => {
      console.error('Streaming error:', error);
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    }
  });

  // Cleanup streaming on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Ensure we have a session
      const sessionId = currentSession?.id || 'default';

      // Create user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      };

      addMessage(userMessage);

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      addMessage(assistantMessage);
      setCurrentAssistantMessageId(assistantMessage.id);

      // Use the API service for streaming (FIXED)
      let accumulatedContent = '';
      await api.streamMessage(
        messageText,
        sessionId,
        (chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            // Accumulate content and update the message
            accumulatedContent += chunk.content;
            updateAssistantMessage(assistantMessage.id, accumulatedContent);
          }
        }
      );

      setIsLoading(false);
      setCurrentAssistantMessageId(null);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again."
      });
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Create new session
  const handleNewSession = async () => {
    const sessionName = `Chat ${Date.now()}`;
    try {
      const res = await api.createSession(sessionName);
      if (res.data) {
        setCurrentSession(res.data);
      }
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  // Export chat history
  const handleExportChat = () => {
    if (messages.length === 0) return;
    
    const chatExport = {
      session: currentSession?.name || 'Chat Export',
      exportedAt: new Date().toISOString(),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }))
    };
    
    const blob = new Blob([JSON.stringify(chatExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear current chat
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear this chat? This cannot be undone.')) {
      // Clear messages from the current session
      try {
        if (currentSession?.id) {
          await api.deleteConversationHistory(currentSession.id);
        }
        // Refresh the session to show empty
        handleNewSession();
      } catch (err) {
        console.error('Failed to clear chat', err);
      }
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Copy last response to clipboard with user feedback
  const copyLastResponse = () => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMessage) {
      navigator.clipboard.writeText(lastAssistantMessage.content).then(() => {
        // Visual feedback - button will show success state briefly
        const btn = document.querySelector('[title="Copy Last Response"]');
        if (btn) {
          btn.classList.add('text-success');
          setTimeout(() => btn.classList.remove('text-success'), 1500);
        }
      });
    }
  };

  // Regenerate last response by re-sending the last user message
  const regenerateResponse = async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
      // User can review and send manually, or modify before sending
    }
  };

  return (
    <div className={`flex h-screen bg-base-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Sidebar */}
      <ChatSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {currentSession?.name || 'New Chat'}
              </h1>
              <p className="text-sm text-base-content/60">
                {messages.length} messages • {AI_MODELS.find(m => m.id === selectedModel)?.name || 'Lacky'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Model Selector */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2"
                title="Select AI Model"
              >
                <Brain className="h-4 w-4" />
                <span className="hidden md:inline text-sm">
                  {AI_MODELS.find(m => m.id === selectedModel)?.name || 'Model'}
                </span>
              </Button>
              
              {showModelSelector && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50">
                  <div className="p-2">
                    <h3 className="text-sm font-semibold px-2 py-1 text-base-content/70">Select AI Model</h3>
                    {AI_MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setShowModelSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-base-200 transition-colors ${
                          selectedModel === model.id ? 'bg-primary/10 text-primary' : ''
                        }`}
                      >
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-base-content/60">{model.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Settings */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickSettings(!showQuickSettings)}
                title="Quick Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              {showQuickSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50 p-4">
                  <h3 className="text-sm font-semibold mb-3">Quick Settings</h3>
                  
                  {/* Temperature Slider */}
                  <div className="mb-4">
                    <label className="text-xs text-base-content/70 mb-1 flex justify-between">
                      <span>Creativity</span>
                      <span>{chatTemperature.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={chatTemperature}
                      onChange={(e) => setChatTemperature(parseFloat(e.target.value))}
                      className="range range-primary range-xs w-full"
                    />
                    <div className="flex justify-between text-xs text-base-content/50 mt-1">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  
                  {/* Max Tokens Slider */}
                  <div className="mb-4">
                    <label className="text-xs text-base-content/70 mb-1 flex justify-between">
                      <span>Max Response Length</span>
                      <span>{maxTokens}</span>
                    </label>
                    <input
                      type="range"
                      min="256"
                      max="4096"
                      step="256"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="range range-primary range-xs w-full"
                    />
                  </div>
                  
                  {/* Sound Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Sound Effects</span>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`btn btn-sm ${soundEnabled ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={copyLastResponse}
              title="Copy Last Response"
              disabled={messages.length === 0}
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={regenerateResponse}
              title="Regenerate Response"
              disabled={messages.length === 0}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportChat}
              title="Export Chat"
              disabled={messages.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            
            <div className="h-6 w-px bg-base-300 mx-1" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              title="Clear Chat"
              className="text-error hover:bg-error/10"
              disabled={messages.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-16 w-16 text-base-content/40 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Lackadaisical AI Chat</h2>
              <p className="text-base-content/60 max-w-md mb-6">
                Start a conversation with your AI companion. I'm here to chat, help, and learn with you.
              </p>
              
              {/* Quick Start Suggestions */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  "Tell me a joke",
                  "Help me write code",
                  "Explain a concept",
                  "Creative writing",
                  "Daily check-in"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(suggestion)}
                    className="px-4 py-2 bg-base-200 hover:bg-base-300 rounded-full text-sm transition-colors"
                  >
                    <Sparkles className="h-3 w-3 inline mr-2" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          
          {isStreaming && (
            <div className="flex items-center justify-between space-x-2 p-4 bg-base-100 rounded-lg border border-base-300">
              <TypingIndicator 
                variant="processing" 
                isVisible={isStreaming}
                text="AI is generating response..."
              />
              <Button
                onClick={stopStreaming}
                variant="outline"
                size="sm"
                className="text-error hover:bg-error hover:text-error-content"
              >
                <StopCircle className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-base-300 bg-base-200">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            onKeyPress={handleKeyPress}
            disabled={isLoading || isStreaming}
            placeholder="Type your message..."
          />
          <div className="flex items-center justify-between mt-2 text-xs text-base-content/50">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              Powered by {AI_MODELS.find(m => m.id === selectedModel)?.provider || 'Ollama'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Click outside to close dropdowns */}
      {(showModelSelector || showQuickSettings) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowModelSelector(false);
            setShowQuickSettings(false);
          }}
        />
      )}
    </div>
  );
};

export default ChatInterface;