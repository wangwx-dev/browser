import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

// Fix malformed URL issue gracefully without crashing the app
let validUrl = rawUrl;
if (rawUrl.includes('[') || rawUrl.includes(']')) {
  // Fallback to a valid placeholder so the app doesn't crash on load
  validUrl = 'https://placeholder.supabase.co';
}

export let supabase: SupabaseClient;
export let isSupabaseConfigured = false;

try {
  supabase = createClient(validUrl, supabaseAnonKey);
  // Basic check if it's not the placeholder
  if (validUrl !== 'https://placeholder.supabase.co' && !validUrl.includes('YOUR_PROJECT_ID')) {
    isSupabaseConfigured = true;
  }
} catch (e) {
  console.error("Supabase init error:", e);
  // Initialize with a dummy so the app doesn't crash on import
  supabase = createClient('https://placeholder.supabase.co', 'placeholder_key');
}
