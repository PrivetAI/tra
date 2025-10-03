import Queue from 'bull';
import { config } from '../config';
import { appendTaskLog } from '../services/taskLog';

const opts = {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true as const,
    removeOnFail: false as const,
  },
  settings: {
    // Disable stalled job retries
    maxStalledCount: 0,
  },
};

export const queues = {
  youtube: new Queue('queue:youtube', config.redisUrl, opts),
  tiktok: new Queue('queue:tiktok', config.redisUrl, opts),
  instagram: new Queue('queue:instagram', config.redisUrl, opts),
};

export type SearchJobData = {
  taskId: string;
  mode: 'search' | 'trends';
  keywords?: string;
  regionCode?: string | null;
  count: number;
};

// Basic instrumentation: log job failures/completions into task logs
for (const [name, q] of Object.entries(queues)) {
  q.on('failed', async (job, err) => {
    const t = (job.data as any)?.taskId;
    if (t) await appendTaskLog(t, 'error', `${name}:${job.name} failed: ${err?.message || err}`);
  });
  q.on('completed', async (job) => {
    const t = (job.data as any)?.taskId;
    if (t) await appendTaskLog(t, 'info', `${name}:${job.name} completed`);
  });
}

export type DownloadJobData = {
  taskId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  platformVideoId: string;
  sourceUrl: string;
};
