import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const createClient = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
