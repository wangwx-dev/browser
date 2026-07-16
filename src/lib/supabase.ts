import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from VITE_ or NEXT_PUBLIC_, otherwise use the exact credentials provided by the user
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://getofgqtvxcqhaprsrze.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dhwYO-iAk7RyRe7J-0BEFg_uiGJOMHy';

let validUrl = rawUrl;
if (rawUrl.includes('[') || rawUrl.includes(']')) {
  validUrl = 'https://getofgqtvxcqhaprsrze.supabase.co';
}

export let supabase: SupabaseClient;
export let isSupabaseConfigured = false;

try {
  supabase = createClient(validUrl, supabaseAnonKey);
  isSupabaseConfigured = true;
} catch (e) {
  console.error("Supabase init error:", e);
  supabase = createClient('https://placeholder.supabase.co', 'placeholder_key');
}
