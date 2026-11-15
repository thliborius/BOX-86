// Changing the collection identity invalidates level results, never general preferences.
export const LEVEL_PACK_ID = "warehouse-100-v2";
export const LEVEL_COUNT = 100;
export const validLevelId = (id: unknown): id is string =>
  typeof id === "string" && /^(?:[1-9]|[1-9][0-9]|100)$/.test(id);
