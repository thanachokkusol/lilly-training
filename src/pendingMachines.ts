import type { Entry } from "./types";

const pendingIds = new Set([2, 3, 7, 15, 18].map((page) => `jett-extra-${page}`));

export const isPendingMachine = (entry: Entry) =>
  entry.kind === "machine" && pendingIds.has(entry.id) && !entry.data.catalogId;
