import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().optional().or(z.literal('')),
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.warn('[env] Ungültige Variablen', parsed.error.flatten().fieldErrors);
}

export const env = {
  apiUrl: (parsed.success && parsed.data.EXPO_PUBLIC_API_URL) || undefined,
  supabaseUrl: (parsed.success && parsed.data.EXPO_PUBLIC_SUPABASE_URL) || undefined,
  supabaseAnonKey:
    (parsed.success && parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY) || undefined,
};
