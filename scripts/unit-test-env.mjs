/* Unit tests never read the live database. A few tests load the canvas bundle or the site types
   with no fake client, and when the shell has NEXT_PUBLIC_SUPABASE_* set (a cloud agent, a local
   .env export) those reads went to production as signed-out requests and showed up as 401s in the
   Supabase logs (23 Nov 2026). With the variables unset the reads fail fast and fall back, which
   is what the GitHub unit-test job already sees. A test that needs a URL sets its own. */
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]) {
  delete process.env[name];
}
