import { Express } from 'express';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export const setupBullBoard = (app: Express, queues: Queue[]) => {
  const serverAdapter = new ExpressAdapter();
  // ダッシュボードのベースパスを設定
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter: serverAdapter,
  });

  // Express アプリにルーターをマウント
  app.use('/admin/queues', serverAdapter.getRouter());
};
