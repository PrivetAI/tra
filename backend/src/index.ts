import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config, requireEnv } from './config';
import { logger } from './logging';
import tasksRouter from './routes/tasks';
import videosRouter from './routes/videos';
import { metaRouter } from './routes/meta';

const app = express();
// Disable etag to avoid 304 on dynamic JSON responses, keep polling simple
app.set('etag', false);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.json({
    name: 'VideoHarvester API',
    ok: true,
    endpoints: [
      '/health',
      '/meta/countries',
      '/tasks/create/:platform',
      '/tasks/:platform/:taskId',
      '/videos/:platform/:videoId/download',
      '/videos/:platform/:videoId',
      '/videos/:platform/:videoId/unique'
    ]
  });
});

app.use('/meta', metaRouter);
app.use('/tasks', tasksRouter);
app.use('/videos', videosRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err });
  res.status(500).json({ error: { code: 'API_FAILURE', message: 'Internal error' } });
});

async function start() {
  requireEnv();
  await mongoose.connect(config.mongoUri);
  app.listen(config.port, () => {
    logger.info(`API listening on :${config.port}`);
  });
}

start().catch((e) => {
  logger.error('Failed to start', { e });
  process.exit(1);
});
