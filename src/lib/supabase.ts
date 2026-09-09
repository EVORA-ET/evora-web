import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://edbzixcrhfvukkgaajpj.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkYnppeGNyaGZ2dWtrZ2FhanBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjAyNDQsImV4cCI6MjA5OTUzNjI0NH0.qebjwZcv5dzW0TsTHFOOOTH9h7Oclwzl8aY9Rxfo1zk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
