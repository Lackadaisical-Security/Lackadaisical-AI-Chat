import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, StopCircle } from 'lucide-react';
import Button from '../ui/Button';
import CompanionCommandPanel from './CompanionCommandPanel';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  onFileUpload?: (file: File) => void;
  onVoiceRecord?: () => void;
  isRecording?: boolean;
  maxLength?: number;
  isCompanionMode?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onKeyPress,
  disabled = false,
  placeholder = "Type your message...",
  onFileUpload,
  onVoiceRecord,
  isRecording = false,
  maxLength = 4000,
  isCompanionMode = false,
}) => {
  const [isComposing, setIsComposing] = useState(false);
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Companion commands for autocomplete
  const companionCommands = [
    '/help', '/checkin', '/journal', '/reflect', '/memory', 
    '/mood', '/gratitude', '/goals', '/nostalgia'
  ];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  // Handle command suggestions
  useEffect(() => {
    if (value.startsWith('/') && value.length > 1) {
      const query = value.toLowerCase();
      const matches = companionCommands.filter(cmd => 
        cmd.toLowerCase().startsWith(query)
      );
      setCommandSuggestions(matches);
    } else {
      setCommandSuggestions([]);
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || disabled || isComposing) return;
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle command suggestions navigation
    if (commandSuggestions.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        onChange(commandSuggestions[0]);
        setCommandSuggestions([]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      onKeyPress(e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVoiceRecord = () => {
    if (onVoiceRecord) {
      onVoiceRecord();
    }
  };

  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="relative">
      {/* File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        accept="image/*,.pdf,.txt,.doc,.docx,.md,.py,.js,.ts,.jsx,.tsx,.json,.yaml,.yml,.xml,.csv,.html,.css,.sql,.sh,.go,.rs,.java,.c,.cpp,.rb"
        aria-label="Upload file"
      />

      {/* Main Input Area */}
      <div className="flex items-end space-x-2 bg-base-100 border border-base-300 rounded-lg p-3">
        {/* Action Buttons */}
        <div className="flex flex-col space-y-1">
          {onFileUpload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-8 h-8 p-0"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          )}
          
          {onVoiceRecord && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoiceRecord}
              disabled={disabled}
              className={`w-8 h-8 p-0 ${isRecording ? 'text-error' : ''}`}
              title={isRecording ? 'Stop recording' : 'Voice message'}
            >
              {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            className="w-full resize-none bg-transparent border-none outline-none text-base-content placeholder-base-content/50 min-h-[20px] max-h-32"
            rows={1}
          />
          
          {/* Character Counter */}
          {maxLength && (
            <div className={`absolute bottom-0 right-0 text-xs ${
              isOverLimit ? 'text-error' : 'text-base-content/50'
            }`}>
              {characterCount}/{maxLength}
            </div>
          )}
        </div>

        {/* Send Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={disabled || !value.trim() || isComposing || isOverLimit}
          className="w-8 h-8 p-0 flex-shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Error Message */}
      {isOverLimit && (
        <div className="mt-1 text-xs text-error">
          Message is too long. Please shorten it.
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="mt-2 flex items-center space-x-2 text-sm text-warning">
          <div className="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
          <span>Recording...</span>
        </div>
      )}
    </div>
  );
};

export default ChatInput; 