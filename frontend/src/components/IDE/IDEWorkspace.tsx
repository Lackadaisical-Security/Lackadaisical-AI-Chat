import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  FolderOpen,
  File,
  FilePlus,
  FolderPlus,
  Save,
  Play,
  Terminal as TerminalIcon,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Settings,
  Download,
  Upload,
  Trash2,
  Copy,
  RefreshCw,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  LayoutGrid,
  FileCode,
  Bug,
  GitBranch,
  Package,
} from 'lucide-react';
import Button from '../ui/Button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
  isOpen?: boolean;
  path: string;
}

interface EditorTab {
  id: string;
  fileId: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
  isActive: boolean;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

// ─── Language detection ─────────────────────────────────────────────────────

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.rb': 'ruby', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
  '.cs': 'csharp', '.go': 'go', '.rs': 'rust', '.swift': 'swift', '.kt': 'kotlin',
  '.php': 'php', '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.sql': 'sql', '.sh': 'shell', '.bash': 'shell', '.ps1': 'powershell',
  '.yaml': 'yaml', '.yml': 'yaml', '.json': 'json', '.xml': 'xml',
  '.toml': 'toml', '.ini': 'ini', '.md': 'markdown', '.txt': 'plaintext',
  '.dockerfile': 'dockerfile', '.r': 'r', '.lua': 'lua', '.pl': 'perl',
  '.scala': 'scala', '.hs': 'haskell', '.ex': 'elixir', '.dart': 'dart',
  '.vue': 'html', '.svelte': 'html', '.graphql': 'graphql',
};

