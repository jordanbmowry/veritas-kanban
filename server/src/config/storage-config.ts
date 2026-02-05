/**
 * Storage Backend Configuration
 *
 * Selects and initializes the appropriate storage backend based on environment.
 * STORAGE_BACKEND env var: 'file' (default) or 'supabase'
 */

import { initStorage, type StorageType } from '../storage/index.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('storage-config');

export async function initializeStorageBackend(): Promise<void> {
  const storageBackend = (process.env.STORAGE_BACKEND || 'file') as StorageType;

  log.info({ backend: storageBackend }, 'Initializing storage backend');

  if (storageBackend === 'supabase') {
    // Verify Supabase env vars are set before initializing
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase storage backend selected but SUPABASE_URL or SUPABASE_ANON_KEY not set'
      );
    }
    log.info('Supabase database URL configured');
  }

  try {
    await initStorage(storageBackend);
    log.info({ backend: storageBackend }, 'Storage backend initialized successfully');
  } catch (error) {
    log.error({ err: error, backend: storageBackend }, 'Failed to initialize storage backend');
    throw error;
  }
}
