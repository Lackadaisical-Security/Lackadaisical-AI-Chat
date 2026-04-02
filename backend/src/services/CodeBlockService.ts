/**
 * CodeBlockService - Extracts code blocks from AI responses and serves them as downloadable files
 * Detects language, provides syntax highlighting metadata, and creates served files.
 */

import { FileUploadService } from './FileUploadService';
import { aiLogger } from '../utils/logger';

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
  startIndex: number;
  endIndex: number;
}

export interface ProcessedResponse {
  content: string;
  codeBlocks: CodeBlock[];
  servedFiles: Array<{
    id: string;
    filename: string;
    downloadUrl: string;
    language: string;
    size: number;
  }>;
}

// Language to file extension mapping
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: '.js', typescript: '.ts', python: '.py', ruby: '.rb',
  java: '.java', c: '.c', cpp: '.cpp', 'c++': '.cpp', csharp: '.cs',
  'c#': '.cs', go: '.go', rust: '.rs', swift: '.swift', kotlin: '.kt',
  php: '.php', html: '.html', css: '.css', scss: '.scss', sass: '.sass',
  less: '.less', sql: '.sql', bash: '.sh', shell: '.sh', zsh: '.sh',
  powershell: '.ps1', yaml: '.yaml', yml: '.yaml', json: '.json',
  xml: '.xml', toml: '.toml', ini: '.ini', markdown: '.md', md: '.md',
  dockerfile: '.dockerfile', makefile: 'Makefile', cmake: '.cmake',
  jsx: '.jsx', tsx: '.tsx', vue: '.vue', svelte: '.svelte',
  graphql: '.graphql', proto: '.proto', r: '.r', matlab: '.m',
  lua: '.lua', perl: '.pl', scala: '.scala', haskell: '.hs',
  elixir: '.ex', erlang: '.erl', clojure: '.clj', dart: '.dart',
  assembly: '.asm', asm: '.asm', text: '.txt', txt: '.txt',
  plaintext: '.txt', plain: '.txt',
};

export class CodeBlockService {
  private fileUploadService: FileUploadService;

  constructor(fileUploadService?: FileUploadService) {
    this.fileUploadService = fileUploadService || new FileUploadService();
  }

  /**
   * Extract code blocks from markdown-formatted AI response text
   */
  extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = (match[1] || 'text').toLowerCase();
      const code = match[2] || '';

      if (code.trim().length === 0) continue;

      // Try to detect filename from first comment line
      let filename: string | undefined;
      const firstLine = code.split('\n')[0]?.trim() || '';
      
      // Check for filename patterns like: // filename.ts or # filename.py or /* filename.css */
      const filenamePatterns = [
        /^\/\/\s*(?:file|filename):\s*(.+)/i,
        /^#\s*(?:file|filename):\s*(.+)/i,
        /^\/\*\s*(?:file|filename):\s*(.+?)\s*\*\//i,
        /^\/\/\s*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)\s*$/,
        /^#\s*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)\s*$/,
      ];

      for (const pattern of filenamePatterns) {
        const fnMatch = firstLine.match(pattern);
        if (fnMatch) {
          filename = fnMatch[1]?.trim();
          break;
        }
      }

      // Generate filename if not detected
      if (!filename) {
        const ext = LANGUAGE_EXTENSIONS[language] || '.txt';
        filename = `code_${blockIndex + 1}${ext}`;
      }

      blocks.push({
        id: `block_${blockIndex}`,
        language,
        code: code.trim(),
        filename,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });

      blockIndex++;
    }

    return blocks;
  }

  /**
   * Process an AI response: extract code blocks and create served files
   */
  async processResponse(
    content: string,
    sessionId: string
  ): Promise<ProcessedResponse> {
    const codeBlocks = this.extractCodeBlocks(content);
    const servedFiles: ProcessedResponse['servedFiles'] = [];

    for (const block of codeBlocks) {
      try {
        const served = await this.fileUploadService.createServedFile(
          block.code,
          block.filename || `code_${block.id}.txt`,
          sessionId
        );

        servedFiles.push({
          id: served.id,
          filename: served.filename,
          downloadUrl: served.downloadUrl,
          language: block.language,
          size: served.size,
        });

        aiLogger.info('Code block served as file', {
          filename: served.filename,
          language: block.language,
          size: served.size,
        });
      } catch (error) {
        aiLogger.warn('Failed to serve code block as file:', error);
      }
    }

    return {
      content,
      codeBlocks,
      servedFiles,
    };
  }

  /**
   * Get the default file extension for a language
   */
  getExtensionForLanguage(language: string): string {
    return LANGUAGE_EXTENSIONS[language.toLowerCase()] || '.txt';
  }

  /**
   * Detect language from code content heuristics
   */
  detectLanguage(code: string): string {
    const lines = code.split('\n').slice(0, 20);
    const firstLines = lines.join('\n');

    // Language detection heuristics
    if (/^(import|from)\s+\w+/m.test(firstLines) && /def\s+\w+|class\s+\w+.*:/m.test(firstLines)) return 'python';
    if (/^import\s+{?\s*\w+|^export\s+(default\s+)?(function|class|const|let)/m.test(firstLines)) return 'typescript';
    if (/^(const|let|var|function)\s+\w+|require\(/m.test(firstLines)) return 'javascript';
    if (/^package\s+\w+|^import\s+"[\w/]+"/m.test(firstLines)) return 'go';
    if (/^use\s+\w+|^fn\s+\w+|^struct\s+\w+|^impl\s+/m.test(firstLines)) return 'rust';
    if (/^#include\s+[<"]/m.test(firstLines)) return 'cpp';
    if (/^(public|private|protected)\s+(class|interface|enum)/m.test(firstLines)) return 'java';
    if (/^(<!DOCTYPE|<html|<div|<script)/mi.test(firstLines)) return 'html';
    if (/^(body|\.[\w-]+|#[\w-]+)\s*\{/m.test(firstLines)) return 'css';
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/mi.test(firstLines)) return 'sql';
    if (/^#!/m.test(firstLines)) return 'bash';
    if (/^(apiVersion|kind):\s/m.test(firstLines)) return 'yaml';
    if (/^\s*\{[\s\n]*"/m.test(firstLines)) return 'json';

    return 'text';
  }
}

export const codeBlockService = new CodeBlockService();
export default codeBlockService;
