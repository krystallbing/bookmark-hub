import { BookmarkHubDB } from '@bookmark-hub/db';

let _db: BookmarkHubDB | null = null;

export function getDB(): BookmarkHubDB {
  if (!_db) {
    _db = new BookmarkHubDB();
    _db.initialize();
  }
  return _db;
}
