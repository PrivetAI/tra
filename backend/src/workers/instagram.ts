import mongoose from 'mongoose';
import { queues, SearchJobData, DownloadJobData } from '../queues/index';
import { TaskModel } from '../models/Task';
import { VideoModel } from '../models/Video';
import { logger } from '../logging';
import * as ig from '../services/instagram';
import { downloadWithYtDlp } from '../services/downloader';
import { appendTaskLog } from '../services/taskLog';
import { config, requireEnv } from '../config';

async function bootstrap() {
  try {
    requireEnv();
    await mongoose.connect(config.mongoUri);
    logger.info('Instagram worker connected to MongoDB');
  } catch (err) {
    logger.error('Instagram worker failed to start', { err });
    process.exit(1);
  }
}

void bootstrap();

queues.instagram.process('searchTask', 1, async (job) => {
  const data = job.data as SearchJobData;
  const { taskId, mode, keywords, count } = data;
  logger.info('Instagram worker: received search task', { taskId, mode, keywords, count });
  await appendTaskLog(taskId, 'info', `Instagram: старт поиска mode=${mode} keywords=${keywords ?? ''} count=${count}`);
  const task = await TaskModel.findOne({ taskId });
  if (!task) return;
  task.status = 'searching';
  await task.save();

  let results: { id: string; author?: string; views?: number; likes?: number; durationSec?: number; thumbnail?: string; url: string; }[] = [];
  try {
    results = data.mode === 'trends' ? await ig.fetchTrends('viralreels', data.count) : await ig.search(data.keywords || '', data.count);
    if (results.length === 0) {
      logger.warn('Instagram worker: no results returned', { taskId: data.taskId, mode: data.mode, keywords: data.keywords });
      await appendTaskLog(data.taskId, 'warn', 'Instagram: результаты не найдены');
    } else {
      const sampleIds = results.slice(0, 5).map((v) => v.id);
      logger.info('Instagram worker: found videos', { taskId: data.taskId, count: results.length, sampleIds });
      await appendTaskLog(
        data.taskId,
        'info',
        `Instagram: найдено ${results.length} видео (пример: ${sampleIds.join(', ')})`
      );
    }
  } catch (e: any) {
    task.status = 'error';
    task.errorMessages.push(String(e?.message || e));
    await task.save();
    await appendTaskLog(data.taskId, 'error', `Instagram: ошибка поиска: ${String(e?.message || e)}`);
    return { ok: false };
  }

  const downloadsEnabled = config.downloadsEnabled;
  task.progress = {
    found: results.length,
    downloaded: downloadsEnabled ? 0 : results.length,
    total: results.length,
  };
  task.status = results.length > 0 ? (downloadsEnabled ? 'downloading' : 'completed') : 'completed';
  await task.save();

  for (const v of results) {
    try {
      await VideoModel.updateOne(
        { platform: 'instagram', platformVideoId: v.id },
        {
          $setOnInsert: { taskId: data.taskId },
          $set: {
            platform: 'instagram',
            title: undefined,
            author: v.author,
            views: v.views,
            likes: v.likes,
            durationSec: v.durationSec,
            previewUrl: v.thumbnail,
            sourceUrl: v.url,
            status: downloadsEnabled ? 'downloading' : 'ready',
          },
        },
        { upsert: true }
      );
      if (downloadsEnabled) {
        const dl: DownloadJobData = { taskId: data.taskId, platform: 'instagram', platformVideoId: v.id, sourceUrl: v.url };
        await queues.instagram.add('downloadTask', dl);
      }
    } catch (e: any) {
      logger.error('Failed to enqueue download or upsert video', { taskId: data.taskId, videoId: v.id, err: e });
      await appendTaskLog(data.taskId, 'warn', `Instagram: не удалось поставить скачивание для ${v.id}: ${String(e?.message || e)}`);
    }
  }
  if (!downloadsEnabled && results.length > 0) {
    await appendTaskLog(data.taskId, 'info', 'Instagram: скачивание отключено конфигурацией, сохранены только метаданные');
  }
  return { ok: true, total: results.length };
});

queues.instagram.process('downloadTask', 2, async (job) => {
  if (!config.downloadsEnabled) {
    logger.warn('Instagram downloadTask received while downloads disabled', { jobId: job.id });
    return { ok: false, reason: 'Downloads disabled' };
  }
  const data = job.data as DownloadJobData;
  const video = await VideoModel.findOne({ platform: 'instagram', platformVideoId: data.platformVideoId });
  if (!video) {
    logger.error('Video missing for download task', { taskId: data.taskId, platformVideoId: data.platformVideoId });
    return { ok: false };
  }
  try {
    const path = await downloadWithYtDlp('instagram', data.taskId, data.platformVideoId, data.sourceUrl);
    video.downloadPath = path;
    video.status = 'ready';
    await video.save();
    await appendTaskLog(data.taskId, 'info', `Instagram: скачано ${data.platformVideoId}`);
  } catch (e: any) {
    video.status = 'error';
    video.error = String(e?.message || e);
    await video.save();
    await appendTaskLog(data.taskId, 'error', `Instagram: ошибка скачивания ${data.platformVideoId}: ${String(e?.message || e)}`);
  }
  const task = await TaskModel.findOne({ taskId: data.taskId });
  if (task) {
    const downloaded = await VideoModel.countDocuments({ taskId: data.taskId, status: 'ready' });
    const total = task.progress.total || (await VideoModel.countDocuments({ taskId: data.taskId }));
    task.progress.downloaded = downloaded;
    task.progress.total = total;
    if (downloaded >= total) {
      task.status = 'completed';
      await appendTaskLog(data.taskId, 'info', 'Instagram: задача завершена');
    }
    await task.save();
  }
  return { ok: true };
});
