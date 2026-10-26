import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export async function api(operation, payload = {}) {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  const { data, error } = await supabase.functions.invoke('strategist-api', { body: { operation, ...payload } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
