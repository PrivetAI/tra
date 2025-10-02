import { queues, SearchJobData, DownloadJobData } from '../queues/index';
import { TaskModel } from '../models/Task';
import { VideoModel } from '../models/Video';
import { logger } from '../logging';
import { fetchMostPopular, searchVideos } from '../services/youtube';
import { downloadWithYtDlp } from '../services/downloader';
import { appendTaskLog } from '../services/taskLog';

queues.youtube.process('searchTask', 2, async (job) => {
  const data = job.data as SearchJobData;
  const { taskId, mode, keywords, regionCode, count } = data;
  logger.info('YouTube worker: received search task', { taskId, mode, keywords, regionCode, count });
  await appendTaskLog(taskId, 'info', `YouTube: старт поиска mode=${mode} keywords=${keywords ?? ''} region=${regionCode ?? 'US'} count=${count}`);
  const task = await TaskModel.findOne({ taskId });
  if (!task) return;
  task.status = 'searching';
  await task.save();

  let results: { platformVideoId: string; title?: string; author?: string; views?: number; likes?: number; durationSec?: number; previewUrl?: string; sourceUrl: string; }[] = [];
  try {
    results = mode === 'trends'
      ? await fetchMostPopular(regionCode ?? null, count)
      : await searchVideos(keywords || '', regionCode ?? null, count);
    logger.info('YouTube worker: fetched results', { taskId, count: results.length });
    await appendTaskLog(taskId, 'info', `YouTube: найдено результатов ${results.length}`);
  } catch (e: any) {
    task.status = 'error';
    task.errorMessages.push(String(e?.message || e));
    await task.save();
    logger.error('YouTube search failed', { taskId, err: e });
    await appendTaskLog(taskId, 'error', `YouTube: ошибка поиска: ${String(e?.message || e)}`);
    return { ok: false };
  }

  task.progress = { found: results.length, downloaded: 0, total: results.length };
  task.status = results.length > 0 ? 'downloading' : 'completed';
  await task.save();

  for (const v of results) {
    try {
      await VideoModel.updateOne(
        { platform: 'youtube', platformVideoId: v.platformVideoId },
        {
          $setOnInsert: { taskId },
          $set: {
            platform: 'youtube',
            title: v.title,
            author: v.author,
            views: v.views,
            likes: v.likes,
            durationSec: v.durationSec,
            previewUrl: v.previewUrl,
            sourceUrl: v.sourceUrl,
            status: 'downloading',
          },
        },
        { upsert: true }
      );
      const dl: DownloadJobData = { taskId, platform: 'youtube', platformVideoId: v.platformVideoId, sourceUrl: v.sourceUrl };
      await queues.youtube.add('downloadTask', dl, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    } catch (e: any) {
      logger.error('Failed to enqueue download or upsert video', { taskId, videoId: v.platformVideoId, err: e });
      await appendTaskLog(taskId, 'warn', `YouTube: не удалось поставить скачивание для ${v.platformVideoId}: ${String(e?.message || e)}`);
    }
  }
  return { ok: true, total: results.length };
});

queues.youtube.process('downloadTask', 3, async (job) => {
  const data = job.data as DownloadJobData;
  const { taskId, platformVideoId, sourceUrl } = data;
  const video = await VideoModel.findOne({ platform: 'youtube', platformVideoId });
  if (!video) return { ok: false, reason: 'Video missing' };
  try {
    const path = await downloadWithYtDlp('youtube', taskId, platformVideoId, sourceUrl);
    video.downloadPath = path;
    video.status = 'ready';
    await video.save();
    await appendTaskLog(taskId, 'info', `YouTube: скачано ${platformVideoId}`);
  } catch (e: any) {
    video.status = 'error';
    video.error = String(e?.message || e);
    await video.save();
    await appendTaskLog(taskId, 'error', `YouTube: ошибка скачивания ${platformVideoId}: ${String(e?.message || e)}`);
  }
  // Update task progress
  const task = await TaskModel.findOne({ taskId });
  if (task) {
    const downloaded = await VideoModel.countDocuments({ taskId, status: 'ready' });
    const total = task.progress.total || (await VideoModel.countDocuments({ taskId }));
    task.progress.downloaded = downloaded;
    task.progress.total = total;
    if (downloaded >= total) task.status = 'completed';
    await task.save();
    if (task.status === 'completed') await appendTaskLog(taskId, 'info', 'YouTube: задача завершена');
  }
  return { ok: true };
});
