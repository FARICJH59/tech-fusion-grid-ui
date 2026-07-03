"use client";

import { useEffect, useState } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let clientSingleton: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!clientSingleton) {
    clientSingleton = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientSingleton;
}

export function useSupabase(): { user: User | null; supabase: SupabaseClient } {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { user, supabase };
}
