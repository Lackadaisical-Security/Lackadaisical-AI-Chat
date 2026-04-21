/**
 * ComfyUIService — Image generation via ComfyUI REST API
 *
 * Integrates with a local ComfyUI instance for Stable Diffusion image generation.
 * Supports:
 *   - Text-to-image generation with customizable parameters
 *   - Image-to-image workflows
 *   - Progress polling and async generation
 *   - Downloading generated images
 *
 * Prerequisites:
 *   - ComfyUI running at http://localhost:8188 (configurable)
 *   - Stable Diffusion model loaded in ComfyUI
 */

import axios, { AxiosInstance } from 'axios';
import { aiLogger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  model?: string;
  batchSize?: number;
}

export interface ImageGenerationResult {
  id: string;
  prompt: string;
  images: Array<{
    filename: string;
    subfolder: string;
    downloadUrl: string;
    localPath?: string;
  }>;
  seed: number;
  steps: number;
  width: number;
  height: number;
  model: string;
  generationTimeMs: number;
}

// Default ComfyUI text-to-image workflow
function buildText2ImgWorkflow(params: {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  seed: number;
  model: string;
  batchSize: number;
}): Record<string, unknown> {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: params.model,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: params.prompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: params.negativePrompt,
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: params.width,
        height: params.height,
        batch_size: params.batchSize,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: params.sampler,
        scheduler: params.scheduler,
        denoise: 1.0,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'lacky_gen',
        images: ['6', 0],
      },
    },
  };
}

export class ComfyUIService {
  private client: AxiosInstance;
  private baseUrl: string;
  private clientId: string;
  private outputDir: string;
  private isAvailable: boolean = false;

