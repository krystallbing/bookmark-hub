import type { BookmarkHubDB } from '@bookmark-hub/db';

export function refreshBookmarksFTS(db: BookmarkHubDB, bookmarkIds: string[]): number {
  const uniqueIds = Array.from(new Set(bookmarkIds));
  let refreshed = 0;

  for (const id of uniqueIds) {
    const bookmark = db.getBookmarkById(id);
    if (!bookmark) continue;

    const tags = db.getBookmarkTags(id).map((tag) => tag.name);
    db.indexBookmarkFTS(bookmark, tags);
    refreshed += 1;
  }

  return refreshed;
}