function getLanguageFromFilename(filename: string): string {
  const ext = '.' + (filename.split('.').pop() || '').toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Default workspace ──────────────────────────────────────────────────────

const DEFAULT_WORKSPACE: FileNode[] = [
  {
    id: 'src', name: 'src', type: 'folder', path: '/src', isOpen: true,
    children: [
      {
        id: 'src-index', name: 'index.ts', type: 'file', path: '/src/index.ts',
        content: '// Welcome to Lackadaisical IDE\n// Start coding here!\n\nconsole.log("Hello, World!");\n',
        language: 'typescript',
      },
      {
        id: 'src-app', name: 'app.ts', type: 'file', path: '/src/app.ts',
        content: 'import express from "express";\n\nconst app = express();\nconst port = 3000;\n\napp.get("/", (req, res) => {\n  res.send("Hello World!");\n});\n\napp.listen(port, () => {\n  console.log(`Server running at http://localhost:${port}`);\n});\n',
        language: 'typescript',
      },
      {
        id: 'src-utils', name: 'utils', type: 'folder', path: '/src/utils', isOpen: false,
        children: [
          {
            id: 'src-utils-helpers', name: 'helpers.ts', type: 'file', path: '/src/utils/helpers.ts',
            content: '/**\n * Utility helper functions\n */\n\nexport function capitalize(str: string): string {\n  return str.charAt(0).toUpperCase() + str.slice(1);\n}\n\nexport function sleep(ms: number): Promise<void> {\n  return new Promise(resolve => setTimeout(resolve, ms));\n}\n',
            language: 'typescript',
          },
        ],
      },
    ],
  },
  {
    id: 'pkg', name: 'package.json', type: 'file', path: '/package.json',
    content: '{\n  "name": "my-project",\n  "version": "1.0.0",\n  "description": "A new project",\n  "main": "src/index.ts",\n  "scripts": {\n    "start": "ts-node src/index.ts",\n    "build": "tsc",\n    "test": "jest"\n  }\n}\n',
    language: 'json',
  },
  {
    id: 'readme', name: 'README.md', type: 'file', path: '/README.md',
    content: '# My Project\n\nCreated with Lackadaisical IDE\n\n## Getting Started\n\n```bash\nnpm install\nnpm start\n```\n',
    language: 'markdown',
  },
];

// ─── File Explorer Component ────────────────────────────────────────────────

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onCreateFile: (parentPath: string, name: string) => void;
  onCreateFolder: (parentPath: string, name: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onToggleFolder: (folderId: string) => void;
  activeFileId: string | null;
}

const FileExplorerNode: React.FC<{
  node: FileNode;
  depth: number;
  onFileSelect: (file: FileNode) => void;
  onToggleFolder: (folderId: string) => void;
  onDeleteFile: (fileId: string) => void;
  activeFileId: string | null;
}> = ({ node, depth, onFileSelect, onToggleFolder, onDeleteFile, activeFileId }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleClick = () => {
    if (node.type === 'folder') {
      onToggleFolder(node.id);
    } else {
      onFileSelect(node);
    }
  };

  const isActive = node.id === activeFileId;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-sm hover:bg-base-300 group ${
          isActive ? 'bg-primary/10 text-primary' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(!showContextMenu);
        }}
      >
        {node.type === 'folder' ? (
          <>
            {node.isOpen ? (
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
            )}
            <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-error transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFile(node.id);
          }}
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {node.type === 'folder' && node.isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileExplorerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              onToggleFolder={onToggleFolder}
              onDeleteFile={onDeleteFile}
              activeFileId={activeFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onToggleFolder,
  activeFileId,
}) => {
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = () => {
    if (!newItemName.trim()) return;
    if (isCreating === 'file') {
      onCreateFile('/', newItemName.trim());
    } else if (isCreating === 'folder') {
      onCreateFolder('/', newItemName.trim());
    }
    setNewItemName('');
    setIsCreating(null);
  };

  return (
    <div className="h-full flex flex-col bg-base-200 border-r border-base-300">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-300">
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/70">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating('file')}
            className="p-1 hover:bg-base-300 rounded"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsCreating('folder')}
            className="p-1 hover:bg-base-300 rounded"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-base-300 rounded text-xs">
          <Search className="w-3 h-3 text-base-content/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="bg-transparent outline-none flex-1 text-xs"
          />
        </div>
      </div>

      {/* New item input */}
      {isCreating && (
        <div className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              placeholder={`New ${isCreating}...`}
              className="flex-1 px-2 py-1 text-xs bg-base-300 border border-primary rounded outline-none"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {files.map((node) => (
          <FileExplorerNode
            key={node.id}
            node={node}
            depth={0}
            onFileSelect={onFileSelect}
            onToggleFolder={onToggleFolder}
            onDeleteFile={onDeleteFile}
            activeFileId={activeFileId}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Terminal Component ─────────────────────────────────────────────────────

interface TerminalPanelProps {
  lines: TerminalLine[];
  onCommand: (command: string) => void;
  isVisible: boolean;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ lines, onCommand, isVisible }) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setCommandHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);
    onCommand(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="flex flex-col bg-gray-900 text-green-400 font-mono text-xs"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 border-b border-gray-700">
        <TerminalIcon className="w-3 h-3" />
        <span className="text-xs text-gray-400">Terminal</span>
      </div>

      {/* Terminal output */}
      <div className="flex-1 overflow-y-auto p-2 min-h-[120px] max-h-[300px]">
        {lines.map((line) => (
          <div
            key={line.id}
            className={`${
              line.type === 'error'
                ? 'text-red-400'
                : line.type === 'system'
                ? 'text-blue-400'
                : line.type === 'input'
                ? 'text-white'
                : 'text-green-400'
            }`}
          >
            {line.type === 'input' && <span className="text-cyan-400">$ </span>}
            {line.content}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal input */}
      <div className="flex items-center px-2 py-1 border-t border-gray-700">
        <span className="text-cyan-400 mr-1">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-white text-xs"
          placeholder="Type a command..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};

// ─── Main IDE Workspace ─────────────────────────────────────────────────────

const IDEWorkspace: React.FC = () => {
  // State
  const [files, setFiles] = useState<FileNode[]>(DEFAULT_WORKSPACE);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'system',
      content: 'Welcome to Lackadaisical IDE Terminal. Type "help" for available commands.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs' | 'hc-black'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [showSettings, setShowSettings] = useState(false);
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ─── File operations ────────────────────────────────────────────────

  const findFileById = useCallback(
    (nodes: FileNode[], id: string): FileNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findFileById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  const openFile = useCallback(
    (file: FileNode) => {
      if (file.type !== 'file') return;

      // Check if already open
      const existingTab = tabs.find((t) => t.fileId === file.id);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }

      const newTab: EditorTab = {
        id: generateId(),
        fileId: file.id,
        name: file.name,
        path: file.path,
        content: file.content || '',
        language: file.language || getLanguageFromFilename(file.name),
        isDirty: false,
        isActive: true,
      };

      setTabs((prev) => [...prev.map((t) => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTab.id);
    },
    [tabs]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId && filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else if (filtered.length === 0) {
          setActiveTabId(null);
        }
        return filtered;
      });
    },
    [activeTabId]
  );

  const updateFileContent = useCallback(
    (nodes: FileNode[], fileId: string, content: string): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === fileId) {
          return { ...node, content };
        }
        if (node.children) {
          return { ...node, children: updateFileContent(node.children, fileId, content) };
        }
        return node;
      });
    },
    []
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;

      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, content: value, isDirty: true } : t))
      );
    },
    [activeTab]
  );

  const saveCurrentFile = useCallback(() => {
    if (!activeTab) return;

    setFiles((prev) => updateFileContent(prev, activeTab.fileId, activeTab.content));
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t)));

    addTerminalLine('system', `File saved: ${activeTab.path}`);
  }, [activeTab, updateFileContent]);

  const handleSaveShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      }
    },
    [saveCurrentFile]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [handleSaveShortcut]);

  // ─── File CRUD ──────────────────────────────────────────────────────

  const createFile = useCallback((parentPath: string, name: string) => {
    const newFile: FileNode = {
      id: generateId(),
      name,
      type: 'file',
      path: `${parentPath === '/' ? '' : parentPath}/${name}`,
      content: '',
      language: getLanguageFromFilename(name),
    };

    setFiles((prev) => {
      if (parentPath === '/') {
        return [...prev, newFile];
      }
      // Add to specific folder
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === 'folder' && node.path === parentPath) {
            return { ...node, children: [...(node.children || []), newFile], isOpen: true };
          }
          if (node.children) {
            return { ...node, children: addToFolder(node.children) };
          }
          return node;
        });
      return addToFolder(prev);
    });

    addTerminalLine('system', `Created file: ${newFile.path}`);
  }, []);

  const createFolder = useCallback((parentPath: string, name: string) => {
    const newFolder: FileNode = {
      id: generateId(),
      name,
      type: 'folder',
      path: `${parentPath === '/' ? '' : parentPath}/${name}`,
      children: [],
      isOpen: true,
    };

    setFiles((prev) => {
      if (parentPath === '/') {
        return [...prev, newFolder];
      }
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === 'folder' && node.path === parentPath) {
            return { ...node, children: [...(node.children || []), newFolder], isOpen: true };
          }
          if (node.children) {
            return { ...node, children: addToFolder(node.children) };
          }
          return node;
        });
      return addToFolder(prev);
    });

    addTerminalLine('system', `Created folder: ${newFolder.path}`);
  }, []);

  const deleteFile = useCallback(
    (fileId: string) => {
      const removeNode = (nodes: FileNode[]): FileNode[] =>
        nodes
          .filter((n) => n.id !== fileId)
          .map((n) =>
            n.children ? { ...n, children: removeNode(n.children) } : n
          );

      setFiles((prev) => removeNode(prev));

      // Close any open tabs for this file
      setTabs((prev) => prev.filter((t) => t.fileId !== fileId));

      addTerminalLine('system', `Deleted item`);
    },
    []
  );

  const renameFile = useCallback((fileId: string, newName: string) => {
    const updateName = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => {
        if (n.id === fileId) {
          const parentPath = n.path.split('/').slice(0, -1).join('/') || '/';
          return {
            ...n,
            name: newName,
            path: `${parentPath === '/' ? '' : parentPath}/${newName}`,
            language: n.type === 'file' ? getLanguageFromFilename(newName) : n.language,
          };
        }
        if (n.children) {
          return { ...n, children: updateName(n.children) };
        }
        return n;
      });
    setFiles((prev) => updateName(prev));
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    const toggle = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => {
        if (n.id === folderId) {
          return { ...n, isOpen: !n.isOpen };
        }
        if (n.children) {
          return { ...n, children: toggle(n.children) };
        }
        return n;
      });
    setFiles((prev) => toggle(prev));
  }, []);

  // ─── Terminal commands ──────────────────────────────────────────────

  const addTerminalLine = (type: TerminalLine['type'], content: string) => {
    setTerminalLines((prev) => [
      ...prev,
      { id: generateId(), type, content, timestamp: new Date().toISOString() },
    ]);
  };

  const handleTerminalCommand = useCallback(
    (command: string) => {
      addTerminalLine('input', command);
      const parts = command.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case 'help':
          addTerminalLine('output', 'Available commands:');
          addTerminalLine('output', '  help          - Show this help');
          addTerminalLine('output', '  ls            - List files');
          addTerminalLine('output', '  cat <file>    - Display file contents');
          addTerminalLine('output', '  touch <file>  - Create a new file');
          addTerminalLine('output', '  mkdir <name>  - Create a new folder');
          addTerminalLine('output', '  rm <file>     - Delete a file');
          addTerminalLine('output', '  clear         - Clear terminal');
          addTerminalLine('output', '  echo <text>   - Echo text');
          addTerminalLine('output', '  date          - Show current date/time');
          addTerminalLine('output', '  pwd           - Print working directory');
          addTerminalLine('output', '  run           - Run current file (simulated)');
          addTerminalLine('output', '  theme <name>  - Switch editor theme (vs-dark/vs/hc-black)');
          addTerminalLine('output', '  export        - Export workspace as JSON');
          break;

        case 'ls': {
          const listFiles = (nodes: FileNode[], prefix = ''): void => {
            for (const node of nodes) {
              const icon = node.type === 'folder' ? '📁' : '📄';
              addTerminalLine('output', `${prefix}${icon} ${node.name}`);
              if (node.type === 'folder' && node.children) {
                listFiles(node.children, prefix + '  ');
              }
            }
          };
          listFiles(files);
          break;
        }

        case 'cat': {
          if (!args[0]) {
            addTerminalLine('error', 'Usage: cat <filename>');
            break;
          }
          const findFile = (nodes: FileNode[]): FileNode | null => {
            for (const n of nodes) {
              if (n.type === 'file' && n.name === args[0]) return n;
              if (n.children) {
                const found = findFile(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const file = findFile(files);
          if (file) {
            addTerminalLine('output', file.content || '(empty file)');
          } else {
            addTerminalLine('error', `File not found: ${args[0]}`);
          }
          break;
        }

        case 'touch':
          if (!args[0]) {
            addTerminalLine('error', 'Usage: touch <filename>');
          } else {
            createFile('/', args[0]);
          }
          break;

        case 'mkdir':
          if (!args[0]) {
            addTerminalLine('error', 'Usage: mkdir <foldername>');
          } else {
            createFolder('/', args[0]);
          }
          break;

        case 'rm': {
          if (!args[0]) {
            addTerminalLine('error', 'Usage: rm <filename>');
            break;
          }
          const findToDelete = (nodes: FileNode[]): string | null => {
            for (const n of nodes) {
              if (n.name === args[0]) return n.id;
              if (n.children) {
                const found = findToDelete(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const id = findToDelete(files);
          if (id) {
            deleteFile(id);
          } else {
            addTerminalLine('error', `Not found: ${args[0]}`);
          }
          break;
        }

        case 'clear':
          setTerminalLines([]);
          break;

        case 'echo':
          addTerminalLine('output', args.join(' '));
          break;

        case 'date':
          addTerminalLine('output', new Date().toLocaleString());
          break;

        case 'pwd':
          addTerminalLine('output', '/workspace');
          break;

        case 'run':
          if (activeTab) {
            addTerminalLine('system', `Running ${activeTab.name}...`);
            try {
              // Simulate running by evaluating if JS/TS
              if (['javascript', 'typescript'].includes(activeTab.language)) {
                addTerminalLine('output', `[Executed ${activeTab.name}]`);
                // Capture console.log output
                const logs: string[] = [];
                const originalLog = console.log;
                console.log = (...logArgs: unknown[]) => {
                  logs.push(logArgs.map(String).join(' '));
                };
                try {
                  // Only execute safe, simple code in a sandboxed way
                  const safeCode = activeTab.content
                    .replace(/import\s+.*?from\s+['"].*?['"]/g, '// import removed')
                    .replace(/export\s+/g, '');
                  new Function(safeCode)();
                } catch (runErr: unknown) {
                  const errorMessage = runErr instanceof Error ? runErr.message : String(runErr);
                  addTerminalLine('error', `Runtime error: ${errorMessage}`);
                }
                console.log = originalLog;
                logs.forEach((log) => addTerminalLine('output', log));
              } else {
                addTerminalLine('output', `[${activeTab.language}] Execution simulated for ${activeTab.name}`);
              }
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              addTerminalLine('error', errorMessage);
            }
          } else {
            addTerminalLine('error', 'No file open to run');
          }
          break;

        case 'theme':
          if (args[0] && ['vs-dark', 'vs', 'hc-black'].includes(args[0])) {
            setEditorTheme(args[0] as 'vs-dark' | 'vs' | 'hc-black');
            addTerminalLine('system', `Editor theme set to: ${args[0]}`);
          } else {
            addTerminalLine('error', 'Usage: theme <vs-dark|vs|hc-black>');
          }
          break;

        case 'export': {
          const exportData = JSON.stringify(files, null, 2);
          const blob = new Blob([exportData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `workspace-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          addTerminalLine('system', 'Workspace exported');
          break;
        }

        default:
          addTerminalLine('error', `Command not found: ${cmd}. Type "help" for available commands.`);
      }
    },
    [files, activeTab, createFile, createFolder, deleteFile]
  );

  // ─── Import workspace ───────────────────────────────────────────────

  const handleImportWorkspace = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (Array.isArray(data)) {
            setFiles(data);
            setTabs([]);
            setActiveTabId(null);
            addTerminalLine('system', 'Workspace imported successfully');
          }
        } catch {
          addTerminalLine('error', 'Failed to import workspace: invalid JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // ─── Editor mount ───────────────────────────────────────────────────

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col h-screen bg-base-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-200 border-b border-base-300">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Lackadaisical IDE</span>

          <div className="h-4 w-px bg-base-300 mx-2" />

          <Button variant="ghost" size="sm" onClick={() => setShowExplorer(!showExplorer)} title="Toggle Explorer" className="p-1">
            <PanelLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTerminal(!showTerminal)} title="Toggle Terminal" className="p-1">
            <PanelBottom className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={saveCurrentFile} disabled={!activeTab?.isDirty} title="Save (Ctrl+S)" className="p-1">
            <Save className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleTerminalCommand('run')} disabled={!activeTab} title="Run" className="p-1">
            <Play className="w-4 h-4 text-success" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleImportWorkspace} title="Import Workspace" className="p-1">
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleTerminalCommand('export')} title="Export Workspace" className="p-1">
            <Download className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-base-300 mx-1" />

          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} title="Settings" className="p-1">
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                setIsFullscreen(true);
              } else {
                document.exitFullscreen();
                setIsFullscreen(false);
              }
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-2 bg-base-200 border-b border-base-300 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span>Theme:</span>
            <select
              value={editorTheme}
              onChange={(e) => setEditorTheme(e.target.value as typeof editorTheme)}
              className="select select-xs bg-base-300"
            >
              <option value="vs-dark">Dark</option>
              <option value="vs">Light</option>
              <option value="hc-black">High Contrast</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>Font Size:</span>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="input input-xs bg-base-300 w-16"
              min={10}
              max={24}
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Word Wrap:</span>
            <input
              type="checkbox"
              checked={wordWrap === 'on'}
              onChange={(e) => setWordWrap(e.target.checked ? 'on' : 'off')}
              className="checkbox checkbox-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Minimap:</span>
            <input
              type="checkbox"
              checked={showMinimap}
              onChange={(e) => setShowMinimap(e.target.checked)}
              className="checkbox checkbox-xs"
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        {showExplorer && (
          <div className="w-60 flex-shrink-0">
            <FileExplorer
              files={files}
              onFileSelect={openFile}
              onCreateFile={createFile}
              onCreateFolder={createFolder}
              onDeleteFile={deleteFile}
              onRenameFile={renameFile}
              onToggleFolder={toggleFolder}
              activeFileId={activeTab?.fileId || null}
            />
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center bg-base-200 border-b border-base-300 overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-base-300 min-w-0 ${
                  tab.id === activeTabId
                    ? 'bg-base-100 text-base-content border-b-2 border-b-primary'
                    : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <FileCode className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">
                  {tab.isDirty && '● '}
                  {tab.name}
                </span>
                <button
                  className="ml-1 p-0.5 hover:bg-base-300 rounded flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            {activeTab ? (
              <Editor
                height="100%"
                language={activeTab.language}
                value={activeTab.content}
                theme={editorTheme}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={{
                  fontSize,
                  fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
                  fontLigatures: true,
                  minimap: { enabled: showMinimap },
                  wordWrap,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: true, indentation: true },
                  suggest: { showKeywords: true, showSnippets: true },
                  tabSize: 2,
                  formatOnPaste: true,
                  formatOnType: true,
                  autoIndent: 'full',
                  folding: true,
                  foldingStrategy: 'indentation',
                  showFoldingControls: 'always',
                  padding: { top: 8, bottom: 8 },
                  renderWhitespace: 'selection',
                  links: true,
                  colorDecorators: true,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                <FileCode className="w-16 h-16 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No file open</h3>
                <p className="text-sm">Open a file from the explorer or create a new one</p>
                <div className="flex gap-2 mt-4">
                  <kbd className="kbd kbd-sm">Ctrl+S</kbd>
                  <span className="text-xs">Save</span>
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          {showTerminal && (
            <div className="border-t border-base-300">
              <TerminalPanel
                lines={terminalLines}
                onCommand={handleTerminalCommand}
                isVisible={showTerminal}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-primary text-primary-content text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            main
          </span>
          {activeTab && (
            <>
              <span>{activeTab.language}</span>
              <span>Ln {activeTab.content.split('\n').length}, Col 1</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Lackadaisical IDE v1.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default IDEWorkspace;
