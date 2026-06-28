export function formatDate(
  dateString: string | number | null | undefined,
  includeMilliseconds: boolean = true,
): string {
  if (!dateString) return '';

  const date =
    typeof dateString === 'number'
      ? new Date(dateString < 10000000000 ? dateString * 1000 : dateString)
      : new Date(dateString);

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (includeMilliseconds) {
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 表示用に相対時間を計算します。
 * @param {number|string} dateValue - タイムスタンプまたは日付文字列
 * @returns {string} 「Yesterday」「3 days ago」などの文字列
 */
export const getRelativeTime = (dateValue: string | number | null | undefined): string => {
  if (!dateValue) return 'N/A';

  let date;
  if (typeof dateValue === 'number') {
    const timestamp = dateValue < 10000000000 ? dateValue * 1000 : dateValue;
    date = new Date(timestamp);
  } else {
    date = new Date(dateValue);
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);

  // 未来の日時の場合（システム時計の僅かなズレなど）
  if (diffMs < 0) {
    if (absDiffMs < 60000) return 'Just now';
    if (absDiffMs < 3600000) return `In ${Math.floor(absDiffMs / 60000)}m`;
    if (absDiffMs < 86400000) return `In ${Math.floor(absDiffMs / 3600000)}h`;
    const d = Math.floor(absDiffMs / 86400000);
    return d === 1 ? 'Tomorrow' : `In ${d} days`;
  }

  // 過去の日時の場合
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};
