import { google, youtube_v3 } from 'googleapis';
import { config } from '../config';

const yt = google.youtube('v3');

function iso8601DurationToSeconds(iso?: string | null): number | undefined {
  if (!iso) return undefined;
  // Simple ISO8601 duration parser for PT#M#S or PT#S or PT#M etc.
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return undefined;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

type NormalizedVideo = {
  platformVideoId: string;
  title?: string;
  author?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  previewUrl?: string;
  sourceUrl: string;
};

function normalizeVideos(items: youtube_v3.Schema$Video[]): NormalizedVideo[] {
  return items.map((v) => {
    const id = v.id!;
    const title = v.snippet?.title || undefined;
    const author = v.snippet?.channelTitle || undefined;
    const views = v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined;
    const likes = v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined;
    const durationSec = iso8601DurationToSeconds(v.contentDetails?.duration || undefined);
    const previewUrl = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || undefined;
    const sourceUrl = `https://www.youtube.com/watch?v=${id}`;
    return { platformVideoId: id, title, author, views, likes, durationSec, previewUrl, sourceUrl };
  });
}

export async function fetchMostPopular(regionCode: string | null, count: number) {
  const key = config.youtubeApiKey;
  if (!key) throw new Error('YOUTUBE_API_KEY is missing');
  const region = regionCode || 'US';
  const resp = await yt.videos.list({
    auth: key,
    part: ['snippet', 'contentDetails', 'statistics'],
    chart: 'mostPopular',
    maxResults: Math.min(count, 50),
    regionCode: region,
  });
  const items = resp.data.items || [];
  return normalizeVideos(items);
}

export async function searchVideos(q: string, regionCode: string | null, count: number) {
  const key = config.youtubeApiKey;
  if (!key) throw new Error('YOUTUBE_API_KEY is missing');
  const region = regionCode || 'US';
  const search = await yt.search.list({
    auth: key,
    part: ['id'],
    q,
    type: ['video'],
    maxResults: Math.min(count, 50),
    regionCode: region,
    order: 'viewCount',
    // Avoid filtering out too many results; let yt-dlp handle downloadability later
  });
  const ids = (search.data.items || []).map((i) => i.id?.videoId).filter(Boolean) as string[];
  if (ids.length === 0) return [];
  const details = await yt.videos.list({
    auth: key,
    part: ['snippet', 'contentDetails', 'statistics'],
    id: ids,
  });
  return normalizeVideos(details.data.items || []);
}
