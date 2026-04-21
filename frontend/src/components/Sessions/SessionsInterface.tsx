import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Clock,
  Hash,
  Trash2,
  Search,
  Plus,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Zap,
  Brain,
  RefreshCw,
  Archive,
  Star,
  MoreVertical,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import Button from '../ui/Button';
import { useAppStore } from '../../store';
import api from '../../services/api';
import type { ChatSession } from '../../types';

type SortField = 'updatedAt' | 'createdAt' | 'messageCount' | 'name';
type SortDir = 'asc' | 'desc';

const SessionsInterface: React.FC = () => {
  const navigate = useNavigate();
  const {
    sessions,
    currentSession,
    setCurrentSession,
    addSession,
    deleteSession,
    updateSession,
    loadSessionMessages,
    setMessages,
  } = useAppStore();

  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionSummaries, setSessionSummaries] = useState<Record<string, {
    topics: string[];
    messageCount: number;
    lastActive: string;
    summary: string;
  }>>({});

  // Load all sessions from backend
  const loadAllSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getSessions();
      if (response.success && response.data) {
        setAllSessions(response.data);
        // Also add to store if missing
        for (const session of response.data) {
          if (!sessions.find(s => s.id === session.id)) {
            addSession(session);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }

    // Also load session summaries for richer display
    try {
      const summaryResponse = await api.getSessionSummaries(undefined, 100);
      if (summaryResponse.success && summaryResponse.data) {
        const summaryMap: Record<string, any> = {};
        for (const s of summaryResponse.data.summaries) {
          summaryMap[s.sessionId] = {
            topics: s.topics || [],
            messageCount: s.messageCount,
            lastActive: s.lastActive,
            summary: s.summary || '',
          };
        }
        setSessionSummaries(summaryMap);
      }
    } catch {
      // Summaries are optional
    }

    setIsLoading(false);
  }, [sessions, addSession]);

  useEffect(() => {
    loadAllSessions();
  }, []);

  // Open a session — navigate to chat and load its messages
  const openSession = async (session: ChatSession) => {
    setCurrentSession(session);
    try {
      await loadSessionMessages(session.id);
    } catch {
      console.error('Failed to load messages for session:', session.id);
    }
    navigate('/chat');
  };

  // Create a new session
  const createNewSession = async () => {
    try {
      const response = await api.createSession(`Chat ${new Date().toLocaleDateString()}`);
      if (response.success && response.data) {
        addSession(response.data);
        setAllSessions(prev => [...prev, response.data!]);
        openSession(response.data);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  // Delete a session
  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session and all its messages?')) return;
    try {
      await api.deleteSession(sessionId);
      deleteSession(sessionId);
      setAllSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Rename a session
  const startEditing = (sessionId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditName(currentName);
  };

  const saveEdit = async (sessionId: string) => {
    if (editName.trim()) {
      try {
        await api.updateSession(sessionId, { name: editName.trim() });
        updateSession(sessionId, { name: editName.trim() });
        setAllSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, name: editName.trim() } : s)
        );
      } catch (error) {
        console.error('Failed to rename session:', error);
      }
    }
    setEditingId(null);
  };

  // Sorting and filtering
  const filteredSessions = allSessions
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const summary = sessionSummaries[s.id];
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (summary?.topics || []).some((t: string) => t.toLowerCase().includes(q)) ||
        (summary?.summary || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'messageCount':
          cmp = a.messageCount - b.messageCount;
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Sessions
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Browse and revisit past conversations. Memory carries across all sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadAllSessions} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="primary" onClick={createNewSession}>
            <Plus className="w-4 h-4 mr-1" /> New Session
          </Button>
        </div>
      </div>

      {/* Search and sort bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-base-300 bg-base-200/50">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-base-content/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sessions by name, topic, or content..."
            className="input input-sm bg-base-100 flex-1"
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-base-content/50">Sort:</span>
          {([
            ['updatedAt', 'Recent'],
            ['createdAt', 'Created'],
            ['messageCount', 'Messages'],
            ['name', 'Name'],
          ] as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`px-2 py-1 rounded text-xs ${
                sortField === field ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-base-300'
              }`}
            >
              {label}
              {sortField === field && (
                <ArrowUpDown className="w-3 h-3 inline-block ml-0.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cross-session memory banner */}
      <div className="px-6 py-2 bg-info/5 border-b border-info/20 flex items-center gap-2 text-xs text-info">
        <Brain className="w-4 h-4" />
        <span>
          Cross-session memory is active — the AI remembers context from all past sessions when responding.
        </span>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-base-content/40">
            <MessageSquare className="w-12 h-12 mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery ? 'No sessions match your search' : 'No sessions yet'}
            </h3>
            <p className="text-sm mb-4">
              {searchQuery ? 'Try a different search term' : 'Start a new conversation to get started'}
            </p>
            {!searchQuery && (
              <Button variant="primary" onClick={createNewSession}>
                <Plus className="w-4 h-4 mr-1" /> Start New Chat
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map(session => {
              const summary = sessionSummaries[session.id];
              const isCurrent = currentSession?.id === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => openSession(session)}
                  className={`relative group p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                    isCurrent
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-base-300 bg-base-100 hover:border-base-content/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Session name */}
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                        {editingId === session.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(session.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="input input-sm bg-base-200 w-60"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(session.id)} className="p-1 hover:text-success">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 hover:text-error">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-semibold text-sm truncate">{session.name}</h3>
                        )}
                      </div>

                      {/* Summary */}
                      {summary?.summary && (
                        <p className="text-xs text-base-content/60 mt-1 line-clamp-2">
                          {summary.summary}
                        </p>
                      )}

                      {/* Topics */}
                      {summary?.topics && summary.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {summary.topics.slice(0, 5).map((topic, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-base-200 rounded text-xs text-base-content/70">
                              {topic}
                            </span>
                          ))}
                          {summary.topics.length > 5 && (
                            <span className="text-xs text-base-content/50">+{summary.topics.length - 5} more</span>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-base-content/50">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {session.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {session.totalTokens.toLocaleString()} tokens
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created {formatDate(session.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button
                        onClick={e => startEditing(session.id, session.name, e)}
                        className="p-1.5 hover:bg-base-300 rounded"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => handleDelete(session.id, e)}
                        className="p-1.5 hover:bg-error/10 hover:text-error rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-base-content/30" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-6 py-2 border-t border-base-300 bg-base-200/50 flex items-center justify-between text-xs text-base-content/50">
        <span>{filteredSessions.length} of {allSessions.length} sessions</span>
        <span>
          Total: {allSessions.reduce((sum, s) => sum + s.messageCount, 0).toLocaleString()} messages,{' '}
          {allSessions.reduce((sum, s) => sum + s.totalTokens, 0).toLocaleString()} tokens
        </span>
      </div>
    </div>
  );
};

export default SessionsInterface;
