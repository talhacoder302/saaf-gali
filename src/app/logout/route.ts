import { signOut } from "@/lib/auth";

// Only used when a session cookie is still valid but the account was disabled,
// its password reset or its role changed (see requirePageUser). Normal logout
// goes through the logout Server Action.
export async function GET() {
  await signOut({ redirectTo: "/login?expired=1" });
}
