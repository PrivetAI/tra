import Queue from 'bull';
import { config } from '../config';

export const queues = {
  youtube: new Queue('queue:youtube', config.redisUrl),
  tiktok: new Queue('queue:tiktok', config.redisUrl),
  instagram: new Queue('queue:instagram', config.redisUrl),
};

export type SearchJobData = {
  taskId: string;
  mode: 'search' | 'trends';
  keywords?: string;
  regionCode?: string | null;
  count: number;
};

export type DownloadJobData = {
  taskId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  platformVideoId: string;
  sourceUrl: string;
};
