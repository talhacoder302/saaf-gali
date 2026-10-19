"use server";

import type { ActionResult } from "@/lib/action-result";
import type { WorkerStatus } from "@/lib/duties";
import type { UpdateWorkerInput, WorkerFormInput, WorkerLoginInput } from "@/lib/validators/workers";
import { runMutation } from "@/server/run-action";
import { createWorker, createWorkerLogin, setWorkerStatus, updateWorker } from "@/server/workers";

// Thin wrappers: every permission and area check lives in src/server/workers.ts.

export async function createWorkerAction(
  input: WorkerFormInput,
): Promise<ActionResult<{ id: string; login: { name: string; mobile: string } | null }>> {
  return runMutation(() => createWorker(input));
}

export async function updateWorkerAction(input: UpdateWorkerInput): Promise<ActionResult<{ droppedDuties: number }>> {
  return runMutation(() => updateWorker(input));
}

export async function setWorkerStatusAction(id: string, status: WorkerStatus): Promise<ActionResult<{ droppedDuties: number }>> {
  return runMutation(() => setWorkerStatus({ id, status }));
}

export async function createWorkerLoginAction(input: WorkerLoginInput): Promise<ActionResult<{ name: string; mobile: string }>> {
  return runMutation(() => createWorkerLogin(input));
}
