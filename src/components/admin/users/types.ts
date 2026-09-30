import type { Role } from "@/lib/roles";
import type { UserStatus } from "@/models/User";
import type { UserRow } from "@/server/users";

export type { UserRow };

export type UsersActor = {
  id: string;
  role: Role;
  manageableRoles: Role[];
};

export type UsersFilters = {
  q: string;
  role: Role | null;
  status: UserStatus | null;
};

/** Shown after creating a user or resetting a password, so the admin can pass it on. */
export type IssuedCredentials = {
  name: string;
  mobile: string;
  password: string;
};
