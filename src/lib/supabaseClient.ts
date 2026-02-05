import { createClient } from '@supabase/supabase-js';

// Vite környezeti változók lekérése
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Profi check: Ha nincs kulcs, nem dobunk Error-t, csak null-t adunk vissza
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ HIÁNYZÓ SUPABASE KULCSOK! Ellenőrizd a Vercel Environment Variables beállításait.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = !!supabase;