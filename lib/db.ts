'use client';

/**
 * IndexedDB project persistence using the `idb` library.
 * Stores full ProjectFile objects keyed by metadata.id.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ProjectFile } from '@/types/project';

const DB_NAME    = 'lotus-shark-online';
const DB_VERSION = 1;
const STORE      = 'projects';

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'metadata.id' });
        store.createIndex('by_modified', 'metadata.modified');
        store.createIndex('by_name',     'metadata.name');
      }
    },
  });
  return _db;
}

export async function dbSave(project: ProjectFile): Promise<void> {
  const db = await getDB();
  await db.put(STORE, project);
}

export async function dbLoad(id: string): Promise<ProjectFile | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function dbList(): Promise<ProjectFile[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  // Sort newest first by modified date
  return all.sort((a, b) =>
    new Date(b.metadata.modified).getTime() - new Date(a.metadata.modified).getTime()
  );
}

export async function dbDelete(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function dbCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}
