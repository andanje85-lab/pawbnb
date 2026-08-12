import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeContext } from "../_shared/observability.ts";

Deno.test("sanitizeContext redacts credential-like keys", () => {
  const out = sanitizeContext({
    bookingId: "abc",
    apiKey: "super-secret",
    authorization: "Bearer x",
    RESEND_API_KEY: "re_123",
    password: "hunter2",
  });
  assertEquals(out.bookingId, "abc");
  assertEquals(out.apiKey, "[redacted]");
  assertEquals(out.authorization, "[redacted]");
  assertEquals(out.RESEND_API_KEY, "[redacted]");
  assertEquals(out.password, "[redacted]");
});

Deno.test("sanitizeContext walks nested objects", () => {
  const out = sanitizeContext({ payload: { userId: "u1", accessToken: "t" } });
  assertEquals(out.payload, { userId: "u1", accessToken: "[redacted]" });
});

Deno.test("sanitizeContext tolerates empty input", () => {
  assertEquals(sanitizeContext({}), {});
});
