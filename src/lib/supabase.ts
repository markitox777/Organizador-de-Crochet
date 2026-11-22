import { createClient } from '@supabase/supabase-js';

/**
 * Cliente público de Supabase para Kurotex.
 * Configura las variables VITE_SUPABASE_URL y
 * VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.
 * No incluyas claves secretas ni service_role en el frontend.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
