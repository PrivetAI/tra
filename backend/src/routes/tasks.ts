import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TaskModel, TaskStatus } from '../models/Task';
import { queues, SearchJobData } from '../queues/index';
import { VideoModel } from '../models/Video';
import { appendTaskLog } from '../services/taskLog';

const platforms = ['youtube', 'tiktok', 'instagram'] as const;
type Platform = typeof platforms[number];

export const tasksRouter = Router();

tasksRouter.post('/create/:platform', async (req, res) => {
  try {
    const platform = req.params.platform as Platform;
    if (!platforms.includes(platform)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown platform' } });
    }
    const { mode, keywords, regionName, regionCode, count } = req.body || {};
    if (!['search', 'trends'].includes(mode)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid mode' } });
    }
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'count must be 1..100' } });
    }
    const taskId = uuidv4();
    const task = await TaskModel.create({
      taskId,
      platform,
      mode,
      query: { keywords, regionName, regionCode: regionCode ?? null, count },
      status: 'queued',
      progress: { found: 0, downloaded: 0, total: 0 },
      errorMessages: [],
    });

    const data: SearchJobData = { taskId, mode, keywords, regionCode: regionCode ?? null, count };
    await queues[platform].add('searchTask', data);
    await appendTaskLog(taskId, 'info', `Задача создана: ${platform} mode=${mode} count=${count} region=${regionName ?? 'Глобально'}`);

    res.json({ taskId: task.taskId, platform: task.platform, status: task.status });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'API_FAILURE', message: err?.message || 'Internal error' } });
  }
});

tasksRouter.get('/:platform/:taskId', async (req, res) => {
  try {
    const platform = req.params.platform as Platform;
    const { taskId } = req.params;
    const task = await TaskModel.findOne({ platform, taskId });
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    const videos = await VideoModel.find({ taskId, deleted: false }).select('-__v');
    res.set('Cache-Control', 'no-store');
    res.json({
      taskId: task.taskId,
      platform: task.platform,
      status: task.status as TaskStatus,
      progress: task.progress,
      errorMessages: task.errorMessages || [],
      logs: (task.logs || []).slice(-100),
      videos,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'API_FAILURE', message: err?.message || 'Internal error' } });
  }
});

export default tasksRouter;
