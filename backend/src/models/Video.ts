import mongoose, { Schema, Document } from 'mongoose';
import { Platform } from './Task';

export type VideoStatus = 'found' | 'downloading' | 'ready' | 'error';

export interface VideoDoc extends Document {
  platform: Platform;
  platformVideoId: string;
  taskId: string;
  title?: string;
  author?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  previewUrl?: string;
  sourceUrl?: string;
  downloadPath?: string;
  status: VideoStatus;
  error?: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<VideoDoc>(
  {
    platform: { type: String, enum: ['youtube', 'tiktok', 'instagram'], required: true, index: true },
    platformVideoId: { type: String, required: true },
    taskId: { type: String, required: true, index: true },
    title: { type: String },
    author: { type: String },
    views: { type: Number },
    likes: { type: Number },
    durationSec: { type: Number },
    previewUrl: { type: String },
    sourceUrl: { type: String },
    downloadPath: { type: String },
    status: { type: String, enum: ['found', 'downloading', 'ready', 'error'], default: 'found' },
    error: { type: String },
    deleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

VideoSchema.index({ platform: 1, platformVideoId: 1 }, { unique: true });

export const VideoModel = mongoose.model<VideoDoc>('Video', VideoSchema);
