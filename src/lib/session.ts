import { supabase } from "./supabase";

export async function signOutAndGoHome() {
  await supabase.auth.signOut();
  window.location.assign("/");
}
