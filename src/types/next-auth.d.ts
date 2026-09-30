import type { Locale } from "@/i18n/config";
import type { SessionUser } from "@/lib/auth-types";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role: Role;
    areaIds: string[];
    householdId: string | null;
    language: Locale;
    mustChangePassword: boolean;
    sessionVersion: number;
  }

  interface Session {
    user: SessionUser;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    areaIds?: string[];
    householdId?: string | null;
    language?: Locale;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}
