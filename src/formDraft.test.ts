import { expect, it } from "vitest";
import { recoverFormDraft } from "./formDraft";
import type { Entry } from "./types";

it("recovers a synced draft on another device without reviving a discarded draft", () => {
  const data = { version: "", fields: { time: "12:34" }, at: 100 };
  const record: Entry = { id: "draft", kind: "settings", data, dirty: false,
    version: 1, updatedAt: new Date(200).toISOString() };
  expect(recoverFormDraft(null, record, "")).toEqual(data.fields);
  expect(recoverFormDraft(data, { ...record, deleted: true }, "")).toEqual({});
  expect(recoverFormDraft(null, record, "new revision")).toEqual({});
});
