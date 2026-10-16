/** Controlled, user-facing error texts shared by every screen - never a raw API error body or exception. */
export const NETWORK_ERROR_MESSAGE = "Unable to reach the server. Check your connection and try again.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Maps the two non-business failure kinds every mobile API module returns to one of the messages above. */
export function failureMessage(kind: "network_error" | "error"): string {
  return kind === "network_error" ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE;
}
