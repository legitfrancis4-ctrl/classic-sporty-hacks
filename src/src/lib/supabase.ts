import { createClient } from '@supabase/supabase-js';

// Publishable browser key. Protect every table with Supabase Row Level Security.
const supabaseUrl = 'https://rucejbrxmpzrwhxqensy.supabase.co';
const supabasePublishableKey = 'sb_publishable_mwcZkzvRe_Q38EiZmhlngg_PXv6Zo8n';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});