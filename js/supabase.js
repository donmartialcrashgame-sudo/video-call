const SUPABASE_URL = 'https://ifzwpwxuczxicqgwakrc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IPecJbLMrs0q6s56vZamJQ_K5B9ZmXt';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

window.VideoCallAuth = {
  async getUser() {
    const { data } = await window.supabaseClient.auth.getUser();
    return data?.user || null;
  },
  async ensureProfile(user) {
    if (!user) return;
    const metadata = user.user_metadata || {};
    const displayName = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'VideoCall User';
    const { error } = await window.supabaseClient.from('profiles').upsert({
      id: user.id,
      email: user.email || null,
      display_name: displayName
    }, { onConflict: 'id' });
    if (error) console.warn('Profile sync:', error.message);
  },
  async signOut() { return window.supabaseClient.auth.signOut(); }
};

window.supabaseClient.auth.onAuthStateChange((_event, session) => {
  window.dispatchEvent(new CustomEvent('videocall-auth-changed', { detail: { session, user: session?.user || null } }));
});

window.supabaseClient.auth.getUser().then(({ data }) => {
  if (data?.user) window.VideoCallAuth.ensureProfile(data.user);
});
