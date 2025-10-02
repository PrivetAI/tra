import { queues, SearchJobData, DownloadJobData } from '../queues/index';
import { TaskModel } from '../models/Task';
import { VideoModel } from '../models/Video';
import { logger } from '../logging';
import * as ig from '../services/instagram';
import { downloadWithYtDlp } from '../services/downloader';
import { appendTaskLog } from '../services/taskLog';

queues.instagram.process('searchTask', 1, async (job) => {
  const data = job.data as SearchJobData;
  logger.info('Instagram worker: received search task', { data });
  const task = await TaskModel.findOne({ taskId: data.taskId });
  if (!task) return;
  task.status = 'searching';
  await task.save();
  await appendTaskLog(data.taskId, 'info', `Instagram: старт поиска mode=${data.mode} keywords=${data.keywords ?? ''} count=${data.count}`);

  let results: { id: string; author?: string; views?: number; likes?: number; durationSec?: number; thumbnail?: string; url: string; }[] = [];
  try {
    results = data.mode === 'trends' ? await ig.fetchTrends('viralreels', data.count) : await ig.search(data.keywords || '', data.count);
  } catch (e: any) {
    task.status = 'error';
    task.errorMessages.push(String(e?.message || e));
    await task.save();
    await appendTaskLog(data.taskId, 'error', `Instagram: ошибка поиска: ${String(e?.message || e)}`);
    return { ok: false };
  }

  task.progress = { found: results.length, downloaded: 0, total: results.length };
  task.status = results.length > 0 ? 'downloading' : 'completed';
  await task.save();

  for (const v of results) {
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
          status: 'downloading',
        },
      },
      { upsert: true }
    );
    const dl: DownloadJobData = { taskId: data.taskId, platform: 'instagram', platformVideoId: v.id, sourceUrl: v.url };
    await queues.instagram.add('downloadTask', dl, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
  }
  await appendTaskLog(data.taskId, 'info', `Instagram: найдено результатов ${results.length}`);
  return { ok: true, total: results.length };
});

queues.instagram.process('downloadTask', 2, async (job) => {
  const data = job.data as DownloadJobData;
  const video = await VideoModel.findOne({ platform: 'instagram', platformVideoId: data.platformVideoId });
  if (!video) return { ok: false };
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
    if (downloaded >= total) task.status = 'completed';
    await task.save();
  }
  return { ok: true };
});
