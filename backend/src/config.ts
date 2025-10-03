import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017/videoharvester',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  downloadsDir: process.env.DOWNLOADS_DIR || '/downloads',
  downloadsEnabled: /^true$/i.test(process.env.ENABLE_DOWNLOADS || ''),
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '2000', 10),
};

export function requireEnv() {
  if (!config.youtubeApiKey) {
    // YouTube key is required for YouTube integration, but service can start without it
    // and return proper errors on YouTube routes.
    // Intentionally not throwing to allow local dev of non-YouTube parts.
  }
}
