import mongoose, { Schema, Document } from 'mongoose';

export type Platform = 'youtube' | 'tiktok' | 'instagram';
export type TaskMode = 'search' | 'trends';
export type TaskStatus = 'queued' | 'searching' | 'downloading' | 'completed' | 'error';

export interface TaskProgress {
  found: number;
  downloaded: number;
  total: number;
}

export type TaskLogLevel = 'info' | 'warn' | 'error';

export interface TaskLogEntry {
  level: TaskLogLevel;
  message: string;
  ts: Date;
}

export interface TaskDoc extends Document {
  taskId: string;
  platform: Platform;
  mode: TaskMode;
  query: {
    keywords?: string;
    regionName?: string;
    regionCode?: string | null;
    count: number;
  };
  status: TaskStatus;
  progress: TaskProgress;
  errorMessages: string[];
  logs: TaskLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<TaskDoc>(
  {
    taskId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['youtube', 'tiktok', 'instagram'], required: true, index: true },
    mode: { type: String, enum: ['search', 'trends'], required: true },
    query: {
      keywords: { type: String },
      regionName: { type: String },
      regionCode: { type: String },
      count: { type: Number, required: true },
    },
    status: { type: String, enum: ['queued', 'searching', 'downloading', 'completed', 'error'], default: 'queued' },
    progress: {
      found: { type: Number, default: 0 },
      downloaded: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    errorMessages: { type: [String], default: [] },
    logs: {
      type: [
        new Schema<TaskLogEntry>(
          {
            level: { type: String, enum: ['info', 'warn', 'error'], required: true },
            message: { type: String, required: true },
            ts: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const TaskModel = mongoose.model<TaskDoc>('Task', TaskSchema);
