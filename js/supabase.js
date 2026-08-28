const SUPABASE_URL = 'https://ifzwpwxuczxicqgwakrc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IPecJbLMrs0q6s56vZamJQ_K5B9ZmXt';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Profiles are created by the database trigger on auth.users.
// Never write to public.profiles from the browser during authentication.
window.VideoCallAuth = {
  async getUser() {
    const { data, error } = await window.supabaseClient.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  },
  async signOut() {
    return window.supabaseClient.auth.signOut();
  }
};

window.supabaseClient.auth.onAuthStateChange((_event, session) => {
  window.dispatchEvent(new CustomEvent('videocall-auth-changed', {
    detail: { session, user: session?.user || null }
  }));
});
