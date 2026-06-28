/**
 * バイト数を読みやすい形式（KB, MB等）に変換します
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 画像データ（Base64またはURL）を表示可能なURL形式に変換します
 */
export function formatImageUrl(data: string | null | undefined): string {
  if (!data) return '';
  if (data.startsWith('data:image/')) return data;
  // Base64パターンの判定
  if (data.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
    return `data:image/png;base64,${data}`;
  }
  return data;
}
