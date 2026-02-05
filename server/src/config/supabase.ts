/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client from environment variables.
 * SUPABASE_URL and SUPABASE_ANON_KEY are required.
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('supabase-config');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

log.info('Supabase client initialized');
