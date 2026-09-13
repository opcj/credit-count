export class ConflictError extends Error {
  constructor() {
    super(
      "This entry changed in another tab or was removed. Reload the latest version before trying again.",
    );
  }
}
export function friendlyError(error: unknown) {
  if (error instanceof ConflictError) return error.message;
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "23503")
    return "This coaster has ride history. Archive it to keep those rides safe, or merge a duplicate.";
  if (code === "23505")
    return "An entry with these details already exists. Check the catalogue before adding it again.";
  if (code === "23514")
    return "Check your values and choose an active coaster. The catalogue may have changed.";
  if (code === "42501")
    return "You do not have permission for this action. Try signing in again.";
  if (["40001", "40P01"].includes(code))
    return "Another change happened at the same time. Reload and review your changes before trying again.";
  if (code === "22023")
    return "This selection is no longer valid. Reload and choose an active destination.";
  return "We couldn’t complete that request. Your changes haven’t been confirmed. Check your connection and try again.";
}
