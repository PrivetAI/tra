import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { VideoModel } from '../models/Video';
import { config } from '../config';

const platforms = ['youtube', 'tiktok', 'instagram'] as const;
type Platform = typeof platforms[number];

export const videosRouter = Router();

videosRouter.get('/:platform/:videoId/download', async (req, res) => {
  try {
    const platform = req.params.platform as Platform;
    const { videoId } = req.params;
    const video = await VideoModel.findOne({ platform, platformVideoId: videoId });
    if (!video || video.deleted) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Video not found' } });
    const filePath = video.downloadPath || path.join(config.downloadsDir, platform, video.taskId, `${video.platformVideoId}`);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
    res.sendFile(path.resolve(filePath));
  } catch (err: any) {
    res.status(500).json({ error: { code: 'API_FAILURE', message: err?.message || 'Internal error' } });
  }
});

videosRouter.delete('/:platform/:videoId', async (req, res) => {
  try {
    const platform = req.params.platform as Platform;
    const { videoId } = req.params;
    const video = await VideoModel.findOne({ platform, platformVideoId: videoId });
    if (!video) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Video not found' } });
    video.deleted = true;
    await video.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'API_FAILURE', message: err?.message || 'Internal error' } });
  }
});

videosRouter.post('/:platform/:videoId/unique', async (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Uniqueness is not implemented yet' } });
});

export default videosRouter;
