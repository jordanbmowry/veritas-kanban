/**
 * Storage factory / registry.
 *
 * Usage:
 *   import { initStorage, getStorage } from './storage/index.js';
 *
 *   await initStorage('file');          // call once at startup
 *   const storage = getStorage();       // anywhere in the app
 *   const tasks   = await storage.tasks.findAll();
 */

import type { StorageProvider } from './interfaces.js';
import { FileStorageProvider, type FileStorageOptions } from './file-storage.js';
import { SupabaseStorageProvider } from './supabase-storage.js';

export type {
  TaskRepository,
  SettingsRepository,
  ActivityRepository,
  TemplateRepository,
  StatusHistoryRepository,
  ManagedListRepository,
  ManagedListProvider,
  TelemetryRepository,
  StorageProvider,
} from './interfaces.js';
export {
  FileStorageProvider,
  FileTaskRepository,
  FileSettingsRepository,
  FileActivityRepository,
  FileTemplateRepository,
  FileStatusHistoryRepository,
  FileManagedListRepository,
  FileManagedListProvider,
  FileTelemetryRepository,
} from './file-storage.js';
export type { FileStorageOptions } from './file-storage.js';
export { SupabaseStorageProvider } from './supabase-storage.js';

// ---------------------------------------------------------------------------
// Supported backend types (extend this union as new backends are added)
// ---------------------------------------------------------------------------
export type StorageType = 'file' | 'supabase';

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------
let activeProvider: StorageProvider | null = null;

/**
 * Initialise the storage layer.
 *
 * @param type    Backend type – 'file' (default) or 'supabase'.
 * @param options Backend-specific options forwarded to the provider.
 */
export async function initStorage(
  type: StorageType = 'file',
  options?: FileStorageOptions
): Promise<void> {
  // Shut down any previously-active provider
  if (activeProvider) {
    await activeProvider.shutdown();
    activeProvider = null;
  }

  switch (type) {
    case 'file':
      activeProvider = new FileStorageProvider(options);
      break;
    case 'supabase':
      activeProvider = new SupabaseStorageProvider();
      break;
    default: {
      // Exhaustive check – compile error if a new StorageType is added
      // without a matching case.
      const _exhaustive: never = type;
      throw new Error(`Unknown storage type: ${_exhaustive}`);
    }
  }

  await activeProvider.initialize();
}

/**
 * Return the active storage provider.
 *
 * Throws if `initStorage` has not been called yet.
 */
export function getStorage(): StorageProvider {
  if (!activeProvider) {
    throw new Error('Storage has not been initialised. Call initStorage() first.');
  }
  return activeProvider;
}
