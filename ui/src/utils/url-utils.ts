/**
 * 表示用にURLを切り詰めます。
 * @param {string} url - 対象のURL
 * @param {number} maxLength - 最大文字数 (デフォルト 100)
 * @returns {string} 整形されたURL
 */
export const displayUrl = (url: string | null | undefined, maxLength: number = 100): string => {
  if (!url) return '';
  if (url.length > maxLength) {
    return url.substring(0, maxLength - 3) + '...';
  }
  return url;
};
