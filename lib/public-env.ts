// These values are public browser credentials, not service-role secrets.
// The fallbacks keep provider builds functional when NEXT_PUBLIC_* variables
// are only injected at runtime.
export const publicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jhcjxqrpyvqdwwdtksvy.supabase.co";

export const publicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoY2p4cXJweXZxZHd3ZHRrc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNDUwNDAsImV4cCI6MjEwMjgyMTA0MH0.n9sjbv2dHLMnoIgrVkLzT96mQl0GkD-muKliFnYqxLQ";
