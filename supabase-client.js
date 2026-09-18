// Shared Supabase client — loaded before auth.js, signup.js, and dashboard.js
// Requires the Supabase JS library <script> tag to be included first.

const SUPABASE_URL = 'https://hjzevqeopdcftjrkdtpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XdW7tApGDEUcbyhMUrct1A_MZNu5wpP';

// Named `sbClient` (not `supabase`) to avoid clashing with the
// global `supabase` object the CDN library itself exposes.
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
