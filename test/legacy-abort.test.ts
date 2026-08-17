import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TimeoutError, createHttpClient } from "../src/index";

class LegacySignal extends EventTarget {
  aborted = false;
  reason: undefined;

  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event("abort"));
  }
}

class LegacyAbortController {
  readonly signal = new LegacySignal();

  abort() {
    this.signal.abort();
  }
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("falls back to the fetch error when an external legacy signal has no reason", async () => {
  fetchMock.mockImplementation((_input, init) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("legacy fetch abort")));
  }));
  const signal = new LegacySignal();
  const promise = createHttpClient({ timeout: false }).get("https://example.com", {
    signal: signal as unknown as AbortSignal,
  });

  signal.abort();

  await expect(promise).rejects.toThrow("legacy fetch abort");
});

it("creates an abort error when a legacy timeout signal interrupts retry delay", async () => {
  vi.stubGlobal("AbortController", LegacyAbortController);
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

  const error = await createHttpClient({
    timeout: 5,
    retry: { limit: 1, delay: 1_000 },
  }).get("https://example.com").catch(value => value);

  expect(error).toBeInstanceOf(TimeoutError);
  expect((error as TimeoutError).cause).toBeInstanceOf(Error);
});
