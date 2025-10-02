import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config';

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function downloadWithYtDlp(platform: string, taskId: string, platformVideoId: string, sourceUrl: string): Promise<string> {
  const dir = path.join(config.downloadsDir, platform, taskId);
  await ensureDir(dir);
  const template = path.join(dir, `${platformVideoId}.%(ext)s`);
  const args = [
    '-o', template,
    '--no-part',
    '--no-progress',
    '-f', 'mp4/bestaudio*+bestvideo*',
    sourceUrl,
  ];
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
    });
  });
  // Find the downloaded file path (unknown extension)
  const files = await fs.promises.readdir(dir);
  const found = files.find((f) => f.startsWith(platformVideoId + '.'));
  if (!found) throw new Error('Download finished but file not found');
  return path.join(dir, found);
}
