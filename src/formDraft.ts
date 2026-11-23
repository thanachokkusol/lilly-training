import type { Entry } from "./types";

export type FormDraft = {
  version: string;
  fields: Record<string, string>;
  at: number;
};

export function recoverFormDraft(
  cached: FormDraft | null,
  record: Entry | undefined,
  version: string,
): Record<string, string> {
  const discardedAt = record?.deleted ? Date.parse(record.updatedAt) : -Infinity;
  const eligible = (draft: FormDraft | null | undefined) =>
    draft?.version === version && draft.at > discardedAt ? draft : null;
  const local = eligible(cached);
  const synced = eligible(record?.deleted ? null : record?.data);
  return ((local?.at ?? -Infinity) >= (synced?.at ?? -Infinity) ? local : synced)?.fields ?? {};
}
