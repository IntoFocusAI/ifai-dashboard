import { cookies } from "next/headers";
import { ACCOUNT_PARAM, ACTIVE_ACCOUNT_COOKIE } from "@/lib/portal/contract";
import { dashboardAccountsSource, e2eAuthBypass } from "@/lib/portal/mode";
import { signedInClientAllowed } from "@/lib/portal/resolve";
import { createClient } from "@/lib/supabase/server";

/* Server only. Re-checks a brand from a URL before a download or a staff page reads it
   (issue 248). The URL's client and account are selectors; this asks the database. */

export async function requestMayReadClient(url: URL, clientKey: string): Promise<boolean> {
  if (dashboardAccountsSource() === "command" || e2eAuthBypass()) return true;
  const jar = await cookies();
  const supabase = await createClient();
  return signedInClientAllowed(
    supabase,
    {
      accountParam: url.searchParams.get(ACCOUNT_PARAM),
      rememberedAccount: jar.get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null,
    },
    clientKey,
  );
}
