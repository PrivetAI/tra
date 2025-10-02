import { TaskModel } from '../models/Task';

export async function appendTaskLog(taskId: string, level: 'info'|'warn'|'error', message: string) {
  try {
    await TaskModel.updateOne(
      { taskId },
      {
        $push: {
          logs: { $each: [{ level, message, ts: new Date() }], $slice: -200 },
        },
      }
    ).exec();
  } catch {
    // ignore logging failures
  }
}

