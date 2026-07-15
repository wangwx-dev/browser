import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export interface Database {
  public: {
    Tables: {
      user_nav_configs: {
        Row: {
          id: string;
          user_id: string;
          nav_data: any; // We will store the JSON array here
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nav_data: any;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nav_data?: any;
          updated_at?: string;
        };
      };
    };
  };
}
