/**
 * FileUploadService - Handles file upload, storage, readability extraction, and serving
 * Supports images, PDFs, text files, documents, and code files.
 * Provides content extraction for AI processing and file download endpoints.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { aiLogger } from '../utils/logger';

// Supported file types and their categories
const FILE_CATEGORIES: Record<string, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'],
  document: ['.pdf', '.doc', '.docx', '.rtf', '.odt'],
  text: ['.txt', '.md', '.markdown', '.rst', '.csv', '.tsv', '.log'],
  code: [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.java', '.c', '.cpp',
    '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.php', '.html',
    '.css', '.scss', '.sass', '.less', '.sql', '.sh', '.bash', '.zsh',
    '.ps1', '.yaml', '.yml', '.json', '.xml', '.toml', '.ini', '.conf',
    '.env', '.dockerfile', '.makefile', '.cmake',
  ],
  data: ['.json', '.xml', '.yaml', '.yml', '.csv', '.tsv'],
  archive: ['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'],
};

export interface UploadedFile {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: string;
  extension: string;
  storagePath: string;
  extractedText?: string;
  metadata: {
    uploadedAt: string;
    sessionId: string;
    checksum: string;
    lineCount?: number;
    wordCount?: number;
    language?: string;
  };
}

export interface FileExtractionResult {
  text: string;
  lineCount: number;
  wordCount: number;
  language?: string;
  isReadable: boolean;
}

// Maximum file sizes in bytes
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TEXT_EXTRACTION_SIZE = 10 * 1024 * 1024; // 10MB for text extraction

export class FileUploadService {
  private uploadDir: string;
  private serveDir: string;
  private fileRegistry: Map<string, UploadedFile> = new Map();

  constructor(baseDir?: string) {
    const base = baseDir || path.resolve(process.cwd(), 'uploads');
    this.uploadDir = path.join(base, 'files');
    this.serveDir = path.join(base, 'serve');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fsp.mkdir(this.uploadDir, { recursive: true });
      await fsp.mkdir(this.serveDir, { recursive: true });
      aiLogger.info('FileUploadService directories initialized', {
        uploadDir: this.uploadDir,
        serveDir: this.serveDir,
      });
    } catch (error) {
      aiLogger.error('Failed to create upload directories:', error);
    }
  }

  /**
   * Process an uploaded file (from multer or similar)
   */
  async processUpload(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    sessionId: string
  ): Promise<UploadedFile> {
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${fileBuffer.length} bytes (max ${MAX_FILE_SIZE} bytes)`);
    }

    // Generate unique ID and storage name
    const fileId = crypto.randomUUID();
    const ext = path.extname(originalName).toLowerCase();
    const storedName = `${fileId}${ext}`;
    const storagePath = path.resolve(this.uploadDir, storedName);

    // Prevent path traversal: ensure resolved path stays within uploadDir
    if (!storagePath.startsWith(path.resolve(this.uploadDir))) {
      throw new Error('Invalid filename: path traversal detected');
    }

    // Determine category
    const category = this.getFileCategory(ext);

    // Validate file type
    if (category === 'unknown') {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Write file to disk
    await fsp.writeFile(storagePath, fileBuffer);

    // Extract text content if applicable
    let extractedText: string | undefined;
    let lineCount: number | undefined;
    let wordCount: number | undefined;
    let language: string | undefined;

    if (category === 'text' || category === 'code' || category === 'data') {
      try {
        const extraction = await this.extractTextContent(fileBuffer, ext);
        extractedText = extraction.text;
        lineCount = extraction.lineCount;
        wordCount = extraction.wordCount;
        language = extraction.language;
      } catch (error) {
        aiLogger.warn(`Text extraction failed for ${originalName}:`, error);
      }
    }

    // Handle ZIP archives — extract contents and aggregate text
    if (category === 'archive' && ext === '.zip') {
      try {
        const zipResult = await this.extractZipContents(fileBuffer, sessionId);
        extractedText = zipResult.aggregatedText;
        lineCount = zipResult.totalLines;
        wordCount = zipResult.totalWords;
      } catch (error) {
        aiLogger.warn(`ZIP extraction failed for ${originalName}:`, error);
      }
    }

    const uploadedFile: UploadedFile = {
      id: fileId,
      originalName,
      storedName,
      mimeType,
      size: fileBuffer.length,
      category,
      extension: ext,
      storagePath,
      extractedText,
      metadata: {
        uploadedAt: new Date().toISOString(),
        sessionId,
        checksum,
        lineCount,
        wordCount,
        language,
      },
    };

    this.fileRegistry.set(fileId, uploadedFile);
    aiLogger.info('File uploaded successfully', {
      id: fileId,
      name: originalName,
      size: fileBuffer.length,
      category,
    });

    return uploadedFile;
  }

  /**
   * Extract text content from a file buffer
   */
  private async extractTextContent(buffer: Buffer, extension: string): Promise<FileExtractionResult> {
    if (buffer.length > MAX_TEXT_EXTRACTION_SIZE) {
      return {
        text: '[File too large for text extraction]',
        lineCount: 0,
        wordCount: 0,
        isReadable: false,
      };
    }

    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // Detect programming language from extension
    const languageMap: Record<string, string> = {
      '.js': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
      '.py': 'python', '.rb': 'ruby', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
      '.cs': 'csharp', '.go': 'go', '.rs': 'rust', '.swift': 'swift',
      '.kt': 'kotlin', '.php': 'php', '.html': 'html', '.css': 'css',
      '.sql': 'sql', '.sh': 'bash', '.yaml': 'yaml', '.yml': 'yaml',
      '.json': 'json', '.xml': 'xml', '.md': 'markdown', '.txt': 'plaintext',
    };

    return {
      text,
      lineCount: lines.length,
      wordCount: words.length,
      language: languageMap[extension],
      isReadable: true,
    };
  }

  /**
   * Get file category from extension
   */
  private getFileCategory(extension: string): string {
    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
      if (extensions.includes(extension.toLowerCase())) {
        return category;
      }
    }
    return 'unknown';
  }

  /**
   * Get an uploaded file by ID
   */
  getFile(fileId: string): UploadedFile | undefined {
    return this.fileRegistry.get(fileId);
  }

  /**
   * Get file buffer for download
   */
  async getFileBuffer(fileId: string): Promise<Buffer | null> {
    const file = this.fileRegistry.get(fileId);
    if (!file) return null;

    try {
      return await fsp.readFile(file.storagePath);
    } catch (error) {
      aiLogger.error(`Failed to read file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Create a downloadable code file from content
   */
  async createServedFile(
    content: string,
    filename: string,
    sessionId: string
  ): Promise<{
    id: string;
    filename: string;
    downloadUrl: string;
    size: number;
  }> {
    const fileId = crypto.randomUUID();
    const ext = path.extname(filename) || '.txt';
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${fileId}_${safeFilename}`;
    const filePath = path.resolve(this.serveDir, storedName);

    // Prevent path traversal: ensure resolved path stays within serveDir
    if (!filePath.startsWith(path.resolve(this.serveDir))) {
      throw new Error('Invalid filename: path traversal detected');
    }

    await fsp.writeFile(filePath, content, 'utf-8');

    const fileInfo: UploadedFile = {
      id: fileId,
      originalName: filename,
      storedName,
      mimeType: this.getMimeType(ext),
      size: Buffer.byteLength(content, 'utf-8'),
      category: this.getFileCategory(ext),
      extension: ext,
      storagePath: filePath,
      extractedText: content,
      metadata: {
        uploadedAt: new Date().toISOString(),
        sessionId,
        checksum: crypto.createHash('sha256').update(content).digest('hex'),
        lineCount: content.split('\n').length,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
      },
    };

    this.fileRegistry.set(fileId, fileInfo);

    return {
      id: fileId,
      filename: safeFilename,
      downloadUrl: `/api/v1/files/download/${fileId}`,
      size: fileInfo.size,
    };
  }

  /**
   * Get MIME type from extension
   */
  private getMimeType(extension: string): string {
    const mimeMap: Record<string, string> = {
      '.txt': 'text/plain', '.md': 'text/markdown', '.html': 'text/html',
      '.css': 'text/css', '.js': 'application/javascript', '.ts': 'text/typescript',
      '.json': 'application/json', '.xml': 'application/xml', '.csv': 'text/csv',
      '.py': 'text/x-python', '.rb': 'text/x-ruby', '.java': 'text/x-java',
      '.c': 'text/x-c', '.cpp': 'text/x-c++', '.go': 'text/x-go',
      '.rs': 'text/x-rust', '.sh': 'application/x-sh',
      '.yaml': 'text/yaml', '.yml': 'text/yaml',
      '.pdf': 'application/pdf', '.zip': 'application/zip',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    };
    return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const file = this.fileRegistry.get(fileId);
    if (!file) return false;

    try {
      await fsp.unlink(file.storagePath);
      this.fileRegistry.delete(fileId);
      return true;
    } catch (error) {
      aiLogger.error(`Failed to delete file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * Get files for a session
   */
  getSessionFiles(sessionId: string): UploadedFile[] {
    return Array.from(this.fileRegistry.values())
      .filter(f => f.metadata.sessionId === sessionId);
  }

  /**
   * Build a context string for the AI from uploaded files
   */
  buildFileContext(fileIds: string[]): string {
    let context = '';
    for (const fileId of fileIds) {
      const file = this.fileRegistry.get(fileId);
      if (!file || !file.extractedText) continue;

      context += `\n--- Attached File: ${file.originalName} ---\n`;
      context += `Type: ${file.category} | Size: ${this.formatSize(file.size)}`;
      if (file.metadata.language) {
        context += ` | Language: ${file.metadata.language}`;
      }
      context += '\n';

      // Limit extracted text length for context
      const maxChars = 10000;
      if (file.extractedText.length > maxChars) {
        context += file.extractedText.substring(0, maxChars);
        context += '\n... [truncated]\n';
      } else {
        context += file.extractedText;
      }
      context += '\n--- End File ---\n';
    }
    return context;
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Get the serve directory path
   */
  getServeDir(): string {
    return this.serveDir;
  }

  /**
   * Get the upload directory path
   */
  getUploadDir(): string {
    return this.uploadDir;
  }

  /**
   * Extract contents from a ZIP archive
   * Processes each entry, extracting text from readable files
   */
  async extractZipContents(
    zipBuffer: Buffer,
    sessionId: string
  ): Promise<{
    entries: Array<{ name: string; size: number; isDir: boolean; extractedText?: string }>;
    aggregatedText: string;
    totalLines: number;
    totalWords: number;
  }> {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    const results: Array<{ name: string; size: number; isDir: boolean; extractedText?: string }> = [];
    let aggregatedText = '';
    let totalLines = 0;
    let totalWords = 0;

    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        results.push({ name: entry.entryName, size: 0, isDir: true });
        continue;
      }

      const entryExt = path.extname(entry.entryName).toLowerCase();
      const entryCategory = this.getFileCategory(entryExt);
      const entryResult: { name: string; size: number; isDir: boolean; extractedText?: string } = {
        name: entry.entryName,
        size: entry.header.size,
        isDir: false,
      };

      // Extract text from readable files
      if (entryCategory === 'text' || entryCategory === 'code' || entryCategory === 'data') {
        try {
          const entryBuffer = entry.getData();
          if (entryBuffer.length <= MAX_TEXT_EXTRACTION_SIZE) {
            const extraction = await this.extractTextContent(entryBuffer, entryExt);
            entryResult.extractedText = extraction.text;
            aggregatedText += `\n--- ${entry.entryName} ---\n${extraction.text}\n`;
            totalLines += extraction.lineCount;
            totalWords += extraction.wordCount;
          }
        } catch {
          aiLogger.warn(`Failed to extract text from ZIP entry: ${entry.entryName}`);
        }
      }

      results.push(entryResult);
    }

    aiLogger.info('ZIP extraction completed', {
      entries: results.length,
      readableEntries: results.filter(r => r.extractedText).length,
      totalLines,
      totalWords,
    });

    return { entries: results, aggregatedText, totalLines, totalWords };
  }

  /**
   * Generate a document from content and return it as a downloadable file
   * Supports: txt, md, json, csv, html, pdf
   */
  async generateDocument(
    content: string,
    filename: string,
    format: 'txt' | 'md' | 'json' | 'csv' | 'html' | 'pdf',
    sessionId: string
  ): Promise<{
    id: string;
    filename: string;
    downloadUrl: string;
    size: number;
    mimeType: string;
  }> {
    const fileId = crypto.randomUUID();
    let fileContent: Buffer;
    let mimeType: string;
    let finalFilename = filename;

    // Ensure correct extension
    const ext = path.extname(filename).toLowerCase();
    if (!ext || ext !== `.${format}`) {
      finalFilename = `${path.basename(filename, ext)}.${format}`;
    }

    switch (format) {
      case 'txt':
        fileContent = Buffer.from(content, 'utf-8');
        mimeType = 'text/plain';
        break;

      case 'md':
        fileContent = Buffer.from(content, 'utf-8');
        mimeType = 'text/markdown';
        break;

      case 'json':
        // Try to parse and pretty-print if it's valid JSON
        try {
          const parsed = JSON.parse(content);
          fileContent = Buffer.from(JSON.stringify(parsed, null, 2), 'utf-8');
        } catch {
          fileContent = Buffer.from(content, 'utf-8');
        }
        mimeType = 'application/json';
        break;

      case 'csv':
        fileContent = Buffer.from(content, 'utf-8');
        mimeType = 'text/csv';
        break;

      case 'html': {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(filename)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 2px; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
        fileContent = Buffer.from(htmlContent, 'utf-8');
        mimeType = 'text/html';
        break;
      }

      case 'pdf': {
        fileContent = await this.generatePDF(content, filename);
        mimeType = 'application/pdf';
        break;
      }

      default:
        fileContent = Buffer.from(content, 'utf-8');
        mimeType = 'application/octet-stream';
    }

    const safeFilename = finalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${fileId}_${safeFilename}`;
    const filePath = path.resolve(this.serveDir, storedName);

    if (!filePath.startsWith(path.resolve(this.serveDir))) {
      throw new Error('Invalid filename: path traversal detected');
    }

    await fsp.writeFile(filePath, fileContent);

    const fileInfo: UploadedFile = {
      id: fileId,
      originalName: finalFilename,
      storedName,
      mimeType,
      size: fileContent.length,
      category: 'document',
      extension: `.${format}`,
      storagePath: filePath,
      metadata: {
        uploadedAt: new Date().toISOString(),
        sessionId,
        checksum: crypto.createHash('sha256').update(fileContent).digest('hex'),
      },
    };

    this.fileRegistry.set(fileId, fileInfo);

    aiLogger.info('Document generated', { id: fileId, filename: finalFilename, format, size: fileContent.length });

    return {
      id: fileId,
      filename: finalFilename,
      downloadUrl: `/api/v1/files/download/${fileId}`,
      size: fileContent.length,
      mimeType,
    };
  }

  /**
   * Generate a PDF from text content using PDFKit
   */
  private async generatePDF(content: string, title: string): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica').fillColor('#888')
        .text(`Generated by Lackadaisical AI Chat — ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      // Content
      doc.fontSize(11).font('Helvetica').fillColor('#000');

      const lines = content.split('\n');
      for (const line of lines) {
        // Handle code blocks
        if (line.startsWith('```')) {
          doc.font('Courier').fontSize(9);
          continue;
        }
        // Handle headers
        if (line.startsWith('# ')) {
          doc.font('Helvetica-Bold').fontSize(16).text(line.replace(/^#+\s*/, ''));
          doc.moveDown(0.3);
          doc.font('Helvetica').fontSize(11);
          continue;
        }
        if (line.startsWith('## ')) {
          doc.font('Helvetica-Bold').fontSize(14).text(line.replace(/^#+\s*/, ''));
          doc.moveDown(0.3);
          doc.font('Helvetica').fontSize(11);
          continue;
        }
        if (line.startsWith('### ')) {
          doc.font('Helvetica-Bold').fontSize(12).text(line.replace(/^#+\s*/, ''));
          doc.moveDown(0.2);
          doc.font('Helvetica').fontSize(11);
          continue;
        }
        // Normal text
        doc.text(line || ' ');
      }

      doc.end();
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;
