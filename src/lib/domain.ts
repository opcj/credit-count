import { z } from "zod";
import type { Database } from "./database.types";

export type Coaster = Database["public"]["Tables"]["coasters"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Ride = Database["public"]["Tables"]["rides"]["Row"] & {
  coaster: Coaster;
};
export type LeaderboardRow = { display_name: string; credit_count: number };
const characters = (value: string) => Array.from(value).length;
const text = (max: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => characters(v) > 0 && characters(v) <= max,
      `Use between 1 and ${max} characters.`,
    );
export const displayNameSchema = text(50);
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");
export const emailSchema = z.email("Enter a valid email address.").max(254);

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export const rideSchema = z.object({
  coaster_id: z.uuid("Choose a coaster."),
  ridden_on: z.string().refine(isCalendarDate, "Choose a valid calendar date."),
  note: z
    .string()
    .trim()
    .refine(
      (v) => characters(v) <= 500,
      "Keep your note to 500 characters or fewer.",
    )
    .transform((v) => v || null),
});
export const coasterSchema = z.object({
  name: text(120),
  park: text(120),
  manufacturer: text(100),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code, such as GB."),
  type: z.enum(["steel", "wooden", "hybrid"]),
  source_url: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (v.startsWith("https://") && URL.canParse(v) && v.length <= 500),
      "Use a valid https:// source URL.",
    )
    .transform((v) => v || null),
});
const breakdown = z.array(z.object({ label: z.string(), count: z.number() }));
export const statsSchema = z.object({
  total_credits: z.number(),
  total_rides: z.number(),
  by_country: breakdown,
  by_manufacturer: breakdown,
  by_type: breakdown,
  most_ridden: z
    .object({
      id: z.string(),
      name: z.string(),
      park: z.string(),
      rides: z.number(),
    })
    .nullable(),
});
export type Stats = z.infer<typeof statsSchema>;
export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
export function safeNext(value: string | null, fallback = "/dashboard") {
  if (!value || /[\\\r\n]/.test(value)) return fallback;
  const allowed = [
    "/dashboard",
    "/coasters",
    "/rides",
    "/settings",
    "/admin/coasters",
    "/reset-password",
  ];
  return allowed.includes(value) ? value : fallback;
}
