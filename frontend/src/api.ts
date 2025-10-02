import axios from 'axios';

const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:5173';
const defaultApi = origin.replace(/:5173$/, ':8080');
const API_URL = import.meta.env.VITE_API_URL || defaultApi;

export const api = axios.create({ baseURL: API_URL });

export type Platform = 'youtube' | 'tiktok' | 'instagram';
export type Mode = 'search' | 'trends';

export async function createTask(platform: Platform, payload: { mode: Mode; keywords?: string; regionName?: string; regionCode?: string | null; count: number; }) {
  const { data } = await api.post(`/tasks/create/${platform}`, payload);
  return data as { taskId: string; platform: Platform; status: string };
}

export async function getTask(platform: Platform, taskId: string) {
  try {
    const { data } = await api.get(`/tasks/${platform}/${taskId}`);
    return data as any;
  } catch (err: any) {
    if (err.response) throw err.response.data;
    throw { error: { code: 'NETWORK', message: String(err) } };
  }
}

export async function deleteVideo(platform: Platform, videoId: string) {
  const { data } = await api.delete(`/videos/${platform}/${videoId}`);
  return data as { ok: boolean };
}

export async function sendUnique(platform: Platform, videoId: string) {
  return api.post(`/videos/${platform}/${videoId}/unique`).then(r => r.data).catch((err) => {
    if (err.response) return Promise.reject(err.response.data);
    return Promise.reject({ error: { code: 'NETWORK', message: String(err) } });
  });
}

export async function getCountries() {
  type Country = { code: string | null; name: string };
  // Simple in-memory cache to avoid duplicate requests (React StrictMode mounts, multiple columns)
  // Cache persists for the lifetime of the session.
  // If the request fails, cache is cleared so a subsequent attempt can retry.
  if ((getCountries as any)._cache) return (getCountries as any)._cache as Promise<Country[]>;
  const p: Promise<Country[]> = api
    .get('/meta/countries')
    .then((r) => r.data.countries as Country[])
    .catch((err) => {
      (getCountries as any)._cache = null;
      if (err.response) throw err.response.data;
      throw { error: { code: 'NETWORK', message: String(err) } };
    });
  (getCountries as any)._cache = p;
  return p;
}
