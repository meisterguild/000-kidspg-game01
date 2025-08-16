import { parentPort } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import { request as httpRequest } from 'http';
import { URL } from 'url';
import FormData from 'form-data';

interface WorkflowTemplate {
  [nodeId: string]: {
    inputs: Record<string, unknown>;
    class_type: string;
    _meta: { title: string };
  };
}

interface ComfyUIPromptResponse {
  prompt_id: string;
}

interface ComfyUIUploadResponse {
  name: string;
}

interface ComfyUIQueueResponse {
  queue_pending: Array<[number, string]>;
  queue_running: Array<[number, string]>;
}

interface ComfyUIHistoryResponse {
  [promptId: string]: {
    outputs: {
      [nodeId: string]: {
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

interface WorkerMessage {
  type: string;
  data: Record<string, unknown>;
}

// Node.js標準のhttpモジュールを使用（上部でimport済み）

// シンプルなHTTPクライアント実装
async function electronFetch(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number;
} = {}): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  buffer: () => Promise<Buffer>;
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = httpRequest(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        const buffer = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          json: async () => JSON.parse(buffer.toString()),
          buffer: async () => buffer
        });
      });
    });

    req.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      reject(error);
    });

    // タイムアウト設定
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, options.timeout);
    }

    // レスポンス完了時にタイムアウトをクリア
    req.on('response', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    if (options.body) {
      if (options.body instanceof FormData) {
        // FormDataの場合
        const formHeaders = options.body.getHeaders();
        for (const [key, value] of Object.entries(formHeaders)) {
          req.setHeader(key, value);
        }
        
        // FormDataをパイプで送信
        options.body.pipe(req);
        options.body.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
        options.body.on('end', () => {
          // FormDataの送信完了をログ出力
          console.log('FormData pipe completed');
        });
      } else {
        req.write(options.body);
        req.end();
      }
    } else {
      req.end();
    }
  });
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

interface JobData {
  id: string;
  imageData: string;
  datetime: string;
  resultDir: string;
  preUploadedFilename?: string;
}

interface ActiveJob {
  promptId: string;
  datetime: string;
  resultDir: string;
  startTime: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
}

class ComfyUIWorker {
  private config: ComfyUIConfig;
  private activeJobs = new Map<string, ActiveJob>();
  private jobQueue: JobData[] = [];
  private isProcessing = false;
  private workflowTemplate: WorkflowTemplate | null = null;

  constructor(config: ComfyUIConfig) {
    this.config = config;
    // image_generate.jsonを使用するため、共通テンプレートの読み込みは不要
    console.log('ComfyUI Worker - Initialized (using individual image_generate.json files)');
  }

  private async loadWorkflowTemplate(): Promise<void> {
    try {
      const templatePath = path.resolve(this.config.workflow.templatePath);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      this.workflowTemplate = JSON.parse(templateContent);
    } catch (error) {
      this.sendMessage('error', { message: `ワークフローテンプレート読み込みエラー: ${error}` });
    }
  }

  private sendMessage(type: string, data: Record<string, unknown>): void {
    parentPort?.postMessage({ type, data });
  }

  private sendJobProgress(datetime: string, type: string, data: Record<string, unknown>): void {
    parentPort?.postMessage({ 
      type, 
      data: { 
        ...data, 
        jobId: datetime,
        timestamp: new Date().toISOString()
      } 
    });
  }

