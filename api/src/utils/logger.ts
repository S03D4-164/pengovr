export const logError = (message: string, err: any) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${message}:`, err.message || err);
};

let lastErrorTime = 0;
const ERROR_LOG_INTERVAL = 10000; // 10秒に1回だけログを許容する

export const shouldLog = (): boolean => {
  const now = Date.now();
  if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
    lastErrorTime = now; // 💥 ここで時間を更新する！
    return true;
  }
  return false;
};
