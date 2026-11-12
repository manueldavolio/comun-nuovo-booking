import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server routes only. Never import this module into a client component.
export const supabase = createClient(supabaseUrl, serverKey, {
  auth: { persistSession: false },
});