import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  Play, 
  Pause, 
  Settings, 
  RefreshCw, 
  Download, 
  Upload,
  Info,
  Zap,
  BarChart3,
  Code,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../store';
import { PluginState, PluginResult } from '../../types';
import Button from '../ui/Button';
import api from '../../services/api';

const PluginInterface: React.FC = () => {
  const {
    plugins: rawPlugins,
    activePlugins,
    setPlugins,
    updatePlugin,
    setActivePlugins,
  } = useAppStore();

  // Defensive: ensure plugins is always an array (protects against corrupted persisted state)
  const plugins = Array.isArray(rawPlugins) ? rawPlugins : [];

  const [selectedPlugin, setSelectedPlugin] = useState<PluginState | null>(null);
  const [executionResult, setExecutionResult] = useState<PluginResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pluginInput, setPluginInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [configData, setConfigData] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  // Load stats when plugin changes
  useEffect(() => {
    if (selectedPlugin) {
      loadPluginStats(selectedPlugin.plugin_name);
    }
  }, [selectedPlugin]);

  const loadPlugins = async () => {
    try {
      const response = await api.getPlugins();
      if (response.success && response.data) {
        const data = response.data as any;
        const pluginList = Array.isArray(data) ? data : (data.plugins || []);
        setPlugins(pluginList);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  };

  const loadPluginStats = async (pluginName: string) => {
    try {
      const response = await api.getPluginStats(pluginName);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load plugin stats:', error);
    }
  };

  const handleEnablePlugin = async (pluginName: string) => {
    try {
      await api.enablePlugin(pluginName);
      updatePlugin(pluginName, { enabled: true });
      setActivePlugins([...activePlugins, pluginName]);
    } catch (error) {
      console.error('Failed to enable plugin:', error);
    }
  };

  const handleDisablePlugin = async (pluginName: string) => {
    try {
      await api.disablePlugin(pluginName);
      updatePlugin(pluginName, { enabled: false });
      setActivePlugins(activePlugins.filter(name => name !== pluginName));
    } catch (error) {
      console.error('Failed to disable plugin:', error);
    }
  };

  const handleUpdateConfig = async (pluginName: string, config: Record<string, any>) => {
    try {
      await api.updatePluginConfig(pluginName, config);
      updatePlugin(pluginName, { config });
      setShowConfig(false);
    } catch (error) {
      console.error('Failed to update plugin config:', error);
    }
  };

  const handleExecutePlugin = async () => {
    if (!selectedPlugin || !pluginInput.trim()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await api.executePlugin(selectedPlugin.plugin_name, pluginInput, {
        sessionId: 'current',
        timestamp: new Date().toISOString(),
      });
      
      if (response.success && response.data) {
        setExecutionResult(response.data);
        // Update plugin usage stats
        updatePlugin(selectedPlugin.plugin_name, {
          last_used: new Date().toISOString(),
          usage_count: (selectedPlugin.usage_count || 0) + 1,
        });
      }
    } catch (error) {
      console.error('Failed to execute plugin:', error);
      setExecutionResult({
        success: false,
        error: 'Failed to execute plugin',
        executionTime: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReloadPlugins = async () => {
    try {
      const response = await api.reloadPlugins();
      if (response.success && response.data) {
        setPlugins(response.data);
      }
    } catch (error) {
      console.error('Failed to reload plugins:', error);
    }
  };

  const getPluginIcon = (pluginName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      weather: <Zap className="w-5 h-5" />,
      horoscope: <Info className="w-5 h-5" />,
      'poem-of-the-day': <Code className="w-5 h-5" />,
    };
    return iconMap[pluginName] || <Puzzle className="w-5 h-5" />;
  };

  const formatExecutionTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-base-300">
        <div>
          <h1 className="text-2xl font-bold">Plugins</h1>
          <p className="text-base-content/60">Extend functionality with custom plugins</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleReloadPlugins}
            title="Reload plugins"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowStats(!showStats)}
            title="Toggle statistics"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </Button>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <div className="p-4 bg-base-200 border-b border-base-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="font-semibold">Total Plugins</span>
              </div>
              <p className="text-2xl font-bold">{plugins.length}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-success" />
                <span className="font-semibold">Active</span>
              </div>
              <p className="text-2xl font-bold">{activePlugins.length}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Pause className="w-5 h-5 text-warning" />
                <span className="font-semibold">Inactive</span>
              </div>
              <p className="text-2xl font-bold">{plugins.length - activePlugins.length}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-accent" />
                <span className="font-semibold">Total Executions</span>
              </div>
              <p className="text-2xl font-bold">
                {plugins.reduce((sum, plugin) => sum + (plugin.usage_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Plugins List */}
        <div className="w-1/3 border-r border-base-300 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Available Plugins</h2>
            {plugins.length === 0 ? (
              <div className="text-center text-base-content/60 py-8">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p>No plugins available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.plugin_name}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlugin?.plugin_name === plugin.plugin_name
                        ? 'bg-primary text-primary-content border-primary'
                        : 'bg-base-100 border-base-300 hover:bg-base-200'
                    }`}
                    onClick={() => setSelectedPlugin(plugin)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-primary">
                          {getPluginIcon(plugin.plugin_name)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{plugin.plugin_name}</h3>
                          <p className="text-sm opacity-70 line-clamp-1">
                            {plugin.description || 'No description available'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {plugin.enabled ? (
                          <CheckCircle className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-error" />
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-xs opacity-70">
                      <span>v{plugin.version}</span>
                      <span>{plugin.usage_count || 0} uses</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plugin Detail */}
        <div className="flex-1 flex flex-col">
          {selectedPlugin ? (
            <>
              {/* Plugin Header */}
              <div className="p-6 border-b border-base-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-primary">
                      {getPluginIcon(selectedPlugin.plugin_name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedPlugin.plugin_name}</h2>
                      <p className="text-base-content/60">
                        {selectedPlugin.description || 'No description available'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfig(!showConfig)}
                      title="Configure plugin"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Config
                    </Button>
                    
                    {selectedPlugin.enabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisablePlugin(selectedPlugin.plugin_name)}
                        title="Disable plugin"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Disable
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleEnablePlugin(selectedPlugin.plugin_name)}
                        title="Enable plugin"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Enable
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex items-center space-x-4 text-sm text-base-content/60">
                  <span>Version: {selectedPlugin.version}</span>
                  <span>•</span>
                  <span>Usage: {selectedPlugin.usage_count || 0} times</span>
                  <span>•</span>
                  <span>
                    Last used: {selectedPlugin.last_used 
                      ? new Date(selectedPlugin.last_used).toLocaleDateString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>

              {/* Plugin Execution */}
              <div className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Input Section */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Plugin Input
                    </label>
                    <textarea
                      value={pluginInput}
                      onChange={(e) => setPluginInput(e.target.value)}
                      className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-24"
                      placeholder="Enter input for the plugin..."
                      disabled={!selectedPlugin.enabled}
                    />
                  </div>

                  {/* Execute Button */}
                  <div>
                    <Button
                      variant="primary"
                      onClick={handleExecutePlugin}
                      disabled={!selectedPlugin.enabled || !pluginInput.trim() || isExecuting}
                      className="w-full"
                    >
                      {isExecuting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Execute Plugin
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Execution Result */}
                  {executionResult && (
                    <div className="border border-base-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Execution Result</h3>
                        <div className="flex items-center space-x-2">
                          {executionResult.success ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-error" />
                          )}
                          <span className="text-sm text-base-content/60">
                            {formatExecutionTime(executionResult.executionTime)}
                          </span>
                        </div>
                      </div>
                      
                      {executionResult.success ? (
                        <div className="bg-base-200 rounded-lg p-3">
                          <pre className="text-sm whitespace-pre-wrap">
                            {JSON.stringify(executionResult.data, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="bg-error/10 border border-error/20 rounded-lg p-3">
                          <p className="text-error text-sm">{executionResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plugin Statistics */}
                  {stats && (
                    <div className="border border-base-300 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Plugin Statistics</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-base-content/60">Total Executions:</span>
                          <span className="ml-2 font-medium">{stats.totalExecutions || 0}</span>
                        </div>
                        <div>
                          <span className="text-base-content/60">Success Rate:</span>
                          <span className="ml-2 font-medium">
                            {stats.successRate ? `${(stats.successRate * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-base-content/60">Avg Execution Time:</span>
                          <span className="ml-2 font-medium">
                            {stats.avgExecutionTime ? formatExecutionTime(stats.avgExecutionTime) : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-base-content/60">Last 24h:</span>
                          <span className="ml-2 font-medium">{stats.executionsLast24h || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-base-content/60">
                <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p>Select a plugin to view its details and execute it</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfig && selectedPlugin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-base-300">
              <h2 className="text-xl font-bold">
                Configure {selectedPlugin.plugin_name}
              </h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(selectedPlugin.config || {}).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                                         <input
                       type="text"
                       value={configData[key] !== undefined ? configData[key] : value}
                       onChange={(e) => setConfigData(prev => ({
                         ...prev,
                         [key]: e.target.value
                       }))}
                       className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                       placeholder={`Enter ${key}...`}
                       aria-label={`Configure ${key}`}
                     />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-base-300 flex items-center justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowConfig(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleUpdateConfig(selectedPlugin.plugin_name, configData)}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginInterface; 