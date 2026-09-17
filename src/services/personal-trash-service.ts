import { z } from "zod";
import { supabase } from "@/lib/supabase";
export type PersonalTrashKind = "folder" | "binder" | "document" | "note";
export type PersonalTrashItem = { kind: PersonalTrashKind; id: string; title: string; archived_at: string };
const trashSchema = z.array(z.object({ kind: z.enum(["folder", "binder", "document", "note"]), id: z.string(), title: z.string(), archived_at: z.string() }));
function client() { if (!supabase) throw new Error("Sign in to manage your trash."); return supabase; }
export async function listPersonalTrash(): Promise<PersonalTrashItem[]> {
  const { data, error } = await client().rpc("list_personal_trash");
  if (error) throw error;
  const result = trashSchema.safeParse(data);
  if (!result.success) throw new Error("Trash returned an invalid response. Your items have not been changed.");
  return result.data;
}
export async function setPersonalTrash(kind: PersonalTrashKind, id: string, action: "trash" | "restore" | "delete", confirmation?: string) {
  if (action === "delete" && confirmation !== "DELETE") throw new Error("Type DELETE to permanently delete this item and its contents.");
  const { error } = await client().rpc("set_personal_trash", { p_kind: kind, p_id: id, p_action: action, p_confirmation: confirmation ?? null });
  if (error) {
    if (error.message.includes("TRASH_PARENT_ARCHIVED")) throw new Error("Restore the containing folder or course first.");
    throw error;
  }
}
