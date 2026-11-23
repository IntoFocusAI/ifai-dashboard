#!/usr/bin/env node
/*
 * Test logins for checking deploy previews: one IntoFocus staff user, one Fender client user,
 * one Ledlenser client user. NOT RUN YET. Brian Watson runs it (or approves running it).
 *
 * What it changes (production Supabase project, via the Auth admin API and the service role):
 *   - Creates up to three auth.users rows with confirmed emails and the passwords you pass in.
 *   - Adds command.user_profiles rows for them.
 *   - Adds active command.organization_memberships rows:
 *       staff      -> intofocus-ai  as intofocus_admin (IntoFocus staff)
 *       fender     -> fender        as org_viewer
 *       ledlenser  -> ledlenser     as org_viewer
 *   Existing users with the same email are reused, not changed (their password stays as it is).
 *
 * How to undo:  node scripts/preview-test-users.mjs --undo
 *   Deletes the three auth users by email. Their profile and membership rows go with them
 *   (both tables reference auth.users ON DELETE CASCADE). Only run --undo if the users were
 *   created by this script, not reused.
 *
 * Environment (none of these are stored in the repo):
 *   SUPABASE_URL                 or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    service role key (Supabase dashboard > Project Settings > API)
 *   PREVIEW_STAFF_EMAIL          PREVIEW_STAFF_PASSWORD
 *   PREVIEW_FENDER_EMAIL         PREVIEW_FENDER_PASSWORD
 *   PREVIEW_LEDLENSER_EMAIL      PREVIEW_LEDLENSER_PASSWORD
 * A pair left unset is skipped.
 */
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS = [
  { key: "STAFF", org: "intofocus-ai", role: "intofocus_admin" },
  { key: "FENDER", org: "fender", role: "org_viewer" },
  { key: "LEDLENSER", org: "ledlenser", role: "org_viewer" },
];

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const undo = process.argv.includes("--undo");
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const command = supabase.schema("command");

async function findUserByEmail(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

async function orgId(slug) {
  const { data, error } = await command
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(`Organization ${slug}: ${error.message}`);
  return data.id;
}

for (const account of ACCOUNTS) {
  const email = process.env[`PREVIEW_${account.key}_EMAIL`];
  const password = process.env[`PREVIEW_${account.key}_PASSWORD`];
  if (!email || (!undo && !password)) {
    console.log(`${account.key}: skipped (email or password not set)`);
    continue;
  }

  const existing = await findUserByEmail(email);

  if (undo) {
    if (!existing) {
      console.log(`${account.key}: ${email} not found`);
      continue;
    }
    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) throw error;
    console.log(`${account.key}: deleted ${email}`);
    continue;
  }

  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`${account.key}: created ${email}`);
  } else {
    console.log(`${account.key}: reusing ${email}`);
  }

  const { error: profileError } = await command
    .from("user_profiles")
    .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  if (profileError) throw profileError;

  const { error: memberError } = await command.from("organization_memberships").upsert(
    {
      organization_id: await orgId(account.org),
      user_id: userId,
      role: account.role,
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );
  if (memberError) throw memberError;
  console.log(`${account.key}: ${account.role} on ${account.org}`);
}
