/**
 * ページネーションで表示するページ番号の配列を計算します
 */
export function getDisplayedPages(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5,
): number[] {
  const pages = [];
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}

/**
 * ページ遷移が可能かどうかを判定し、有効な場合はコールバックを実行します
 */
export function handlePageChange(
  page: number,
  totalPages: number,
  onSuccess: (page: number) => void,
): void {
  if (page < 1 || page > totalPages) return;
  onSuccess(page);
}

export function handleLimitChange(newLimit: number, onSuccess: (limit: number) => void): void {
  onSuccess(newLimit);
}
