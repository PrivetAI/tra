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
  return (items || []).reduce<NormalizedVideo[]>((acc, v) => {
    const id = v.id;
    if (!id) return acc;
    const title = v.snippet?.title || undefined;
    const author = v.snippet?.channelTitle || undefined;
    const views = v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined;
    const likes = v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined;
    const durationSec = iso8601DurationToSeconds(v.contentDetails?.duration || undefined);
    const previewUrl = v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || undefined;
    const sourceUrl = `https://www.youtube.com/shorts/${id}`;
    acc.push({ platformVideoId: id, title, author, views, likes, durationSec, previewUrl, sourceUrl });
    return acc;
  }, []);
}

function isYouTubeChannelId(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(value.trim());
}

async function fetchShortsFromPlaylist(playlistId: string, count: number, key: string) {
  const resp = await yt.playlistItems.list({
    auth: key,
    playlistId,
    part: ['contentDetails'],
    maxResults: Math.min(count * 5, 50),
  });
  const items = (resp.data.items || []) as youtube_v3.Schema$PlaylistItem[];
  const ids = items
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean) as string[];
  if (ids.length === 0) return [];
  const details = await yt.videos.list({
    auth: key,
    id: ids,
    part: ['snippet', 'contentDetails', 'statistics'],
  });
  return normalizeVideos(details.data.items || []).slice(0, count);
}

function extractChannelId(input: string): string | null {
  const trimmed = input.trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return trimmed;
  const matchFromUrl = trimmed.match(/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (matchFromUrl) return matchFromUrl[1];
  return null;
}

function extractHandle(input: string): string | null {
  const match = input.match(/@([A-Za-z0-9_.-]+)/);
  return match ? match[0] : null;
}

async function resolveChannelId(query: string, key: string): Promise<string | null> {
  const fromId = extractChannelId(query);
  if (fromId) return fromId;

  const handle = extractHandle(query);
  const searchQuery = handle || query.trim();
  if (!searchQuery) return null;

  const resp = await yt.search.list({
    auth: key,
    part: ['id'],
    q: searchQuery,
    type: ['channel'],
    maxResults: 5,
  });
  const searchItems = (resp.data.items || []) as youtube_v3.Schema$SearchResult[];
  const channelId = searchItems
    .map((item) => item.id?.channelId)
    .find((id): id is string => Boolean(id));
  return channelId || null;
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
  return normalizeVideos(items).slice(0, count);
}

export async function searchVideos(q: string, regionCode: string | null, count: number) {
  const key = config.youtubeApiKey;
  if (!key) throw new Error('YOUTUBE_API_KEY is missing');
  const trimmedQuery = q.trim();
  const channelId = isYouTubeChannelId(trimmedQuery)
    ? trimmedQuery
    : await resolveChannelId(trimmedQuery, key);

  if (!channelId) return [];

  const playlistId = `UUSH${channelId.slice(2)}`;
  return fetchShortsFromPlaylist(playlistId, count, key);
}
