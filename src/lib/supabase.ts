import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use the exact credentials provided by the user
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dhwYO-iAk7RyRe7J-0BEFg_uiGJOMHy';

// 直接连接 Supabase (如果在国内可能会被墙，需要代理)
let validUrl = 'https://getofgqtvxcqhaprsrze.supabase.co';

export let supabase: SupabaseClient;
export let isSupabaseConfigured = false;

try {
  supabase = createClient(validUrl, supabaseAnonKey);
  isSupabaseConfigured = true;
} catch (e) {
  console.error("Supabase init error:", e);
  supabase = createClient('https://placeholder.supabase.co', 'placeholder_key');
}
