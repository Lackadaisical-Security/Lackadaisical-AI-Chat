import React from 'react';
import { Bot, User, Copy, Check, MoreVertical, Brain, Download, FileText, Globe, Wrench } from 'lucide-react';
import { Message } from '../../types';
import Button from '../ui/Button';

interface MessageBubbleProps {
  message: Message;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onCopy,
  onEdit,
  onDelete,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showThinking, setShowThinking] = React.useState(false);

  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleEdit = () => {
    onEdit?.(message.id, message.content);
    setShowMenu(false);
  };

  const handleDelete = () => {
    onDelete?.(message.id);
    setShowMenu(false);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start space-x-3 max-w-3xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-primary text-primary-content' 
            : 'bg-secondary text-secondary-content'
        }`}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Content */}
        <div className={`relative group ${isUser ? 'text-right' : 'text-left'}`}>
          {/* Attachments (for user messages) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-1 px-2 py-1 bg-base-300 rounded-lg text-xs">
                  <FileText className="w-3 h-3" />
                  <span>{att.name}</span>
                  <span className="text-base-content/50">({Math.round(att.size / 1024)}KB)</span>
                </div>
              ))}
            </div>
          )}

          {/* Web Search / Tool Use Indicators */}
          {!isUser && (message.webSearchUsed || (message.toolsUsed && message.toolsUsed.length > 0)) && (
            <div className="flex items-center gap-2 mb-2 text-xs text-base-content/60">
              {message.webSearchUsed && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-info/10 text-info rounded-full">
                  <Globe className="w-3 h-3" /> Web Search
                </span>
              )}
              {message.toolsUsed?.map((tool, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning rounded-full">
                  <Wrench className="w-3 h-3" /> {tool}
                </span>
              ))}
            </div>
          )}

          {/* Extended Thinking Toggle */}
          {!isUser && message.thinking && (
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1 mb-2 px-2 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs hover:bg-purple-500/20 transition-colors"
            >
              <Brain className="w-3 h-3" />
              {showThinking ? 'Hide' : 'Show'} Thinking
              {message.thinkingDurationMs && (
                <span className="text-purple-400/60 ml-1">({message.thinkingDurationMs}ms)</span>
              )}
            </button>
          )}

          {/* Thinking Content */}
          {showThinking && message.thinking && (
            <div className="mb-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg text-sm text-base-content/70 whitespace-pre-wrap max-h-64 overflow-y-auto">
              <div className="flex items-center gap-1 mb-1 text-xs text-purple-400 font-medium">
                <Brain className="w-3 h-3" /> Extended Thinking
              </div>
              {message.thinking}
            </div>
          )}

          <div className={`rounded-lg px-4 py-3 max-w-2xl ${
            isUser
              ? 'bg-primary text-primary-content'
              : 'bg-base-200 text-base-content border border-base-300'
          }`}>
            {/* Message Text */}
            <div className="whitespace-pre-wrap break-words">
              {message.content || (message.role === 'assistant' ? 'Thinking...' : '')}
            </div>

            {/* Served/Downloadable Code Files */}
            {message.servedFiles && message.servedFiles.length > 0 && (
              <div className="mt-3 border-t border-base-300/50 pt-2">
                <div className="text-xs font-medium text-base-content/70 mb-1">📎 Downloadable Files:</div>
                {message.servedFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.downloadUrl}
                    download={file.filename}
                    className="flex items-center gap-2 px-2 py-1 bg-base-300/50 rounded text-xs hover:bg-base-300 transition-colors mt-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>{file.filename}</span>
                    <span className="text-base-content/50">({file.language})</span>
                  </a>
                ))}
              </div>
            )}

            {/* Message Metadata */}
            <div className={`flex items-center justify-between mt-2 text-xs opacity-70 ${
              isUser ? 'text-primary-content' : 'text-base-content'
            }`}>
              <span>{timestamp}</span>
              {message.model && <span>Model: {message.model}</span>}
              {message.tokens && <span>{message.tokens} tokens</span>}
              {message.responseTime && <span>{message.responseTime}ms</span>}
            </div>

            {/* Sentiment Analysis */}
            {message.sentiment && (
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  message.sentiment.label === 'positive' ? 'bg-success/20 text-success' :
                  message.sentiment.label === 'negative' ? 'bg-error/20 text-error' :
                  'bg-warning/20 text-warning'
                }`}>
                  {message.sentiment.label} ({Math.round(message.sentiment.confidence * 100)}%)
                </span>
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className={`absolute top-2 ${isUser ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 p-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {showMenu && (
                <div className="absolute top-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10 min-w-32">
                  <div className="py-1">
                    <button
                      onClick={handleCopy}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center space-x-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    {onEdit && (
                      <button
                        onClick={handleEdit}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 text-error"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;