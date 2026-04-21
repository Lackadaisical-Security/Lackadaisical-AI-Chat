import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Palette,
  Bell, 
  Volume2, 
  VolumeX, 
  Save, 
  Download, 
  Upload,
  Shield,
  Database,
  Zap,
  Monitor,
  Globe,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Brain,
  History,
  Sparkles,
  User,
  LogIn,
  LogOut,
  UserPlus,
  Edit3
} from 'lucide-react';
import { useAppStore } from '../../store';
import { UserSettings, UserMemoryPreferences, UserProfile } from '../../types';
import Button from '../ui/Button';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { useTheme } from '../ui/ThemeProvider';
import api from '../../services/api';

const SettingsInterface: React.FC = () => {
  const {
    settings,
    updateSettings,
    memoryPreferences,
    crossSessionEnabled,
    fetchMemoryPreferences,
    updateMemoryPreferences,
    toggleCrossSession,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'appearance' | 'ai' | 'memory' | 'privacy' | 'advanced'>('general');
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [localMemoryPrefs, setLocalMemoryPrefs] = useState<Partial<UserMemoryPreferences> | null>(null);
  const [memoryPrefsLoaded, setMemoryPrefsLoaded] = useState(false);
  const [memoryPrefsChanged, setMemoryPrefsChanged] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
    xai: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // User account state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadApiKeys();
    fetchMemoryPreferences();
    loadUserProfile();
  }, []);

  // Update local memory preferences when store changes (after fetch completes)
  useEffect(() => {
    if (memoryPreferences) {
      setLocalMemoryPrefs({
        crossSessionEnabled: memoryPreferences.crossSessionEnabled,
        maxCrossSessionHistory: memoryPreferences.maxCrossSessionHistory,
        contextTokenLimit: memoryPreferences.contextTokenLimit,
        maxContextMessages: memoryPreferences.maxContextMessages,
        autoSummarize: memoryPreferences.autoSummarize,
        privacyLevel: memoryPreferences.privacyLevel,
      });
      setMemoryPrefsLoaded(true);
      setMemoryPrefsChanged(false); // Reset changed flag when preferences are freshly loaded
    }
  }, [memoryPreferences]);

  // Check for changes (include memory preference changes)
  useEffect(() => {
    const settingsChanged = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(settingsChanged || memoryPrefsChanged);
  }, [localSettings, settings, memoryPrefsChanged]);

  // Helper to update local memory prefs and mark as changed
  const updateLocalMemoryPrefs = (updates: Partial<UserMemoryPreferences>) => {
    setLocalMemoryPrefs(prev => prev ? { ...prev, ...updates } : updates);
    setMemoryPrefsChanged(true);
  };

  const loadSettings = async () => {
    try {
      // Load settings from localStorage or API
      const savedSettings = localStorage.getItem('user-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setLocalSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      // Load API keys from secure storage
      const savedKeys = localStorage.getItem('api-keys');
      if (savedKeys) {
        setApiKeys(JSON.parse(savedKeys));
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await api.getProfile();
      if (response.success && response.data?.user) {
        setUserProfile(response.data.user);
        setIsLoggedIn(true);
        setNewDisplayName(response.data.user.name);
      }
    } catch {
      // Not logged in or token expired
      localStorage.removeItem('auth_token');
      setIsLoggedIn(false);
      setUserProfile(null);
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      let response;
      if (authMode === 'register') {
        if (!authName.trim()) {
          setAuthError('Display name is required for registration');
          setAuthLoading(false);
          return;
        }
        response = await api.register(authEmail, authPassword, authName);
      } else {
        response = await api.login(authEmail, authPassword);
      }

      if (response.success && response.data) {
        localStorage.setItem('auth_token', response.data.tokens.accessToken);
        localStorage.setItem('refresh_token', response.data.tokens.refreshToken);
        setUserProfile(response.data.user);
        setIsLoggedIn(true);
        setNewDisplayName(response.data.user.name);
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
      }
    } catch (error: any) {
      setAuthError(error.response?.data?.error || error.response?.data?.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    setIsLoggedIn(false);
    setUserProfile(null);
    setEditingName(false);
  };

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim() || !userProfile) return;
    setProfileSaveStatus('saving');
    try {
      const response = await api.updateProfile({ name: newDisplayName.trim() });
      if (response.success && response.data?.user) {
        setUserProfile(response.data.user);
        setEditingName(false);
        setProfileSaveStatus('success');
        setTimeout(() => setProfileSaveStatus('idle'), 2000);
      }
    } catch (error: any) {
      setProfileSaveStatus('error');
      setTimeout(() => setProfileSaveStatus('idle'), 3000);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      // Save to localStorage
      localStorage.setItem('user-settings', JSON.stringify(localSettings));
      
      // Update store
      updateSettings(localSettings);
      
      // Save API keys
      localStorage.setItem('api-keys', JSON.stringify(apiKeys));
      
      // Sync companion name to the backend personality state
      if (localSettings.companionName) {
        try {
          await api.updatePersonality({ name: localSettings.companionName } as any);
        } catch (err) {
          console.warn('Failed to sync companion name to backend:', err);
        }
      }
      
      // Only save memory preferences if they were explicitly changed and loaded
      if (memoryPrefsChanged && localMemoryPrefs && memoryPrefsLoaded) {
        await updateMemoryPreferences(localMemoryPrefs);
        setMemoryPrefsChanged(false); // Reset changed flag after successful save
      }
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    const { setTheme } = useTheme();
    const defaultSettings: UserSettings = {
      theme: 'light',
      autoSave: true,
      notifications: true,
      soundEnabled: false,
      fontSize: 'medium',
      compactMode: false,
      language: 'en',
      companionName: 'Lacky',
    };
    setLocalSettings(defaultSettings);
    setTheme('light');
  };

  const handleExportSettings = () => {
    const exportData = {
      settings: localSettings,
      apiKeys: showApiKeys ? apiKeys : {},
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lackadaisical-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported.settings) {
          setLocalSettings(imported.settings);
        }
        if (imported.apiKeys) {
          setApiKeys(imported.apiKeys);
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'ai', label: 'AI Settings', icon: Zap },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'advanced', label: 'Advanced', icon: Database },
  ] as const;

  const fontSizes = [
    { value: 'small', label: 'Small', description: 'Compact text' },
    { value: 'medium', label: 'Medium', description: 'Standard size' },
    { value: 'large', label: 'Large', description: 'Easy to read' },
  ];

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-base-300">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-base-content/60">Customize your experience</p>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <div className="flex items-center space-x-2 text-warning">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Unsaved changes</span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleResetSettings}
            title="Reset to defaults"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveSettings}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-base-300 bg-base-200">
          <div className="p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-content'
                        : 'hover:bg-base-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">General Settings</h2>
                
                <div className="space-y-4">
                  {/* Companion Name Customization */}
                  <div className="p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Companion Name</h3>
                        <p className="text-sm text-base-content/60">
                          Choose a name for your AI companion (default: Lacky)
                        </p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={localSettings.companionName || 'Lacky'}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, companionName: e.target.value || 'Lacky' }))}
                      placeholder="Lacky"
                      maxLength={30}
                      className="w-full max-w-xs px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <p className="text-xs text-base-content/40 mt-1">
                      This name will be used in system prompts and the AI's self-reference.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Notifications</h3>
                        <p className="text-sm text-base-content/60">Receive notifications for important events</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.notifications}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, notifications: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {localSettings.soundEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-base-content/60" />}
                      <div>
                        <h3 className="font-medium">Sound Effects</h3>
                        <p className="text-sm text-base-content/60">Play sounds for notifications and interactions</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.soundEnabled}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Save className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Auto Save</h3>
                        <p className="text-sm text-base-content/60">Automatically save your work</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.autoSave}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Monitor className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Compact Mode</h3>
                        <p className="text-sm text-base-content/60">Use less space for interface elements</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.compactMode}
                        onChange={(e) => setLocalSettings(prev => ({ ...prev, compactMode: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Account Settings */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">User Account</h2>
                
                {!isLoggedIn ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <User className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-info">Optional Account</h4>
                          <p className="text-sm text-base-content/70 mt-1">
                            Creating an account enables username display, profile management, and secure token-based authentication.
                            The app works without an account — this is entirely optional.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Login / Register Form */}
                    <div className="p-6 bg-base-200 rounded-lg max-w-md">
                      <div className="flex space-x-2 mb-6">
                        <button
                          onClick={() => { setAuthMode('login'); setAuthError(''); }}
                          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                            authMode === 'login' ? 'bg-primary text-primary-content' : 'bg-base-300 hover:bg-base-100'
                          }`}
                        >
                          <LogIn className="w-4 h-4 inline mr-2" />
                          Sign In
                        </button>
                        <button
                          onClick={() => { setAuthMode('register'); setAuthError(''); }}
                          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                            authMode === 'register' ? 'bg-primary text-primary-content' : 'bg-base-300 hover:bg-base-100'
                          }`}
                        >
                          <UserPlus className="w-4 h-4 inline mr-2" />
                          Create Account
                        </button>
                      </div>

                      <div className="space-y-4">
                        {authMode === 'register' && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Username</label>
                            <input
                              type="text"
                              value={authName}
                              onChange={(e) => setAuthName(e.target.value)}
                              placeholder="Choose a display name"
                              maxLength={50}
                              className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <input
                            type="email"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Password</label>
                          <input
                            type="password"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder={authMode === 'register' ? 'Min 8 characters' : 'Enter password'}
                            className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
                          />
                        </div>

                        {authError && (
                          <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
                            {authError}
                          </div>
                        )}

                        <Button
                          variant="primary"
                          onClick={handleAuth}
                          disabled={authLoading || !authEmail || !authPassword}
                          className="w-full"
                        >
                          {authLoading ? (
                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                          ) : authMode === 'register' ? (
                            <><UserPlus className="w-4 h-4 mr-2" /> Create Account</>
                          ) : (
                            <><LogIn className="w-4 h-4 mr-2" /> Sign In</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* User Profile Card */}
                    <div className="p-6 bg-base-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            {editingName ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={newDisplayName}
                                  onChange={(e) => setNewDisplayName(e.target.value)}
                                  maxLength={50}
                                  className="px-3 py-1 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg font-bold"
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                                  autoFocus
                                />
                                <Button variant="primary" size="sm" onClick={handleUpdateDisplayName} disabled={profileSaveStatus === 'saving'}>
                                  {profileSaveStatus === 'saving' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setEditingName(false); setNewDisplayName(userProfile?.name || ''); }}>
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-bold">{userProfile?.name}</h3>
                                <button
                                  onClick={() => { setEditingName(true); setNewDisplayName(userProfile?.name || ''); }}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                  title="Edit display name"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <p className="text-sm text-base-content/60">{userProfile?.email}</p>
                            <p className="text-xs text-base-content/40 mt-1">
                              Role: {userProfile?.role} • Joined: {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Unknown'}
                            </p>
                            {profileSaveStatus === 'success' && (
                              <p className="text-xs text-success mt-1">✓ Profile updated</p>
                            )}
                            {profileSaveStatus === 'error' && (
                              <p className="text-xs text-error mt-1">Failed to update profile</p>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                          <LogOut className="w-4 h-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    </div>

                    {/* Quick Name Change Info */}
                    <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-success">Username Management</h4>
                          <p className="text-sm text-base-content/70 mt-1">
                            Click the edit icon next to your name to change your display name at any time.
                            Your username is shown in the sidebar and used throughout the app.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="space-y-8 bg-[var(--color-card)] rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <Palette className="w-6 h-6 text-[var(--color-primary)]" />
                  <h2 className="text-2xl font-semibold text-[var(--color-text)]">Appearance</h2>
                </div>
                
                <div className="space-y-8">
                  {/* Theme Switcher */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">Theme</h3>
                      <p className="text-sm text-[var(--color-textMuted)] mb-4">
                        Choose a visual theme that suits your preference and working environment.
                      </p>
                    </div>
                    
                    {/* Grid Theme Switcher */}
                    <ThemeSwitcher 
                      variant="grid" 
                      size="md" 
                      showPreview={true}
                      className="max-w-4xl"
                    />
                    
                    {/* Alternative: Compact Theme Switcher */}
                    <div className="mt-6 p-4 bg-[var(--color-backgroundSecondary)] rounded-lg">
                      <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Quick Theme Switch</h4>
                      <div className="flex gap-3">
                        <ThemeSwitcher variant="tabs" size="sm" showPreview={false} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Font Size</h3>
                    <div className="space-y-3">
                      {fontSizes.map((size) => (
                        <label key={size.value} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name="fontSize"
                            value={size.value}
                            checked={localSettings.fontSize === size.value}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, fontSize: e.target.value as 'small' | 'medium' | 'large' }))}
                            className="radio radio-primary"
                          />
                          <div>
                            <span className="font-medium">{size.label}</span>
                            <p className="text-sm text-base-content/60">{size.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Settings */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">AI Configuration</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">API Keys</h3>
                    <div className="space-y-4">
                      {Object.entries(apiKeys).map(([provider, key]) => (
                        <div key={provider} className="space-y-2">
                          <label className="block text-sm font-medium capitalize">
                            {provider} API Key
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKeys ? 'text' : 'password'}
                              value={key}
                              onChange={(e) => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                              className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                              placeholder={`Enter your ${provider} API key`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKeys(!showApiKeys)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-base-content/60 hover:text-base-content"
                            >
                              {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-warning">API Key Security</h4>
                        <p className="text-sm text-base-content/70 mt-1">
                          Your API keys are stored locally and never sent to our servers. 
                          Keep them secure and never share them publicly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Settings */}
            {activeTab === 'memory' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Memory & Context</h2>
                
                <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Brain className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-info">Enhanced Memory System</h4>
                      <p className="text-sm text-base-content/70 mt-1">
                        Control how the AI remembers and uses context from your conversations. 
                        Cross-session memory allows the AI to reference past conversations for better continuity.
                      </p>
                    </div>
                  </div>
                </div>

                {!memoryPrefsLoaded ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary mr-2" />
                    <span className="text-base-content/60">Loading memory preferences...</span>
                  </div>
                ) : (
                <div className="space-y-4">
                  {/* Cross-Session Memory Toggle */}
                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <History className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Cross-Session Memory</h3>
                        <p className="text-sm text-base-content/60">
                          Allow AI to access context from previous sessions
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localMemoryPrefs?.crossSessionEnabled ?? false}
                        onChange={(e) => updateLocalMemoryPrefs({ crossSessionEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Auto-Summarize Toggle */}
                  <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Auto-Summarize</h3>
                        <p className="text-sm text-base-content/60">
                          Automatically create conversation summaries for faster context loading
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localMemoryPrefs?.autoSummarize ?? true}
                        onChange={(e) => updateLocalMemoryPrefs({ autoSummarize: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Max Cross-Session History */}
                  <div className="p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <Database className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Cross-Session History Limit</h3>
                        <p className="text-sm text-base-content/60">
                          Maximum number of past sessions to include in context
                        </p>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={localMemoryPrefs?.maxCrossSessionHistory ?? 10}
                      onChange={(e) => updateLocalMemoryPrefs({ maxCrossSessionHistory: parseInt(e.target.value) })}
                      className="range range-primary w-full"
                    />
                    <div className="flex justify-between text-xs text-base-content/60 mt-2">
                      <span>1 session</span>
                      <span className="font-medium text-primary">{localMemoryPrefs?.maxCrossSessionHistory ?? 10} sessions</span>
                      <span>20 sessions</span>
                    </div>
                  </div>

                  {/* Privacy Level */}
                  <div className="p-4 bg-base-200 rounded-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <Shield className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Memory Privacy Level</h3>
                        <p className="text-sm text-base-content/60">
                          Control how detailed the memory context is
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { value: 'strict', label: 'Strict', description: 'Minimal context, no personal details' },
                        { value: 'normal', label: 'Normal', description: 'Balanced context for natural conversations' },
                        { value: 'relaxed', label: 'Relaxed', description: 'Full context for best personalization' },
                      ].map((level) => (
                        <label key={level.value} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-base-300 rounded">
                          <input
                            type="radio"
                            name="privacyLevel"
                            value={level.value}
                            checked={localMemoryPrefs?.privacyLevel === level.value}
                            onChange={(e) => updateLocalMemoryPrefs({ privacyLevel: e.target.value as 'strict' | 'normal' | 'relaxed' })}
                            className="radio radio-primary"
                          />
                          <div>
                            <span className="font-medium">{level.label}</span>
                            <p className="text-xs text-base-content/60">{level.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Memory Stats Info */}
                  <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-success">System Memory Capabilities</h4>
                        <p className="text-xs text-base-content/60 mb-2">These are the maximum limits supported by the backend:</p>
                        <ul className="text-sm text-base-content/70 mt-1 space-y-1">
                          <li>• Up to 1,000 messages per session</li>
                          <li>• 128K token context window</li>
                          <li>• 32K token cross-session budget</li>
                          <li>• Smart topic extraction and summaries</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Cross-Session Privacy Note */}
                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-warning">Privacy Note</h4>
                        <p className="text-sm text-base-content/70 mt-1">
                          Cross-session memory allows the AI to reference previous conversations. 
                          Conversation data is stored on your configured server instance (according to its retention policies), 
                          not just in this browser. Enable this feature only if you are comfortable with the server storing 
                          context across sessions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Privacy & Security</h2>
                
                <div className="space-y-6">
                  <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-info">Privacy First</h4>
                        <p className="text-sm text-base-content/70 mt-1">
                          All your data is processed locally. We don't collect, store, or transmit any personal information.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Database className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-medium">Local Storage</h3>
                          <p className="text-sm text-base-content/60">All data stored locally on your device</p>
                        </div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-medium">No Telemetry</h3>
                          <p className="text-sm text-base-content/60">No usage data is collected or sent</p>
                        </div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Key className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-medium">Encrypted Storage</h3>
                          <p className="text-sm text-base-content/60">Sensitive data is encrypted at rest</p>
                        </div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Advanced</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Import/Export</h3>
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        onClick={handleExportSettings}
                        title="Export settings"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Settings
                      </Button>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportSettings}
                          className="hidden"
                          id="import-settings"
                        />
                        <label htmlFor="import-settings">
                          <Button variant="outline" title="Import settings" className="cursor-pointer">
                            <Upload className="w-4 h-4 mr-2" />
                            Import Settings
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Language</h3>
                    <select
                      value={localSettings.language}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, language: e.target.value }))}
                      className="px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="ja">日本語</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>

                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-warning">Advanced Features</h4>
                        <p className="text-sm text-base-content/70 mt-1">
                          These settings are for advanced users. Changes may affect application behavior.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsInterface; 