import "server-only";

import { connectDB } from "@/lib/db";
import { env, features } from "@/lib/env";

export type DatabaseStatus = "connected" | "not_configured" | "error";

export type HealthReport = {
  ok: boolean;
  database: DatabaseStatus;
  databaseName: string;
  features: typeof features;
  checkedAt: string;
};

async function checkDatabase(): Promise<DatabaseStatus> {
  if (!env.MONGODB_URI) return "not_configured";
  try {
    const mongoose = await connectDB();
    await mongoose.connection.db?.admin().ping();
    return "connected";
  } catch (error) {
    console.error("[health] database check failed", error);
    return "error";
  }
}

export async function getHealth(): Promise<HealthReport> {
  const database = await checkDatabase();
  return {
    ok: database === "connected",
    database,
    databaseName: env.MONGODB_DB_NAME,
    features,
    checkedAt: new Date().toISOString(),
  };
}
