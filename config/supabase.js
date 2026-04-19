import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or API Key in environment variables');
}

// Client for frontend operations (anon key)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for backend operations (service key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;
