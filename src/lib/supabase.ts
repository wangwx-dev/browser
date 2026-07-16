import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from VITE_ or NEXT_PUBLIC_, otherwise use the exact credentials provided by the user
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://getofgqtvxcqhaprsrze.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dhwYO-iAk7RyRe7J-0BEFg_uiGJOMHy';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// 本地开发直连，线上部署走同源反向代理绕过墙
let validUrl = isLocal 
  ? 'https://getofgqtvxcqhaprsrze.supabase.co'
  : (typeof window !== 'undefined' ? `${window.location.origin}/api/supabase` : 'https://getofgqtvxcqhaprsrze.supabase.co');

export let supabase: SupabaseClient;
export let isSupabaseConfigured = false;

try {
  supabase = createClient(validUrl, supabaseAnonKey);
  isSupabaseConfigured = true;
} catch (e) {
  console.error("Supabase init error:", e);
  supabase = createClient('https://placeholder.supabase.co', 'placeholder_key');
}
