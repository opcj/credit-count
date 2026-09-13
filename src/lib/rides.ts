import { browserClient } from "./supabase/browser";
import { rideSchema } from "./domain";
import { ConflictError } from "./errors";

export async function saveRide(
  id: string,
  input: { coaster_id: string; ridden_on: string; note: string },
) {
  const values = rideSchema.parse(input);
  const db = browserClient();
  const result = await db
    .from("rides")
    .insert({ id, ...values })
    .select("id")
    .single();
  if (!result.error) return;
  // A transport failure leaves the attempt uncertain; retry the same UUID and values.
  if (!result.error.code) throw result.error;
  // BEFORE INSERT validation can reject an archived coaster before UUID uniqueness
  // runs. Reconcile every database rejection through owner RLS, regardless of SQL code.
  const existing = await db
    .from("rides")
    .select("coaster_id, ridden_on, note")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) {
    // Keep the attempt frozen: a failed read cannot establish that nothing saved.
    throw new Error("The original save could not be confirmed.", {
      cause: existing.error,
    });
  }
  const record = existing.data;
  if (record) {
    if (
      Object.entries(values).every(
        ([key, value]) => record[key as keyof typeof record] === value,
      )
    )
      return;
    throw new ConflictError();
  }
  // Only a successful reconciliation read with no owned row permits rejection.
  throw result.error;
}
export async function updateRide(
  id: string,
  revision: number,
  input: { coaster_id: string; ridden_on: string; note: string },
) {
  const values = rideSchema.parse(input);
  const result = await browserClient()
    .from("rides")
    .update(values)
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new ConflictError();
}
export async function deleteRide(id: string, revision: number) {
  const result = await browserClient()
    .from("rides")
    .delete()
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new ConflictError();
}
