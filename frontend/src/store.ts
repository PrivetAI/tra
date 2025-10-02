import { create } from 'zustand'

type TaskState = {
  youtubeTaskId?: string
  tiktokTaskId?: string
  instagramTaskId?: string
  setTaskId: (platform: 'youtube'|'tiktok'|'instagram', id?: string) => void
  pollIntervalMs: number
}

export const useAppStore = create<TaskState>((set) => ({
  setTaskId: (platform, id) => set((s) => ({ ...s, [`${platform}TaskId`]: id }) as any),
  pollIntervalMs: Number(import.meta.env.VITE_POLL_INTERVAL_MS || 2000),
}))