  async preUploadImage(imageData: string, datetime: string): Promise<void> {
    try {
      console.log(`ComfyUI Worker - Pre-uploading image for datetime: ${datetime}`);
      const buffer = Buffer.from(imageData, 'base64');
      const filename = `photo_${datetime}.png`;
      console.log(`ComfyUI Worker - Created buffer size: ${buffer.length} bytes`);
      
      const formData = new FormData();
      formData.append('image', buffer, { filename, contentType: 'image/png' });
      console.log(`ComfyUI Worker - FormData created, uploading to ${this.config.baseUrl}/upload/image`);

      const startTime = Date.now();
      const response = await electronFetch(`${this.config.baseUrl}/upload/image`, {
        method: 'POST',
        body: formData,
        timeout: this.config.timeouts.upload
      });
      const uploadDuration = Date.now() - startTime;
      console.log(`ComfyUI Worker - Upload request completed in ${uploadDuration}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.buffer().then(buf => buf.toString()).catch(() => 'Unknown error');
        console.error(`ComfyUI Worker - Upload error response: ${errorText}`);
        throw new Error(`画像アップロードエラー: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as ComfyUIUploadResponse;
      const uploadedFilename = result.name || filename;
      
      console.log(`ComfyUI Worker - Pre-upload completed successfully: ${uploadedFilename} for ${datetime} (total time: ${uploadDuration}ms)`);
      this.sendMessage('pre-upload-completed', { 
        datetime, 
        uploadedFilename 
      });

    } catch (error) {
      console.error(`ComfyUI Worker - Pre-upload failed for ${datetime}:`, error);
      this.sendMessage('pre-upload-completed', { 
        datetime, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  async addJob(jobData: JobData): Promise<void> {
    console.log(`ComfyUI Worker - Adding job to queue: ${jobData.id} for datetime: ${jobData.datetime}`);
    this.jobQueue.push(jobData);
    this.sendJobProgress(jobData.datetime, 'job-queued', { 
      position: this.jobQueue.length,
      message: 'ジョブがキューに追加されました' 
    });
    
    if (!this.isProcessing) {
      console.log(`ComfyUI Worker - Starting queue processing`);
      this.processQueue();
    } else {
      console.log(`ComfyUI Worker - Queue processing already in progress`);
    }
  }

  async cancelJob(datetime: string): Promise<void> {
    console.log(`ComfyUI Worker - Canceling job for datetime: ${datetime}`);
    
    // キューから削除
    const queueIndex = this.jobQueue.findIndex(job => job.datetime === datetime);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
      console.log(`ComfyUI Worker - Job removed from internal queue: ${datetime}`);
    }
    
    // アクティブジョブから削除し、ComfyUIサーバーからも削除
    const activeJob = this.activeJobs.get(datetime);
    if (activeJob) {
      console.log(`ComfyUI Worker - Found active job to cancel: ${activeJob.promptId}`);
      try {
        // ComfyUIサーバーのキューから削除
        await this.cancelJobOnServer(activeJob.promptId);
        console.log(`ComfyUI Worker - Job canceled on server: ${activeJob.promptId}`);
      } catch (error) {
        console.warn(`ComfyUI Worker - Failed to cancel job on server: ${error}`);
      }
      
      this.activeJobs.delete(datetime);
      console.log(`ComfyUI Worker - Active job canceled: ${datetime}`);
    } else {
      console.log(`ComfyUI Worker - No active job found for datetime: ${datetime}`);
    }
    
    this.sendJobProgress(datetime, 'job-canceled', { 
      message: 'ジョブがキャンセルされました' 
    });
  }

  private async cancelJobOnServer(promptId: string): Promise<void> {
    try {
      console.log(`ComfyUI Worker - Attempting to cancel job on server: ${promptId}`);
      
      // まず現在のキューを取得
      const queueResponse = await electronFetch(`${this.config.baseUrl}/queue`);
      if (!queueResponse.ok) {
        throw new Error(`Failed to get queue: ${queueResponse.status}`);
      }
      
      const queueData = await queueResponse.json() as ComfyUIQueueResponse;
      
      // キューにジョブが存在するかチェック
      const allJobs = [...(queueData.queue_running || []), ...(queueData.queue_pending || [])];
      const jobExists = allJobs.some(([, id]) => id === promptId);
      
      if (jobExists) {
        console.log(`ComfyUI Worker - Job found in server queue, deleting: ${promptId}`);
        
        // キューからジョブを削除
        const deleteResponse = await electronFetch(`${this.config.baseUrl}/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delete: [promptId]
          })
        });
        
        if (!deleteResponse.ok) {
          throw new Error(`Failed to delete from queue: ${deleteResponse.status}`);
        }
        
        console.log(`ComfyUI Worker - Successfully deleted job from server queue: ${promptId}`);
      } else {
        console.log(`ComfyUI Worker - Job not found in server queue (may have already completed): ${promptId}`);
      }
      
      // 実行中の場合は割り込み処理も試行
      if (queueData.queue_running?.some(([, id]) => id === promptId)) {
        console.log(`ComfyUI Worker - Job is running, sending interrupt: ${promptId}`);
        const interruptResponse = await electronFetch(`${this.config.baseUrl}/interrupt`, {
          method: 'POST'
        });
        
        if (interruptResponse.ok) {
          console.log(`ComfyUI Worker - Interrupt sent successfully for: ${promptId}`);
        } else {
          console.warn(`ComfyUI Worker - Failed to send interrupt: ${interruptResponse.status}`);
        }
      }
      
    } catch (error) {
      console.error(`ComfyUI Worker - Error canceling job on server:`, error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    console.log(`ComfyUI Worker - processQueue called - isProcessing: ${this.isProcessing}, queueLength: ${this.jobQueue.length}, activeJobs: ${this.activeJobs.size}, maxConcurrent: ${this.config.maxConcurrentJobs}`);
    
    if (this.isProcessing || this.jobQueue.length === 0) {
      console.log(`ComfyUI Worker - processQueue early return - isProcessing: ${this.isProcessing}, queueLength: ${this.jobQueue.length}`);
      return;
    }
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      console.log(`ComfyUI Worker - processQueue early return - activeJobs: ${this.activeJobs.size} >= maxConcurrent: ${this.config.maxConcurrentJobs}`);
      return;
    }

    this.isProcessing = true;
    console.log(`ComfyUI Worker - processQueue starting processing`);

    while (this.jobQueue.length > 0 && this.activeJobs.size < this.config.maxConcurrentJobs) {
      const job = this.jobQueue.shift();
      if (!job) continue;
      console.log(`ComfyUI Worker - processQueue processing job: ${job.id}`);
      try {
        await this.processJob(job);
        console.log(`ComfyUI Worker - processQueue completed job: ${job.id}`);
      } catch (error) {
        console.error(`ComfyUI Worker - processQueue error for job ${job.id}:`, error);
      }
    }

    this.isProcessing = false;
    console.log(`ComfyUI Worker - processQueue finished processing`);

    if (this.jobQueue.length > 0) {
      console.log(`ComfyUI Worker - processQueue scheduling next batch in 1 second`);
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  private async processJob(job: JobData): Promise<void> {
    try {
      console.log(`ComfyUI Worker - processJob starting for: ${job.id}`);
      this.sendJobProgress(job.datetime, 'job-started', { message: '画像変換を開始します' });

      console.log(`ComfyUI Worker - processJob checking pre-upload for datetime: ${job.datetime}, preUploadedFilename: ${job.preUploadedFilename}`);
      
      let uploadedFilename: string;
      if (job.preUploadedFilename) {
        console.log(`ComfyUI Worker - processJob using pre-uploaded image: ${job.preUploadedFilename} for: ${job.id}`);
        uploadedFilename = job.preUploadedFilename;
      } else {
        console.log(`ComfyUI Worker - processJob uploading image for: ${job.id} (no pre-upload found)`);
        uploadedFilename = await this.uploadImage(job);
        console.log(`ComfyUI Worker - processJob uploaded image: ${uploadedFilename} for: ${job.id}`);
      }
      
      console.log(`ComfyUI Worker - processJob submitting prompt for: ${job.id}`);
      const promptId = await this.submitPrompt(job, uploadedFilename);
      console.log(`ComfyUI Worker - processJob got promptId: ${promptId} for: ${job.id}`);
      
      this.activeJobs.set(job.datetime, {
        promptId,
        datetime: job.datetime,
        resultDir: job.resultDir,
        startTime: Date.now(),
        status: 'processing'
      });

      this.sendJobProgress(job.datetime, 'job-processing', { 
        promptId,
        message: 'ComfyUIで処理中です' 
      });

      this.monitorJob(job.datetime);

    } catch (error) {
      console.error(`ComfyUI Worker - processJob failed for ${job.id}:`, error);
      this.sendJobProgress(job.datetime, 'job-error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private async uploadImage(job: JobData): Promise<string> {
    try {
      console.log(`ComfyUI Worker - uploadImage starting for: ${job.id}`);
      const buffer = Buffer.from(job.imageData, 'base64');
      const filename = `photo_${job.datetime}.png`;
      console.log(`ComfyUI Worker - uploadImage created buffer, size: ${buffer.length} for: ${job.id}`);
      
      const formData = new FormData();
      formData.append('image', buffer, { filename, contentType: 'image/png' });
      console.log(`ComfyUI Worker - uploadImage created FormData for: ${job.id}`);

      console.log(`ComfyUI Worker - uploadImage sending POST to ${this.config.baseUrl}/upload/image for: ${job.id}`);
      const response = await electronFetch(`${this.config.baseUrl}/upload/image`, {
        method: 'POST',
        body: formData,
        timeout: this.config.timeouts.upload
      });
      console.log(`ComfyUI Worker - uploadImage got response: ${response.status} ${response.statusText} for: ${job.id}`);

      if (!response.ok) {
        const errorText = await response.buffer().then(buf => buf.toString()).catch(() => 'Unknown error');
        console.error(`ComfyUI Worker - uploadImage error response body: ${errorText}`);
        throw new Error(`画像アップロードエラー: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as ComfyUIUploadResponse;
      console.log(`ComfyUI Worker - uploadImage success result:`, result);
      return result.name || filename;

    } catch (error) {
      console.error(`ComfyUI Worker - uploadImage failed for ${job.id}:`, error);
      throw new Error(`画像アップロード失敗: ${error}`);
    }
  }

  private async submitPrompt(job: JobData, uploadedFilename: string): Promise<string> {
    try {
      console.log(`ComfyUI Worker - Submitting prompt for job ${job.id} with uploaded file: ${uploadedFilename}`);
      
      // 結果フォルダからimage_generate.jsonを読み込み
      const imageGeneratePath = path.join(job.resultDir, 'image_generate.json');
      console.log(`ComfyUI Worker - Loading workflow from: ${imageGeneratePath}`);
      
      let workflow: WorkflowTemplate;
      try {
        const workflowContent = await fs.readFile(imageGeneratePath, 'utf-8');
        workflow = JSON.parse(workflowContent);
        console.log(`ComfyUI Worker - Successfully loaded workflow from image_generate.json`);
      } catch (error) {
        throw new Error(`image_generate.json読み込み失敗: ${error}`);
      }

      // ワークフローテンプレートは既に正しいファイル名で設定済み
      console.log(`ComfyUI Worker - Using workflow template with pre-configured filenames`);
      console.log(`ComfyUI Worker - Expected upload filename: ${uploadedFilename}`);

      const promptData = {
        prompt: workflow,
        client_id: `kidspg-${Date.now()}`,
        extra_pnginfo: {
          workflow: workflow,
          ds: {
            seed: Math.floor(Math.random() * 1000000),
            version: "0.0.1"
          }
        }
      };

      console.log(`ComfyUI Worker - Sending POST to ${this.config.baseUrl}/prompt`);
      console.log(`ComfyUI Worker - Prompt data:`, JSON.stringify(promptData, null, 2));
      
      const response = await electronFetch(`${this.config.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptData),
        timeout: this.config.timeouts.processing
      });

      console.log(`ComfyUI Worker - Prompt response: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        const errorText = await response.buffer().then(buf => buf.toString()).catch(() => 'Unknown error');
        console.error(`ComfyUI Worker - Prompt error response body: ${errorText}`);
        throw new Error(`プロンプト送信エラー: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as ComfyUIPromptResponse;
      console.log(`ComfyUI Worker - Got prompt_id: ${result.prompt_id}`);
      
      return result.prompt_id;

    } catch (error) {
      throw new Error(`プロンプト送信失敗: ${error}`);
    }
  }

  private async monitorJob(datetime: string): Promise<void> {
    const job = this.activeJobs.get(datetime);
    if (!job) return;

    const startTime = Date.now();
    const timeoutMs = this.config.timeouts.queue;

    const poll = async () => {
      try {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error('処理タイムアウト');
        }

        const queueResponse = await electronFetch(`${this.config.baseUrl}/queue`);
        const queueData = await queueResponse.json() as ComfyUIQueueResponse;
        
        const position = this.findQueuePosition(queueData, job.promptId);
        
        if (position !== null) {
          this.sendJobProgress(datetime, 'job-queue-update', { 
            position,
            message: position === 0 ? '処理中' : `キュー位置: ${position}` 
          });
          
          setTimeout(poll, this.config.pollingInterval);
          return;
        }

        const historyResponse = await electronFetch(`${this.config.baseUrl}/history/${job.promptId}`);
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json() as ComfyUIHistoryResponse;
          
          if (historyData[job.promptId]) {
            await this.completeJob(datetime, historyData[job.promptId]);
            return;
          }
        }

        setTimeout(poll, this.config.pollingInterval);

      } catch (error) {
        this.activeJobs.delete(datetime);
        this.sendJobProgress(datetime, 'job-error', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    };

    poll();
  }

  private findQueuePosition(queue: ComfyUIQueueResponse, promptId: string): number | null {
    const pending = queue.queue_pending || [];
    const running = queue.queue_running || [];
    
    for (let i = 0; i < running.length; i++) {
      if (running[i][1] === promptId) {
        return 0;
      }
    }
    
    for (let i = 0; i < pending.length; i++) {
      if (pending[i][1] === promptId) {
        return i + 1;
      }
    }
    
    return null;
  }

  private async completeJob(datetime: string, historyData: ComfyUIHistoryResponse[string]): Promise<void> {
    try {
      const job = this.activeJobs.get(datetime);
      if (!job) return;

      const outputs = historyData.outputs;
      let imageUrl: string | null = null;
      let actualFilename: string | null = null;

      console.log(`ComfyUI Worker - Processing outputs from nodes: ${Object.keys(outputs).join(', ')}`);
      
      // SaveImageノード（通常はnode 9）を優先的に探す
      const saveImageNodeIds = ['9', '8']; // SaveImageノードの可能性があるID
      let selectedNodeId: string | null = null;
      
      // 最初にSaveImageノードを探す
      for (const nodeId of saveImageNodeIds) {
        if (outputs[nodeId] && outputs[nodeId].images && outputs[nodeId].images.length > 0) {
          selectedNodeId = nodeId;
          break;
        }
      }
      
      // SaveImageノードが見つからない場合、他のノードを探す
      if (!selectedNodeId) {
        for (const nodeId in outputs) {
          const nodeOutput = outputs[nodeId];
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            selectedNodeId = nodeId;
            break;
          }
        }
      }
      
      if (selectedNodeId) {
        const nodeOutput = outputs[selectedNodeId];
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const image = nodeOutput.images[0];
          imageUrl = `${this.config.baseUrl}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
          actualFilename = image.filename;
          console.log(`ComfyUI Worker - Selected output from node ${selectedNodeId}: ${actualFilename}`);
          console.log(`ComfyUI Worker - Image details:`, image);
        }
      }

      if (!imageUrl || !actualFilename) {
        throw new Error('出力画像が見つかりません');
      }

      const savedFilePath = await this.downloadAndSaveResult(job, imageUrl, actualFilename);
      // image_generate.jsonが既に存在するため、workflow.json保存は不要

      this.activeJobs.delete(datetime);
      this.sendJobProgress(datetime, 'job-completed', { 
        message: '画像変換が完了しました',
        resultPath: savedFilePath,
        actualFilename: actualFilename
      });

    } catch (error) {
      this.activeJobs.delete(datetime);
      this.sendJobProgress(datetime, 'job-error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private async downloadAndSaveResult(job: ActiveJob, imageUrl: string, actualFilename: string): Promise<string> {
    try {
      console.log(`ComfyUI Worker - Downloading result from: ${imageUrl}`);
      const response = await electronFetch(imageUrl);
      if (!response.ok) {
        throw new Error(`画像ダウンロードエラー: ${response.status}`);
      }

      const buffer = await response.buffer();
      // 実際のファイル名を使用して保存
      const outputPath = path.join(job.resultDir, actualFilename);
      
      await fs.writeFile(outputPath, buffer);
      console.log(`ComfyUI Worker - Result saved to: ${outputPath}`);
      
      return outputPath;

    } catch (error) {
      throw new Error(`結果保存失敗: ${error}`);
    }
  }


  async getStatus(): Promise<Record<string, unknown>> {
    try {
      // 実際のComfyUIサーバーのキュー状況を取得
      const queueResponse = await electronFetch(`${this.config.baseUrl}/queue`);
      const queueData = await queueResponse.json() as ComfyUIQueueResponse;
      
      return {
        activeJobs: Array.from(this.activeJobs.entries()).map(([datetime, job]) => ({
          datetime,
          status: job.status,
          promptId: job.promptId,
          duration: Date.now() - job.startTime
        })),
        internalQueueLength: this.jobQueue.length,
        serverQueueRunning: (queueData.queue_running || []).length,
        serverQueuePending: (queueData.queue_pending || []).length,
        maxConcurrentJobs: this.config.maxConcurrentJobs
      };
    } catch (error) {
      console.error('Failed to get server queue status:', error);
      return {
        activeJobs: Array.from(this.activeJobs.entries()).map(([datetime, job]) => ({
          datetime,
          status: job.status,
          promptId: job.promptId,
          duration: Date.now() - job.startTime
        })),
        internalQueueLength: this.jobQueue.length,
        serverQueueRunning: 0,
        serverQueuePending: 0,
        maxConcurrentJobs: this.config.maxConcurrentJobs,
        error: 'サーバーキュー取得失敗'
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      console.log(`ComfyUI health check: ${this.config.baseUrl}/system_stats`);
      const response = await electronFetch(`${this.config.baseUrl}/system_stats`, {
        timeout: 5000
      });
      console.log(`ComfyUI health check response: ${response.status} ${response.statusText}`);
      return response.ok;
    } catch (error) {
      console.error('ComfyUI health check error:', error);
      return false;
    }
  }
}

let worker: ComfyUIWorker | null = null;

parentPort?.on('message', async (message: WorkerMessage) => {
  const { type, data } = message;

  try {
    console.log(`ComfyUI Worker - Received message: ${type}`);
    
    switch (type) {
      case 'init':
        console.log(`ComfyUI Worker - Initializing with config`);
        worker = new ComfyUIWorker(data.config as ComfyUIConfig);
        parentPort?.postMessage({ type: 'ready', data: {} });
        break;

      case 'pre-upload-image':
        if (worker) {
          const { imageData, datetime } = data as { imageData: string; datetime: string };
          console.log(`ComfyUI Worker - Pre-uploading image for: ${datetime}`);
          await worker.preUploadImage(imageData, datetime);
        } else {
          console.error('ComfyUI Worker - Worker not initialized for pre-upload-image');
        }
        break;

      case 'add-job':
        if (worker) {
          const jobData = data as unknown as JobData;
          console.log(`ComfyUI Worker - Adding job: ${jobData.id}`);
          await worker.addJob(jobData);
        } else {
          console.error('ComfyUI Worker - Worker not initialized for add-job');
        }
        break;

      case 'cancel-job':
        if (worker) {
          const { datetime } = data as { datetime: string };
          console.log(`ComfyUI Worker - Canceling job: ${datetime}`);
          await worker.cancelJob(datetime);
        } else {
          console.error('ComfyUI Worker - Worker not initialized for cancel-job');
        }
        break;

      case 'get-status':
        if (worker) {
          console.log(`ComfyUI Worker - Getting status`);
          const status = await worker.getStatus();
          parentPort?.postMessage({ type: 'status', data: status });
        } else {
          console.error('ComfyUI Worker - Worker not initialized for get-status');
        }
        break;

      case 'health-check':
        if (worker) {
          console.log(`ComfyUI Worker - Health check`);
          const isHealthy = await worker.healthCheck();
          parentPort?.postMessage({ type: 'health-check-result', data: { isHealthy } });
        } else {
          console.error('ComfyUI Worker - Worker not initialized for health-check');
        }
        break;

      default:
        console.warn('ComfyUI Worker - Unknown message type:', type);
    }
  } catch (error) {
    console.error(`ComfyUI Worker - Message handling error for type ${type}:`, error);
    parentPort?.postMessage({ 
      type: 'error', 
      data: { 
        message: error instanceof Error ? error.message : String(error),
        messageType: type
      } 
    });
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('ComfyUI Worker - Uncaught exception:', error);
  parentPort?.postMessage({ 
    type: 'error', 
    data: { 
      message: `Uncaught exception: ${error.message}`,
      stack: error.stack
    } 
  });
  process.exit(1);
});

// Unhandled rejection handler  
process.on('unhandledRejection', (reason, promise) => {
  console.error('ComfyUI Worker - Unhandled rejection at:', promise, 'reason:', reason);
  parentPort?.postMessage({ 
    type: 'error', 
    data: { 
      message: `Unhandled rejection: ${reason}`,
      promise: String(promise)
    } 
  });
});