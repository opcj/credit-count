import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "./supabase/server";
import { statsSchema, type Ride } from "./domain";

export const requireViewer = cache(async () => {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/sign-in");
  const [profile, admin] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", user.id).single(),
    db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (profile.error || admin.error)
    throw new Error("Your account could not be loaded.");
  return { user, profile: profile.data, isAdmin: !!admin.data };
});
export async function getCatalogue(includeArchived = false) {
  const db = await serverClient();
  let query = db.from("coasters").select("*").order("name");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("The catalogue could not be loaded.");
  return data;
}
export async function getStats() {
  const db = await serverClient();
  const { data, error } = await db.rpc("get_my_stats");
  if (error) throw new Error("Your statistics could not be loaded.");
  return statsSchema.parse(data);
}
export async function getHistory(page = 1, size = 12) {
  const db = await serverClient();
  const { data, error, count } = await db
    .from("rides")
    .select("*, coaster:coasters(*)", { count: "exact" })
    .order("ridden_on", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (error) throw new Error("Your ride history could not be loaded.");
  return { rides: data as Ride[], count: count ?? 0 };
}
