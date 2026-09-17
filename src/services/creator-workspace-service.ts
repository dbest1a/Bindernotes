import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { editorDocumentSchema, mathBlockSchema } from "@/lib/personal-content-contract";
import { ContentConflictError } from "@/lib/revisioned-save";
import type { Binder, BinderLesson, Profile } from "@/types";

const id = z.string().min(1).max(2000);
const time = z.string().datetime({ offset: true });
export const creatorBinderInputSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(500),
    slug: z.string().min(1).max(500),
    description: z.string().max(100000),
    subject: z.string().min(1).max(500),
    level: z.string().max(500),
    status: z.enum(["draft", "published", "archived"]),
    price_cents: z.number().int().min(0).max(10000000),
    cover_url: z.string().nullable(),
    pinned: z.boolean(),
  })
  .strict();
export const creatorLessonInputSchema = z
  .object({
    id,
    binder_id: id,
    title: z.string().trim().min(1).max(500),
    order_index: z.number().int().min(0).max(100000),
    is_preview: z.boolean(),
    content: editorDocumentSchema,
    math_blocks: z.array(mathBlockSchema).max(10000),
  })
  .strict();
export type CreatorBinderInput = z.infer<typeof creatorBinderInputSchema>;
export type CreatorLessonInput = z.infer<typeof creatorLessonInputSchema>;
export type CreatorAccess = { allowed: boolean; operator: boolean };
export type CreatorLessonSummary = Pick<
  BinderLesson,
  "id" | "binder_id" | "title" | "order_index" | "is_preview" | "created_at" | "updated_at"
>;
const binderSchema = creatorBinderInputSchema
  .extend({
    owner_id: z.string().uuid(),
    suite_template_id: id.nullable().optional(),
    created_at: time,
    updated_at: time,
  })
  .passthrough();
