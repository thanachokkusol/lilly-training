// @vitest-environment jsdom
import "./test-fresh-idb";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

const state = vi.hoisted(() => ({
  onAuth: (_event: string, _session: unknown) => {},
  verify: () => {},
  finishSync: () => {},
  syncs: 0,
}));
vi.mock("./cloud", async (original) => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (listener: typeof state.onAuth) => {
        state.onAuth = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword: async () => {
        state.onAuth("SIGNED_IN", { user: { id: "friend" } });
        return { error: null };
      },
    },
    rpc: () => new Promise((resolve) => { state.verify = () => resolve({ data: true, error: null }); }),
  };
  return {
    ...(await original<typeof import("./cloud")>()),
    config: () => ({ url: "https://example.supabase.co", key: "sb_publishable_test" }),
    cloud: async () => client,
    myProfile: async () => null,
    machineEditor: async () => null,
    sync: async (ready?: (userId: string) => Promise<void>) => {
      state.syncs++;
      await new Promise<void>((resolve) => { state.finishSync = resolve; });
      await ready?.("friend");
      return { pushed: 0, pulled: 0, conflicts: 0, missingPhotos: 0 };
    },
  };
});
import App from "./App";
vi.stubGlobal("scrollTo", () => {});
afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = "";
});

it("opens the journal right after the first sync even when sign-in finishes while it runs, and stays open on token refresh", async () => {
  location.hash = "#history";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "เข้าสู่ระบบ" }));
  fireEvent.change(await screen.findByLabelText("ชื่อผู้ใช้หรืออีเมล"), { target: { value: "friend" } });
  fireEvent.change(document.querySelector('input[name="password"]')!, { target: { value: "not-a-real-password" } });
  fireEvent.submit(document.querySelector("form")!);
  // The sync begins before the account has been verified.
  await waitFor(() => expect(state.syncs).toBe(1));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  await act(async () => { state.verify(); await new Promise((resolve) => setTimeout(resolve, 200)); });
  expect(screen.getByText("กำลังเปิดสมุดฝึก…")).toBeTruthy();
  await act(async () => { state.finishSync(); });
  expect(await screen.findByRole("heading", { name: "History" }, { timeout: 5000 })).toBeTruthy();
  // A token refresh re-checks the account without replacing the open page.
  const heading = screen.getByRole("heading", { name: "History" });
  act(() => state.onAuth("TOKEN_REFRESHED", { user: { id: "friend" } }));
  expect(screen.getByRole("heading", { name: "History" })).toBe(heading);
});
