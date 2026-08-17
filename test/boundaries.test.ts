import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, TimeoutError, createHttpClient } from "../src/index";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coverage boundaries", () => {
  it("supports client retry false, request re-enable, empty URLs, and false client hooks", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createHttpClient({
      prefix: "https://example.com",
      retry: false,
      hooks: {
        beforeRequest: false,
        afterResponse: false,
        beforeRetry: false,
        catchError: false,
      },
    });

    await client.get("");
    await expect(client.get("/no-retry")).rejects.toBeInstanceOf(HttpError);
    await client.get("/request-retry", { retry: { limit: 1 } });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("drops a cached response rejected by the current validator before fetching", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({ cache: {} });
    const key = "get https://example.com/data";
    client.cache.set(key, new Response(null, { status: 500 }));

    await client.get("https://example.com/data");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(client.cache.get(key)?.status).toBe(204);
  });

  it("enables request caching without client defaults and inherits defaults in objects", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient();

    await client.get("https://example.com/true", { cache: true });
    await client.get("https://example.com/object", { cache: {} });

    expect(client.cache.size).toBe(2);
  });

  it("rejects unserializable query objects, invalid retry methods, and negative TTLs", async () => {
    const client = createHttpClient();
    await expect(client.get("https://example.com", {
      searchParams: { bad: { toJSON: () => undefined } },
    })).rejects.toMatchObject({ code: "E_SEARCH_PARAM", message: "E_SEARCH_PARAM" });
    expect(() => createHttpClient({
      retry: { methods: ["options" as "get"] },
    })).toThrow("E_RETRY_METHOD");
    expect(() => client.cache.set("bad", new Response(), -1)).toThrow("E_CACHE_TTL");
  });

  it("handles HTTP-date, negative, and invalid Retry-After values", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500, headers: { "retry-after": "-1" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500, headers: { "retry-after": "invalid" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createHttpClient({ retry: { limit: 1 } });

    await client.get("https://example.com/date");
    await client.get("https://example.com/invalid");

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("wraps primitive catch hook failures", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const client = createHttpClient({
      hooks: { catchError: [() => { throw "replacement"; }] },
    });

    const error = await client.get("https://example.com").catch(value => value);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: "E_CATCH_HOOK", message: "E_CATCH_HOOK" });
    expect((error as Error & { cause?: unknown }).cause).toEqual(new Error("offline"));
  });

  it("uses a request timeout override and aborts retry waits", async () => {
    const pending = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    fetchMock.mockImplementationOnce(pending);
    const client = createHttpClient({ timeout: 1_000 });
    const overrideError = await client.get("https://example.com/override", {
      timeout: 5,
    }).catch(value => value);
    expect(overrideError).toMatchObject({ name: "TimeoutError", timeout: 5 });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const waitError = await createHttpClient({
      timeout: 5,
      retry: { limit: 1, delay: 1_000 },
    }).get("https://example.com/wait").catch(value => value);
    expect(waitError).toBeInstanceOf(TimeoutError);
  });

  it("supports legacy AbortSignal implementations without reason", async () => {
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
    vi.stubGlobal("AbortController", LegacyAbortController);
    const signal = new LegacySignal();
    signal.abort();

    const error = await createHttpClient({ timeout: false }).get("https://example.com", {
      signal: signal as unknown as AbortSignal,
    }).catch(value => value);

    expect(error).toMatchObject({ name: "AbortError", code: "E_ABORTED", message: "E_ABORTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
