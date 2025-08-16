import { Worker } from 'worker_threads';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import type { ComfyUIJobProgressData, ComfyUIStatus } from '@shared/types/comfyui';
import { TIMING_CONFIG } from '../../shared/utils/constants';
import { MemorialCardService, type MemorialCardConfig } from './memorial-card-service';

interface ComfyUIJobRequest {
  imageData: string;
  datetime: string;
  resultDir: string;
}

interface ComfyUIConfig {
  baseUrl: string;
  pollingInterval: number;
  maxConcurrentJobs: number;
  timeouts: {
    upload: number;
    processing: number;
    queue: number;
  };
  retry: {
    maxAttempts: number;
    delayMs: number;
  };
  workflow: {
    templatePath: string;
    outputPrefix: string;
  };
}

export class ComfyUIService {
  private worker: Worker | null = null;
  private config: ComfyUIConfig;
  private mainWindow: BrowserWindow | null = null;
  private activeJobs = new Map<string, {
    datetime: string;
    resultDir: string;
    status: 'queued' | 'processing' | 'completed' | 'error';
    startTime: number;
  }>();
  private preUploadedImages = new Map<string, string>(); // datetime -> uploaded filename
  private memorialCardService: MemorialCardService | null = null;

  constructor(config: ComfyUIConfig, memorialCardConfig?: MemorialCardConfig, mainWindow?: BrowserWindow) {
    this.config = config;
    this.mainWindow = mainWindow || null;
    
    // 記念カードサービスの初期化
    if (memorialCardConfig) {
      this.memorialCardService = new MemorialCardService(memorialCardConfig, mainWindow);
    }
  }

  async initialize(): Promise<void> {
    try {
      const workerPath = path.join(__dirname, '..', 'workers', 'comfyui-worker.js');
      this.worker = new Worker(workerPath);

      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });

