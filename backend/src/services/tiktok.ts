import axios from 'axios';

const base = process.env.TIKTOK_SCRAPER_URL || 'http://tiktok-scraper:8000';

export type TikTokVideo = {
  id: string;
  author?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  cover?: string;
  url: string;
};

export async function fetchTrends(count: number): Promise<TikTokVideo[]> {
  const { data } = await axios.get(`${base}/trends`, { params: { count } });
  return data as TikTokVideo[];
}

export async function search(q: string, count: number): Promise<TikTokVideo[]> {
  const { data } = await axios.get(`${base}/search`, { params: { q, count } });
  return data as TikTokVideo[];
}