  constructor(options?: { host?: string; outputDir?: string }) {
    this.baseUrl = options?.host || process.env.COMFYUI_HOST || 'http://localhost:8188';
    this.outputDir = options?.outputDir || './uploads/generated';
    this.clientId = crypto.randomUUID();

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 min timeout for generation
      headers: { 'Content-Type': 'application/json' },
    });

    this.initOutputDir();
    this.checkAvailability();
    aiLogger.info('ComfyUIService initialized', { baseUrl: this.baseUrl });
  }

  private async initOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch {
      // Ignore if already exists
    }
  }

  /**
   * Check if ComfyUI is accessible
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.client.get('/system_stats', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      aiLogger.info('ComfyUI availability:', { available: this.isAvailable });
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      aiLogger.warn('ComfyUI is not available at', this.baseUrl);
      return false;
    }
  }

  /**
   * Generate images from a text prompt
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        throw new Error(
          `ComfyUI is not available at ${this.baseUrl}. ` +
          `Please ensure ComfyUI is running and accessible.`
        );
      }
    }

    const seed = request.seed ?? Math.floor(Math.random() * 2147483647);
    const width = request.width || 1024;
    const height = request.height || 1024;
    const steps = request.steps || 20;
    const cfg = request.cfg || 7.0;
    const sampler = request.sampler || 'euler';
    const scheduler = request.scheduler || 'normal';
    const model = request.model || 'sd_xl_base_1.0.safetensors';
    const batchSize = request.batchSize || 1;
    const negativePrompt = request.negativePrompt || 'low quality, blurry, deformed, ugly, distorted';

    // Build workflow
    const workflow = buildText2ImgWorkflow({
      prompt: request.prompt,
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
    });

    aiLogger.info('Generating image via ComfyUI:', {
      prompt: request.prompt.substring(0, 100),
      width,
      height,
      steps,
      model,
    });

    try {
      // Queue the prompt
      const queueResponse = await this.client.post('/prompt', {
        prompt: workflow,
        client_id: this.clientId,
      });

      const promptId = queueResponse.data.prompt_id;
      if (!promptId) {
        throw new Error('Failed to queue prompt — no prompt_id returned');
      }

      aiLogger.info('Image generation queued:', { promptId });

      // Poll for completion
      const images = await this.waitForCompletion(promptId);

      const generationTimeMs = Date.now() - startTime;

      const result: ImageGenerationResult = {
        id: promptId,
        prompt: request.prompt,
        images: images.map(img => ({
          filename: img.filename,
          subfolder: img.subfolder || '',
          downloadUrl: `/api/v1/files/generated/${promptId}/${img.filename}`,
        })),
        seed,
        steps,
        width,
        height,
        model,
        generationTimeMs,
      };

      // Download images to local storage
      for (let i = 0; i < result.images.length; i++) {
        try {
          const localPath = await this.downloadImage(
            result.images[i].filename,
            result.images[i].subfolder,
            promptId
          );
          result.images[i].localPath = localPath;
          result.images[i].downloadUrl = `/api/v1/files/download/${path.basename(localPath)}`;
        } catch (dlError) {
          aiLogger.warn('Failed to download generated image locally:', dlError);
        }
      }

      aiLogger.info('Image generation completed:', {
        promptId,
        imageCount: images.length,
        generationTimeMs,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      aiLogger.error('Image generation failed:', { error: msg });
      throw new Error(`Image generation failed: ${msg}`);
    }
  }

  /**
   * Poll ComfyUI /history endpoint until the prompt completes
   */
  private async waitForCompletion(
    promptId: string,
    timeoutMs: number = 300000,
    pollIntervalMs: number = 1000
  ): Promise<Array<{ filename: string; subfolder: string }>> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const historyResponse = await this.client.get(`/history/${promptId}`);
        const history = historyResponse.data;

        if (history[promptId]) {
          const promptResult = history[promptId];

          // Check if there are outputs
          if (promptResult.outputs) {
            const images: Array<{ filename: string; subfolder: string }> = [];

            for (const nodeId of Object.keys(promptResult.outputs)) {
              const nodeOutput = promptResult.outputs[nodeId];
              if (nodeOutput.images) {
                for (const img of nodeOutput.images) {
                  images.push({
                    filename: img.filename,
                    subfolder: img.subfolder || '',
                  });
                }
              }
            }

            if (images.length > 0) {
              return images;
            }
          }

          // Check for status (if available)
          if (promptResult.status?.completed) {
            return [];
          }
        }
      } catch {
        // History endpoint may return 404 while still processing
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Image generation timed out after ${timeoutMs}ms`);
  }

  /**
   * Download a generated image from ComfyUI to local storage
   */
  private async downloadImage(
    filename: string,
    subfolder: string,
    promptId: string
  ): Promise<string> {
    const params = new URLSearchParams({ filename });
    if (subfolder) params.append('subfolder', subfolder);
    params.append('type', 'output');

    const response = await this.client.get(`/view?${params.toString()}`, {
      responseType: 'arraybuffer',
    });

    const safeFilename = `${promptId}_${filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = path.join(this.outputDir, safeFilename);
    await fs.writeFile(localPath, Buffer.from(response.data));

    return localPath;
  }

  /**
   * Get available models from ComfyUI
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/object_info/CheckpointLoaderSimple');
      const info = response.data?.CheckpointLoaderSimple;
      if (info?.input?.required?.ckpt_name) {
        return info.input.required.ckpt_name[0] || [];
      }
      return [];
    } catch {
      aiLogger.warn('Failed to get ComfyUI models');
      return [];
    }
  }

  /**
   * Get available samplers
   */
  async getSamplers(): Promise<string[]> {
    try {
      const response = await this.client.get('/object_info/KSampler');
      const info = response.data?.KSampler;
      if (info?.input?.required?.sampler_name) {
        return info.input.required.sampler_name[0] || [];
      }
      return [];
    } catch {
      return ['euler', 'euler_ancestral', 'dpm_2', 'dpm_2_ancestral', 'dpmpp_2s_ancestral', 'dpmpp_2m', 'dpmpp_sde'];
    }
  }

  /**
   * Check if image generation is available
   */
  getIsAvailable(): boolean {
    return this.isAvailable;
  }
}

export const comfyUIService = new ComfyUIService();
export default comfyUIService;