      this.worker.on('error', (error) => {
        console.error('ComfyUI Worker Error:', error);
        this.sendToRenderer('comfyui-error', { 
          message: `Worker Error: ${error.message}` 
        });
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`ComfyUI Worker stopped with exit code ${code}`);
        }
      });

      this.worker.postMessage({
        type: 'init',
        data: { config: this.config }
      });

      await this.waitForReady();
      console.log('ComfyUI Service initialized successfully');

    } catch (error) {
      throw new Error(`ComfyUI Service initialization failed: ${error}`);
    }
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 10000);

      const messageHandler = (message: { type: string }) => {
        if (message.type === 'ready') {
          clearTimeout(timeout);
          this.worker?.off('message', messageHandler);
          resolve();
        }
      };

      this.worker.on('message', messageHandler);
    });
  }

  private handleWorkerMessage(message: { type: string; data: ComfyUIJobProgressData | ComfyUIStatus | { message: string; isHealthy?: boolean; datetime?: string; uploadedFilename?: string; error?: string } }): void {
    const { type, data } = message;

    switch (type) {
      case 'ready':
        console.log('ComfyUI Worker is ready');
        break;

      case 'pre-upload-completed':
        console.log('ComfyUI Pre-upload completed:', data);
        break;

      case 'job-queued':
        this.updateJobStatus((data as ComfyUIJobProgressData).jobId, 'queued');
        this.sendToRenderer('comfyui-job-queued', data);
        break;

      case 'job-started':
        this.updateJobStatus((data as ComfyUIJobProgressData).jobId, 'processing');
        this.sendToRenderer('comfyui-job-started', data);
        break;

      case 'job-processing':
        this.sendToRenderer('comfyui-job-processing', data);
        break;

      case 'job-queue-update':
        this.sendToRenderer('comfyui-job-queue-update', data);
        break;

      case 'job-completed': {
        this.updateJobStatus((data as ComfyUIJobProgressData).jobId, 'completed');
        this.sendToRenderer('comfyui-job-completed', data);
        
        // 記念カード生成をトリガー
        const jobData = data as ComfyUIJobProgressData;
        const job = this.activeJobs.get(jobData.jobId);
        if (job && this.memorialCardService) {
          console.log(`ComfyUIService - Triggering memorial card generation for: ${jobData.jobId}`);
          // 非同期で記念カード生成を実行（ComfyUIの処理をブロックしない）
          this.memorialCardService.handleComfyUICompletion(jobData.jobId, job.resultDir)
            .catch(error => {
              console.error('ComfyUIService - Memorial card generation error:', error);
            });
        }
        break;
      }

      case 'job-error':
        this.updateJobStatus((data as ComfyUIJobProgressData).jobId, 'error');
        this.sendToRenderer('comfyui-job-error', data);
        break;

      case 'job-canceled':
        this.updateJobStatus((data as ComfyUIJobProgressData).jobId, 'error'); // canceledをerrorとして扱う
        this.sendToRenderer('comfyui-job-canceled', data);
        console.log('ComfyUIService - Job canceled:', (data as ComfyUIJobProgressData).jobId);
        break;

      case 'status':
        this.sendToRenderer('comfyui-status', data);
        break;

      case 'health-check-result':
        this.sendToRenderer('comfyui-health-check', data);
        break;

      case 'error':
        console.error('ComfyUI Worker Error:', data);
        this.sendToRenderer('comfyui-error', data);
        break;

      default:
        console.warn('Unknown worker message type:', type);
    }
  }

  private updateJobStatus(jobId: string, status: 'queued' | 'processing' | 'completed' | 'error'): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = status;
    }
  }

  private sendToRenderer(channel: string, data: ComfyUIJobProgressData | ComfyUIStatus | { message: string; isHealthy?: boolean }): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  async preUploadImage(imageData: string, datetime: string): Promise<string> {
    if (!this.worker) {
      throw new Error('ComfyUI Service not initialized');
    }

    console.log(`ComfyUI Service - Pre-uploading image for datetime: ${datetime}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Pre-upload timeout'));
      }, this.config.timeouts.upload);

      const messageHandler = (message: { type: string; data: { datetime: string; uploadedFilename?: string; error?: string } }) => {
        if (message.type === 'pre-upload-completed' && message.data.datetime === datetime) {
          clearTimeout(timeout);
          this.worker?.off('message', messageHandler);
          
          if (message.data.uploadedFilename) {
            this.preUploadedImages.set(datetime, message.data.uploadedFilename);
            console.log(`ComfyUI Service - Pre-upload completed: ${message.data.uploadedFilename} for ${datetime}`);
            resolve(message.data.uploadedFilename);
          } else {
            reject(new Error(message.data.error || 'Pre-upload failed'));
          }
        }
      };

      this.worker?.on('message', messageHandler);
      this.worker?.postMessage({
        type: 'pre-upload-image',
        data: {
          imageData,
          datetime
        }
      });
    });
  }

  async transformImage(request: ComfyUIJobRequest): Promise<string> {
    if (!this.worker) {
      throw new Error('ComfyUI Service not initialized');
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`ComfyUI Service - Adding job: ${jobId} for datetime: ${request.datetime}`);
    
    this.activeJobs.set(request.datetime, {
      datetime: request.datetime,
      resultDir: request.resultDir,
      status: 'queued',
      startTime: Date.now()
    });

    const preUploadedFilename = this.preUploadedImages.get(request.datetime);
    console.log(`ComfyUI Service - Looking for pre-uploaded file for datetime: ${request.datetime}`);
    console.log(`ComfyUI Service - Available pre-uploaded files:`, Array.from(this.preUploadedImages.keys()));
    console.log(`ComfyUI Service - Found pre-uploaded filename: ${preUploadedFilename}`);
    
    this.worker.postMessage({
      type: 'add-job',
      data: {
        id: jobId,
        imageData: request.imageData,
        datetime: request.datetime,
        resultDir: request.resultDir,
        preUploadedFilename
      }
    });

    console.log(`ComfyUI Service - Job message sent to worker: ${jobId}`);
    return jobId;
  }

  async getStatus(): Promise<ComfyUIStatus> {
    if (!this.worker) {
      throw new Error('ComfyUI Service not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Status request timeout'));
      }, TIMING_CONFIG.comfyuiTimeout);

      const messageHandler = (message: { type: string; data: ComfyUIStatus }) => {
        if (message.type === 'status') {
          clearTimeout(timeout);
          this.worker?.off('message', messageHandler);
          resolve(message.data);
        }
      };

      this.worker?.on('message', messageHandler);
      this.worker?.postMessage({ type: 'get-status', data: {} });
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, TIMING_CONFIG.comfyuiTimeout);

      const messageHandler = (message: { type: string; data: { isHealthy: boolean } }) => {
        if (message.type === 'health-check-result') {
          clearTimeout(timeout);
          this.worker?.off('message', messageHandler);
          resolve(message.data.isHealthy);
        }
      };

      this.worker?.on('message', messageHandler);
      this.worker?.postMessage({ type: 'health-check', data: {} });
    });
  }

  getActiveJobs(): Array<{datetime: string, status: string, duration: number}> {
    return Array.from(this.activeJobs.entries()).map(([datetime, job]) => ({
      datetime,
      status: job.status,
      duration: Date.now() - job.startTime
    }));
  }

  async cancelJob(datetime: string): Promise<boolean> {
    if (!this.worker) {
      console.log(`ComfyUI Service - Worker not initialized, cannot cancel job: ${datetime}`);
      return false;
    }

    console.log(`ComfyUI Service - Canceling job for datetime: ${datetime}`);
    
    // アクティブジョブから削除
    const job = this.activeJobs.get(datetime);
    if (job) {
      console.log(`ComfyUI Service - Found active job to cancel: ${JSON.stringify(job)}`);
      this.activeJobs.delete(datetime);
      console.log(`ComfyUI Service - Job canceled and removed: ${datetime}`);
    } else {
      console.log(`ComfyUI Service - No active job found for datetime: ${datetime}`);
      console.log(`ComfyUI Service - Current active jobs: ${JSON.stringify(Array.from(this.activeJobs.keys()))}`);
    }

    // プリアップロード済み画像も削除
    if (this.preUploadedImages.has(datetime)) {
      this.preUploadedImages.delete(datetime);
      console.log(`ComfyUI Service - Pre-uploaded image removed: ${datetime}`);
    }

    // Workerにキャンセル通知（サーバー側のキューからも削除）
    console.log(`ComfyUI Service - Sending cancel message to worker for datetime: ${datetime}`);
    this.worker.postMessage({
      type: 'cancel-job',
      data: { datetime }
    });

    return true;
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.activeJobs.clear();
    this.preUploadedImages.clear();
  }
}