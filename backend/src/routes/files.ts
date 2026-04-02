/**
 * File upload and download routes
 * Handles multipart file uploads, file serving, and code file downloads
 */

import { Router, Request, Response, NextFunction } from 'express';
import { fileUploadService } from '../services/FileUploadService';
import { codeBlockService } from '../services/CodeBlockService';
import { aiLogger } from '../utils/logger';

const router = Router();

// Simple multipart parser for file uploads (no external dependency needed)
// Reads raw body and parses multipart/form-data
async function parseMultipartBody(req: Request): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
  fields: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      reject(new Error('No boundary found in Content-Type'));
      return;
    }

    const boundary = boundaryMatch[1];
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const bodyStr = body.toString('latin1');
        const parts = bodyStr.split(`--${boundary}`).slice(1, -1);

        let fileBuffer: Buffer | null = null;
        let filename = 'upload';
        let mimeType = 'application/octet-stream';
        const fields: Record<string, string> = {};

        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;

          const headers = part.substring(0, headerEnd);
          const content = part.substring(headerEnd + 4).replace(/\r\n$/, '');

          const nameMatch = headers.match(/name="([^"]+)"/);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          const typeMatch = headers.match(/Content-Type:\s*(\S+)/i);

          if (filenameMatch) {
            // This is a file part
            filename = filenameMatch[1];
            mimeType = typeMatch ? typeMatch[1] : 'application/octet-stream';

            // Get the raw bytes for the file content
            const headerBytes = Buffer.byteLength(
              bodyStr.substring(0, bodyStr.indexOf(content)),
              'latin1'
            );
            const contentStart = body.indexOf(Buffer.from('\r\n\r\n', 'latin1'), 
              body.indexOf(Buffer.from(headers.substring(0, 30), 'latin1'))) + 4;
            const contentEnd = body.indexOf(
              Buffer.from(`\r\n--${boundary}`, 'latin1'),
              contentStart
            );
            fileBuffer = body.subarray(contentStart, contentEnd);
          } else if (nameMatch) {
            // This is a form field
            fields[nameMatch[1]] = content.trim();
          }
        }

        if (!fileBuffer) {
          reject(new Error('No file found in upload'));
          return;
        }

        resolve({ buffer: fileBuffer, filename, mimeType, fields });
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/**
 * POST /api/v1/files/upload
 * Upload a file for the current chat session
 */
router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buffer, filename, mimeType, fields } = await parseMultipartBody(req);
    const sessionId = fields.session_id || 'default';

    const uploadedFile = await fileUploadService.processUpload(
      buffer,
      filename,
      mimeType,
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

export default router;
