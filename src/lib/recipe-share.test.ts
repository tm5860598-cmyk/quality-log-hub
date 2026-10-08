import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Public database test configuration missing");
const anonymous = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
describe("Read-only recipe QR permissions", () => {
  test("unknown QR token returns no recipe", async () => {
    const { data, error } = await anonymous.rpc("read_recipe_qr_share", { _token: "00000000-0000-0000-0000-000000000000" });
    expect(error).toBeNull(); expect(data).toBeNull();
  });
  test("anonymous visitors cannot create a share", async () => {
    const { error } = await anonymous.rpc("ensure_recipe_qr_share", { _product_id: "00000000-0000-0000-0000-000000000000" });
    expect(error).not.toBeNull();
  });
  test("anonymous visitors cannot enumerate share tokens", async () => {
    const { error } = await anonymous.from("recipe_qr_shares").select("token");
    expect(error).not.toBeNull();
  });
  test("anonymous visitors cannot modify shares", async () => {
    const { error } = await anonymous.from("recipe_qr_shares").update({ token: "00000000-0000-0000-0000-000000000001" }).eq("product_id", "00000000-0000-0000-0000-000000000000");
    expect(error).not.toBeNull();
  });
});