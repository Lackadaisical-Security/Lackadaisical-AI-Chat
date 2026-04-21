/**
 * Image Generation Routes — REST API for ComfyUI-powered image generation
 *
 * Provides endpoints to generate images, check status, list models/samplers.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { comfyUIService } from '../services/ComfyUIService';
import { fileUploadService } from '../services/FileUploadService';
import { aiLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
router.use(endpointRateLimiter('chat'));

/**
 * POST /api/v1/image/generate — Generate an image from a text prompt
 * Body: { prompt, negativePrompt?, width?, height?, steps?, cfg?, sampler?, seed?, model?, batchSize? }
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const {
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    cfg,
    sampler,
    scheduler,
    seed,
    model,
    batchSize,
    sessionId,
  } = req.body;

  if (!prompt) {
    res.status(400).json({ success: false, error: 'prompt is required' });
    return;
  }

  const result = await comfyUIService.generateImage({
    prompt,
    negativePrompt,
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    steps: steps ? Number(steps) : undefined,
    cfg: cfg ? Number(cfg) : undefined,
    sampler,
    scheduler,
    seed: seed ? Number(seed) : undefined,
    model,
    batchSize: batchSize ? Number(batchSize) : undefined,
  });

  // Register generated images with the file upload service for download
  for (const img of result.images) {
    if (img.localPath) {
      try {
        const buffer = await fs.readFile(img.localPath);
        const uploaded = await fileUploadService.processUpload(
          buffer,
          img.filename,
          'image/png',
          sessionId || 'default'
        );
        img.downloadUrl = `/api/v1/files/download/${uploaded.id}`;
      } catch (err) {
        aiLogger.warn('Failed to register generated image:', err);
      }
    }
  }

  res.json({
    success: true,
    data: result,
    message: `Generated ${result.images.length} image(s) in ${result.generationTimeMs}ms`,
  });
}));

/**
 * GET /api/v1/image/models — List available Stable Diffusion models
 */
router.get('/models', asyncHandler(async (_req: Request, res: Response) => {
  const models = await comfyUIService.getModels();
  res.json({ success: true, data: { models } });
}));

/**
 * GET /api/v1/image/samplers — List available samplers
 */
router.get('/samplers', asyncHandler(async (_req: Request, res: Response) => {
  const samplers = await comfyUIService.getSamplers();
  res.json({ success: true, data: { samplers } });
}));

/**
 * GET /api/v1/image/status — Check if ComfyUI is available
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const available = await comfyUIService.checkAvailability();
  res.json({
    success: true,
    data: { available, host: process.env.COMFYUI_HOST || 'http://localhost:8188' },
  });
}));

export default router;
