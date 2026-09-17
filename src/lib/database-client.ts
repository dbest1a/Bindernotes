import { z } from "zod";
import type { Json } from "@/lib/database.generated";
/** Unknown canvas/archive payloads must be valid JSON before entering typed RPCs. */
export function databaseJson(value: unknown): Json { return z.json().parse(value); }