const lessonSchema = creatorLessonInputSchema.extend({ created_at: time, updated_at: time }).passthrough();
const summarySchema = lessonSchema.omit({ content: true, math_blocks: true });
function client(ownerId: string) {
  if (!supabase || saveQueue.getAccount() !== ownerId)
    throw new Error("Sign in to the account that owns this creator workspace.");
  return supabase;
}
function active(ownerId: string) {
  client(ownerId);
}
export async function getCreatorAccess(profile: Profile): Promise<CreatorAccess> {
  const database = client(profile.id);
  if (profile.role === "admin") return { allowed: true, operator: true };
  const { data, error } = await database
    .from("account_entitlements")
    .select("user_id,plan,status,valid_until")
    .eq("user_id", profile.id)
    .maybeSingle();
  active(profile.id);
  if (error) throw new Error("Creator access could not be checked. Retry when your connection is available.");
  if (!data) return { allowed: false, operator: false };
  const entitlement = z
    .object({
      user_id: z.string().uuid(),
      plan: z.enum(["free", "plus", "studio", "everything"]),
      status: z.enum(["active", "inactive"]),
      valid_until: time.nullable(),
    })
    .parse(data);
  if (entitlement.user_id !== profile.id)
    throw new Error("Creator access response belongs to another account.");
  return {
    allowed:
      entitlement.status === "active" &&
      ["studio", "everything"].includes(entitlement.plan) &&
      (!entitlement.valid_until || Date.parse(entitlement.valid_until) > Date.now()),
    operator: false,
  };
}
async function requireAccess(profile: Profile) {
  if (!(await getCreatorAccess(profile)).allowed)
    throw new Error("An active creator entitlement is required to author binders.");
}
function ownedBinder(raw: unknown, ownerId: string): Binder {
  const binder = binderSchema.parse(raw);
  if (binder.owner_id !== ownerId || binder.suite_template_id != null)
    throw new Error("Only your own independent binders can be managed here.");
  return binder as Binder;
}
export async function listCreatorBinders(profile: Profile): Promise<Binder[]> {
  await requireAccess(profile);
  const rows: Binder[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client(profile.id)
      .from("binders")
      .select("*")
      .eq("owner_id", profile.id)
      .is("suite_template_id", null)
      .order("id")
      .range(offset, offset + 99);
    active(profile.id);
    if (error || !Array.isArray(data)) throw new Error("Your creator binders could not be loaded.");
    rows.push(...data.map((row) => ownedBinder(row, profile.id)));
    if (data.length < 100) return rows;
  }
}
async function readOwnedBinder(profile: Profile, binderId: string) {
  const { data, error } = await client(profile.id)
    .from("binders")
    .select("*")
    .eq("id", binderId)
    .eq("owner_id", profile.id)
    .is("suite_template_id", null)
    .maybeSingle();
  active(profile.id);
  if (error || !data) throw new Error("This binder is unavailable in your creator workspace.");
  return ownedBinder(data, profile.id);
}
export async function readCreatorBinder(profile: Profile, binderId: string) {
  await requireAccess(profile);
  return readOwnedBinder(profile, binderId);
}
export async function listCreatorLessons(
  profile: Profile,
  binderId: string,
): Promise<CreatorLessonSummary[]> {
  await requireAccess(profile);
  await readOwnedBinder(profile, binderId);
  const rows: CreatorLessonSummary[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client(profile.id)
      .from("binder_lessons")
      .select("id,binder_id,title,order_index,is_preview,created_at,updated_at")
      .eq("binder_id", binderId)
      .order("order_index")
      .order("id")
      .range(offset, offset + 99);
    active(profile.id);
    if (error || !Array.isArray(data)) throw new Error("Your lessons could not be loaded.");
    for (const raw of data) {
      const row = summarySchema.parse(raw);
      if (row.binder_id !== binderId) throw new Error("Lesson parent mismatch.");
      rows.push(row);
    }
    if (data.length < 100) return rows;
  }
}
export async function readCreatorLesson(
  profile: Profile,
  binderId: string,
  lessonId: string,
): Promise<BinderLesson> {
  await requireAccess(profile);
  await readOwnedBinder(profile, binderId);
  const { data, error } = await client(profile.id)
    .from("binder_lessons")
    .select("*")
    .eq("binder_id", binderId)
    .eq("id", lessonId)
    .maybeSingle();
  active(profile.id);
  if (error || !data) throw new Error("Your lesson could not be loaded.");
  const lesson = lessonSchema.parse(data);
  if (lesson.binder_id !== binderId || lesson.id !== lessonId) throw new Error("Lesson parent mismatch.");
  return lesson as BinderLesson;
}
function nextTimestamp(expected: string | null) {
  return new Date(Math.max(Date.now(), expected ? Date.parse(time.parse(expected)) + 1 : 0)).toISOString();
}
function sameFields(wanted: Record<string, unknown>, saved: Record<string, unknown>) {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, child]) => [key, stable(child)]),
          )
        : value;
  return Object.keys(wanted).every(
    (key) => JSON.stringify(stable(wanted[key])) === JSON.stringify(stable(saved[key])),
  );
}
export async function saveCreatorBinder(
  profile: Profile,
  raw: CreatorBinderInput,
  expectedUpdatedAt: string | null,
): Promise<Binder> {
  await requireAccess(profile);
  const input = creatorBinderInputSchema.parse(raw);
  if (expectedUpdatedAt) await readOwnedBinder(profile, input.id);
  const dataToWrite = { ...input, owner_id: profile.id, updated_at: nextTimestamp(expectedUpdatedAt) };
  const query = expectedUpdatedAt
    ? client(profile.id)
        .from("binders")
        .update(dataToWrite)
        .eq("id", input.id)
        .eq("owner_id", profile.id)
        .is("suite_template_id", null)
        .eq("updated_at", expectedUpdatedAt)
    : client(profile.id)
        .from("binders")
        .insert({ ...dataToWrite, suite_template_id: null });
  const { data, error } = await query.select("*").maybeSingle();
  active(profile.id);
  if (!error && data) return ownedBinder(data, profile.id);
  // A lost acknowledgement can be confirmed by the stable draft ID and complete saved fields.
  let current: Binder | null = null;
  try {
    current = await readOwnedBinder(profile, input.id);
  } catch {
    /* Keep the draft on unavailable reads. */
  }
  if (current && sameFields(input, current as unknown as Record<string, unknown>)) return current;
  if (current && current.updated_at !== expectedUpdatedAt) throw new ContentConflictError();
  throw new Error("Binder save could not be confirmed. Your device draft is retained; retry.");
}
export async function saveCreatorLesson(
  profile: Profile,
  raw: CreatorLessonInput,
  expectedUpdatedAt: string | null,
): Promise<BinderLesson> {
  await requireAccess(profile);
  const input = creatorLessonInputSchema.parse(raw);
  await readOwnedBinder(profile, input.binder_id);
  const dataToWrite = { ...input, updated_at: nextTimestamp(expectedUpdatedAt) };
  const query = expectedUpdatedAt
    ? client(profile.id)
        .from("binder_lessons")
        .update(dataToWrite)
        .eq("id", input.id)
        .eq("binder_id", input.binder_id)
        .eq("updated_at", expectedUpdatedAt)
    : client(profile.id).from("binder_lessons").insert(dataToWrite);
  const { data, error } = await query.select("*").maybeSingle();
  active(profile.id);
  if (!error && data) {
    const saved = lessonSchema.parse(data);
    if (saved.id !== input.id || saved.binder_id !== input.binder_id)
      throw new Error("Lesson save identity mismatch.");
    return saved as BinderLesson;
  }
  let current: BinderLesson | null = null;
  try {
    current = await readCreatorLesson(profile, input.binder_id, input.id);
  } catch {
    /* Keep the draft. */
  }
  if (current && sameFields(input, current as unknown as Record<string, unknown>)) return current;
  if (current && current.updated_at !== expectedUpdatedAt) throw new ContentConflictError();
  throw new Error("Lesson save could not be confirmed. Your device draft is retained; retry.");
}
