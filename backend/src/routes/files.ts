/**
 * File upload and download routes
 * Handles multipart file uploads via multer, file serving, and code file downloads
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileUploadService } from '../services/FileUploadService';
import { codeBlockService } from '../services/CodeBlockService';
import { aiLogger } from '../utils/logger';

const router = Router();

// Configure multer for memory storage (buffer-based, no temp files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 5, // Max 5 files per request
  },
  fileFilter: (_req, file, cb) => {
    // Block executable files
    const blockedExtensions = ['.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr'];
    const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    if (blockedExtensions.includes(ext)) {
      cb(new Error(`File type ${ext} is not allowed`));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/v1/files/upload
 * Upload a file for the current chat session
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided. Use form field name "file".' });
      return;
    }

    const sessionId = (req.body?.session_id as string) || 'default';

    const uploadedFile = await fileUploadService.processUpload(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      sessionId
    );

    res.status(201).json({
      success: true,
      data: {
        id: uploadedFile.id,
        name: uploadedFile.originalName,
        size: uploadedFile.size,
        category: uploadedFile.category,
        mimeType: uploadedFile.mimeType,
        hasExtractedText: !!uploadedFile.extractedText,
        metadata: {
          lineCount: uploadedFile.metadata.lineCount,
          wordCount: uploadedFile.metadata.wordCount,
          language: uploadedFile.metadata.language,
        },
        downloadUrl: `/api/v1/files/download/${uploadedFile.id}`,
      },
    });
  } catch (error) {
    aiLogger.error('File upload failed:', error);
    if (error instanceof Error && error.message.includes('too large')) {
      res.status(413).json({ success: false, error: error.message });
    } else if (error instanceof Error && error.message.includes('not allowed')) {
      res.status(415).json({ success: false, error: error.message });
    } else if (error instanceof Error && error.message.includes('Unsupported')) {
      res.status(415).json({ success: false, error: error.message });
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/files/download/:fileId
 * Download a file by ID
 */
router.get('/download/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const file = fileUploadService.getFile(fileId);

  if (!file) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  const buffer = await fileUploadService.getFileBuffer(fileId);
  if (!buffer) {
    res.status(500).json({ success: false, error: 'Failed to read file' });
    return;
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
  res.setHeader('Content-Length', buffer.length.toString());
  res.send(buffer);
});

/**
 * GET /api/v1/files/:fileId
 * Get file metadata and extracted text
 */
router.get('/:fileId', (req: Request, res: Response) => {
  const { fileId } = req.params;
  const file = fileUploadService.getFile(fileId);

  if (!file) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: file.id,
      name: file.originalName,
      size: file.size,
      category: file.category,
      mimeType: file.mimeType,
      extractedText: file.extractedText,
      metadata: file.metadata,
      downloadUrl: `/api/v1/files/download/${file.id}`,
    },
  });
});

/**
 * GET /api/v1/files/session/:sessionId
 * Get all files for a session
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const files = fileUploadService.getSessionFiles(sessionId);

  res.json({
    success: true,
    data: {
      files: files.map(f => ({
        id: f.id,
        name: f.originalName,
        size: f.size,
        category: f.category,
        mimeType: f.mimeType,
        hasExtractedText: !!f.extractedText,
        uploadedAt: f.metadata.uploadedAt,
        downloadUrl: `/api/v1/files/download/${f.id}`,
      })),
      total: files.length,
    },
  });
});

/**
 * DELETE /api/v1/files/:fileId
 * Delete an uploaded file
 */
router.delete('/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const deleted = await fileUploadService.deleteFile(fileId);

  if (deleted) {
    res.json({ success: true, message: 'File deleted' });
  } else {
    res.status(404).json({ success: false, error: 'File not found' });
  }
});

/**
 * POST /api/v1/files/serve-code
 * Create a downloadable code file from content
 */
router.post('/serve-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, filename, sessionId } = req.body;

    if (!content || !filename) {
      res.status(400).json({
        success: false,
        error: 'content and filename are required',
      });
      return;
    }

    const served = await fileUploadService.createServedFile(
      content,
      filename,
      sessionId || 'default'
    );

    res.status(201).json({
      success: true,
      data: served,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /files/generate-document — Generate a downloadable document from content
 * Body: { content: string, filename: string, format: 'txt'|'md'|'json'|'csv'|'html'|'pdf', sessionId?: string }
 */
router.post('/generate-document', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, filename, format, sessionId } = req.body;

    if (!content || !filename || !format) {
      res.status(400).json({
        success: false,
        error: 'content, filename, and format are required',
      });
      return;
    }

    const validFormats = ['txt', 'md', 'json', 'csv', 'html', 'pdf'];
    if (!validFormats.includes(format)) {
      res.status(400).json({
        success: false,
        error: `Invalid format. Use: ${validFormats.join(', ')}`,
      });
      return;
    }

    const result = await fileUploadService.generateDocument(
      content,
      filename,
      format,
      sessionId || 'default'
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
