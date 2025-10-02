import axios from 'axios';

const base = process.env.INSTAGRAM_SCRAPER_URL || 'http://instagram-scraper:8001';

export type InstaVideo = {
  id: string;
  author?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  thumbnail?: string;
  url: string;
};

export async function fetchTrends(hashtag: string, count: number): Promise<InstaVideo[]> {
  const { data } = await axios.get(`${base}/trends`, { params: { hashtag, count } });
  return data as InstaVideo[];
}

export async function search(q: string, count: number): Promise<InstaVideo[]> {
  const { data } = await axios.get(`${base}/search`, { params: { q, count } });
  return data as InstaVideo[];
}

