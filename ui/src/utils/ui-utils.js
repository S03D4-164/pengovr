/**
 * MIMEタイプに対応する絵文字を返します。
 */
export const getMimeTypeEmoji = (mimeType) => {
  if (!mimeType) return '📦';
  if (mimeType.startsWith('text/')) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.includes('json')) return '📋';
  if (mimeType.includes('javascript') || mimeType.includes('js')) return '📜';
  if (mimeType.includes('css')) return '🎨';
  if (mimeType.includes('html')) return '🌐';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  if (mimeType.includes('font') || mimeType.includes('woff') || mimeType.includes('ttf'))
    return '🔤';
  if (mimeType.includes('xml')) return '📃';
  if (mimeType.includes('csv')) return '📊';
  return '📦';
};

/**
 * ステータスコードに応じたDaisyUIのバッジクラスを返します。
 */
export const getStatusClass = (status) => {
  const base = 'badge badge-md font-bold ';
  if (status >= 200 && status < 300) return base + 'badge-success text-white';
  if (status >= 300 && status < 400) return base + 'badge-warning';
  if (status >= 400 && status < 500) return base + 'badge-error text-white';
  if (status >= 500) return base + 'badge-error text-white';
  return base + 'badge-ghost';
};
