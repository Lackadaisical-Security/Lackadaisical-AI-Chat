import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Play,
  Square,
  Search,
  Settings,
  Trash2,
  RefreshCw,
  Shield,
  Fingerprint,
  Monitor,
  Wifi,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Button from '../ui/Button';
import api from '../../services/api';

interface EmulatorSession {
  id: string;
  status: string;
  fingerprint: {
    userAgent: string;
    viewport: { width: number; height: number };
    platform: string;
    language: string;
    timezone: string;
  };
  proxy: { host: string; port: number; protocol: string } | null;
  startedAt: string;
  pagesVisited: number;
  currentUrl: string | null;
  errors: string[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo'] as const;

const EmulatorPanel: React.FC = () => {
  const [sessions, setSessions] = useState<EmulatorSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<typeof SEARCH_ENGINES[number]>('google');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [navigateUrl, setNavigateUrl] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProxyConfig, setShowProxyConfig] = useState(false);
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyProtocol, setProxyProtocol] = useState<'http' | 'https' | 'socks5'>('http');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [extractContent, setExtractContent] = useState(false);

  // Refresh sessions
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/emulator/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch {
      // API may not be available yet
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    const interval = setInterval(refreshSessions, 5000);
    return () => clearInterval(interval);
  }, [refreshSessions]);

  // Start session
  const startSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (proxyHost && proxyPort) {
        body.proxy = {
          host: proxyHost,
          port: parseInt(proxyPort),
          protocol: proxyProtocol,
          ...(proxyUsername && { username: proxyUsername }),
          ...(proxyPassword && { password: proxyPassword }),
        };
      }

      const res = await fetch('/api/v1/emulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSession(data.data.id);
        await refreshSessions();
      } else {
        setError(data.error || 'Failed to start session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop session
  const stopSession = async (sessionId: string) => {
    try {
      await fetch(`/api/v1/emulator/sessions/${sessionId}/stop`, { method: 'POST' });
      if (selectedSession === sessionId) setSelectedSession(null);
      await refreshSessions();
    } catch {
      setError('Failed to stop session');
    }
  };

  // Stop all
  const stopAll = async () => {
    try {
      await fetch('/api/v1/emulator/stop-all', { method: 'POST' });
      setSelectedSession(null);
      setSessions([]);
    } catch {
      setError('Failed to stop sessions');
    }
  };

  // Run search
  const runSearch = async () => {
    if (!selectedSession || !searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const res = await fetch('/api/v1/emulator/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession,
          query: searchQuery,
          engine: searchEngine,
          maxResults: 10,
          extractContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.results);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to URL
  const navigateTo = async () => {
    if (!selectedSession || !navigateUrl.trim()) return;
    setIsLoading(true);
    setError(null);
    setPageContent('');

    try {
      const res = await fetch('/api/v1/emulator/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession, url: navigateUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setPageContent(data.data.content);
      } else {
        setError(data.error || 'Navigation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Navigation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const activeSession = sessions.find(s => s.id === selectedSession);

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Traffic Emulator</h1>
          <span className="badge badge-sm badge-primary">{sessions.length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refreshSessions} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowProxyConfig(!showProxyConfig)} title="Proxy Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={startSession} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="ml-1">New Session</span>
          </Button>
          {sessions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={stopAll} className="text-error">
              <Square className="w-4 h-4 mr-1" /> Stop All
            </Button>
          )}
        </div>
      </div>

      {/* Proxy Configuration */}
      {showProxyConfig && (
        <div className="px-4 py-3 bg-base-200 border-b border-base-300 flex flex-wrap items-center gap-3 text-sm">
          <select
            value={proxyProtocol}
            onChange={e => setProxyProtocol(e.target.value as typeof proxyProtocol)}
            className="select select-xs bg-base-300"
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
          <input type="text" value={proxyHost} onChange={e => setProxyHost(e.target.value)}
            placeholder="Proxy host" className="input input-xs bg-base-300 w-32" />
          <input type="text" value={proxyPort} onChange={e => setProxyPort(e.target.value)}
            placeholder="Port" className="input input-xs bg-base-300 w-20" />
          <input type="text" value={proxyUsername} onChange={e => setProxyUsername(e.target.value)}
            placeholder="Username (opt)" className="input input-xs bg-base-300 w-28" />
          <input type="password" value={proxyPassword} onChange={e => setProxyPassword(e.target.value)}
            placeholder="Password (opt)" className="input input-xs bg-base-300 w-28" />
          <span className="text-xs text-base-content/50">Leave empty for direct connection</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sessions sidebar */}
        <div className="w-72 border-r border-base-300 bg-base-200 flex flex-col overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-base-content/70">
            Sessions
          </div>
          {sessions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-base-content/50">
              No active sessions. Click "New Session" to start.
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                className={`px-3 py-2 cursor-pointer border-b border-base-300 ${
                  selectedSession === session.id ? 'bg-primary/10' : 'hover:bg-base-300'
                }`}
                onClick={() => setSelectedSession(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {session.status === 'running' || session.status === 'navigating' ? (
                      <Loader2 className="w-3 h-3 text-primary animate-spin" />
                    ) : session.status === 'error' ? (
                      <AlertCircle className="w-3 h-3 text-error" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-success" />
                    )}
                    <span className="text-xs font-mono">{session.id.substring(0, 8)}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); stopSession(session.id); }}
                    className="p-1 hover:text-error">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-base-content/60">
                  <div className="flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                    {session.fingerprint.viewport.width}×{session.fingerprint.viewport.height}
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {session.proxy ? `${session.proxy.host}:${session.proxy.port}` : 'Direct'}
                  </div>
                  <div>{session.pagesVisited} pages visited</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeSession ? (
            <>
              {/* Fingerprint info bar */}
              <div className="px-4 py-2 bg-base-200 border-b border-base-300 flex items-center gap-4 text-xs overflow-x-auto">
                <div className="flex items-center gap-1" title="User Agent">
                  <Fingerprint className="w-3 h-3" />
                  <span className="truncate max-w-[300px]">{activeSession.fingerprint.userAgent.split(') ').pop()}</span>
                </div>
                <div className="flex items-center gap-1" title="Platform">
                  <Monitor className="w-3 h-3" />
                  {activeSession.fingerprint.platform}
                </div>
                <div className="flex items-center gap-1" title="Timezone">
                  <Globe className="w-3 h-3" />
                  {activeSession.fingerprint.timezone}
                </div>
                <div className="flex items-center gap-1" title="Connection">
                  <Wifi className="w-3 h-3" />
                  {activeSession.proxy ? `${activeSession.proxy.protocol}://${activeSession.proxy.host}` : 'Direct'}
                </div>
              </div>

              {/* Search bar */}
              <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
                <select
                  value={searchEngine}
                  onChange={e => setSearchEngine(e.target.value as typeof searchEngine)}
                  className="select select-sm bg-base-200"
                >
                  {SEARCH_ENGINES.map(engine => (
                    <option key={engine} value={engine}>
                      {engine.charAt(0).toUpperCase() + engine.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder="Search the web..."
                  className="input input-sm flex-1 bg-base-200"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={extractContent} onChange={e => setExtractContent(e.target.checked)}
                    className="checkbox checkbox-xs" />
                  Extract
                </label>
                <Button variant="primary" size="sm" onClick={runSearch} disabled={isLoading || !searchQuery.trim()}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Navigate bar */}
              <div className="px-4 py-2 border-b border-base-300 flex items-center gap-2">
                <input
                  type="text"
                  value={navigateUrl}
                  onChange={e => setNavigateUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && navigateTo()}
                  placeholder="Enter URL to navigate..."
                  className="input input-sm flex-1 bg-base-200"
                />
                <Button variant="ghost" size="sm" onClick={navigateTo} disabled={isLoading || !navigateUrl.trim()}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              {/* Results area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {searchResults.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Search Results ({searchResults.length})</h3>
                    {searchResults.map((result, i) => (
                      <div key={i} className="p-3 bg-base-200 rounded-lg mb-2">
                        <a href={result.url} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium text-sm">
                          {result.title}
                        </a>
                        <div className="text-xs text-success mt-0.5 truncate">{result.url}</div>
                        <p className="text-xs text-base-content/70 mt-1">{result.snippet}</p>
                        {result.content && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-primary">View extracted content</summary>
                            <pre className="text-xs mt-1 p-2 bg-base-300 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                              {result.content.substring(0, 5000)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pageContent && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Page Content</h3>
                    <pre className="text-xs p-3 bg-base-200 rounded-lg max-h-96 overflow-auto whitespace-pre-wrap">
                      {pageContent.substring(0, 20000)}
                    </pre>
                  </div>
                )}

                {!searchResults.length && !pageContent && (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                    <Globe className="w-16 h-16 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ready to browse</h3>
                    <p className="text-sm text-center max-w-md">
                      Use the search bar to search any engine, or enter a URL to navigate directly.
                      Each session has a unique fingerprint for anti-detection.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-base-content/40">
              <Shield className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Traffic Emulator</h3>
              <p className="text-sm text-center max-w-md mb-4">
                Launch sandboxed browser sessions with randomized fingerprints and optional proxy support.
                Each session has unique UA, viewport, WebGL, canvas, and timezone properties.
              </p>
              <Button variant="primary" onClick={startSession} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Start New Session
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmulatorPanel;
