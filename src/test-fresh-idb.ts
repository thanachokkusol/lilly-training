// Import before the app in UI tests: install fake IndexedDB classes and give this file its own
// empty database, so records written by other test files in the same worker never leak in.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
globalThis.indexedDB = new IDBFactory();
