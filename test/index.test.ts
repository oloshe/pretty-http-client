import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  TimeoutError,
  createHttpClient,
  type AfterResponse,
  type RequestData,
} from "../src/index";

const fetchMock = vi.fn<typeof fetch>();
const jsonResponse = (value: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    ...init,
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("request construction", () => {
  it("joins prefixes, merges query values, preserves hashes, and bypasses prefixes for absolute URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({ prefix: "https://example.com/api/" });
    await client.get("/users?keep=yes&tag=old#profile", {
      searchParams: {
        tag: ["a", null, undefined, "b"],
        page: 2,
        active: false,
        filter: { role: "admin" },
        skip: undefined,
      },
    });
    await client.get("https://other.test/items", {
      searchParams: new URLSearchParams([["q", "hello world"]]),
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.com/api/users?keep=yes&tag=a&tag=b&page=2&active=false&filter=%7B%22role%22%3A%22admin%22%7D#profile",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://other.test/items?q=hello+world");
  });

  it("supports relative URLs, request prefix overrides, aliases, and metadata", async () => {
    let seen!: RequestData;
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({
      prefix: "/api",
      alias: "primary",
      hooks: { beforeRequest: [(_, request) => void (seen = request)] },
    });
    await client.get("users", { prefix: "", extra: 0 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("users");
    expect(client.alias).toBe("primary");
    expect(seen.extra).toBe(0);
    expect(seen.prefix).toBe("");
  });

  it("merges HeadersInit case-insensitively without mutating client headers", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({
      headers: new Headers([["Content-Type", "text/plain"], ["X-Client", "yes"]]),
      hooks: { beforeRequest: [(_, request) => request.headers.set("X-Hook", "yes")] },
    });
    await client.post("https://example.com", {
      headers: [["content-type", "application/custom"]],
      data: { ok: true },
    });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("content-type")).toBe("application/custom");
    expect(headers.get("x-client")).toBe("yes");
    expect(headers.get("x-hook")).toBe("yes");
    expect(client.headers.has("x-hook")).toBe(false);
  });

  it.each([
    [{ value: 1 }, '{"value":1}', "application/json"],
    [[1, 2], "[1,2]", "application/json"],
    [0, "0", "application/json"],
    [false, "false", "application/json"],
    ["plain", "plain", null],
    [null, undefined, null],
  ])("serializes body %#", async (data, expectedBody, expectedType) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await createHttpClient().post("https://example.com", { data });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toEqual(expectedBody);
    expect(new Headers(init?.headers).get("content-type")).toBe(expectedType);
  });

  it("passes non-plain BodyInit through and never sends GET/HEAD bodies", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient();
    const form = new FormData();
    form.set("name", "Ada");
    await client.post("https://example.com/form", { data: form });
    await client.get("https://example.com/get", { data: "ignored" });
    await client.head("https://example.com/head", { data: "ignored" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(form);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBeUndefined();
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBeUndefined();
  });

  it("passes native fetch options while response cache keeps its own name", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await createHttpClient().get("https://example.com", {
      fetchOptions: { cache: "no-store", credentials: "include", redirect: "error" },
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      method: "get",
    });
  });
});

describe("response and error handling", () => {
  it("returns Response by default and supports an async transformation pipeline", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { name: "Ada" } }));
    const hooks: readonly AfterResponse[] = [
      async (_, __, value) => (value as Response).json(),
      (_, __, value) => (value as { data: unknown }).data,
      async () => undefined,
    ];
    const client = createHttpClient({ hooks: { afterResponse: hooks } });
    await expect(client.get<{ name: string }>("https://example.com")).resolves.toEqual({ name: "Ada" });
  });

  it("throws HttpError by default without consuming its response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "missing" }, { status: 404 }));
    const client = createHttpClient({ alias: "api" });
    const error = await client.get("https://example.com/missing", { extra: "trace" }).catch(value => value);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ name: "HttpError", code: "E_HTTP_STATUS", message: "E_HTTP_STATUS", status: 404 });
    expect((error as HttpError).client.alias).toBe("api");
    expect((error as HttpError).request.extra).toBe("trace");
    await expect((error as HttpError).response.json()).resolves.toEqual({ message: "missing" });
  });

  it("supports custom status validation and returning rejected statuses", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("returned", { status: 500 }));
    const client = createHttpClient({ validateStatus: response => response.status === 404 });
    await expect(client.get("https://example.com/accepted")).resolves.toBeInstanceOf(Response);
    const response = await client.get<Response>("https://example.com/rejected", {
      throwHttpErrors: false,
      validateStatus: () => false,
    });
    expect(await response.text()).toBe("returned");
  });

  it("runs final errors through merged async catch hooks", async () => {
    const calls: string[] = [];
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const client = createHttpClient({ hooks: { catchError: [async () => void calls.push("client")] } });
    await expect(client.get("https://example.com", {
      hooks: { catchError: [async () => void calls.push("request")] },
    })).rejects.toThrow("offline");
    expect(calls).toEqual(["client", "request"]);
  });

  it("lets request hooks disable a client category", async () => {
    const catchHook = vi.fn();
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const client = createHttpClient({ hooks: { catchError: [catchHook] } });
    await expect(client.get("https://example.com", {
      hooks: { catchError: false },
    })).rejects.toThrow("offline");
    expect(catchHook).not.toHaveBeenCalled();
  });

  it("uses a catch hook failure and attaches the original cause", async () => {
    const original = new Error("original");
    const replacement = new Error("replacement");
    fetchMock.mockRejectedValue(original);
    const client = createHttpClient({ hooks: { catchError: [() => { throw replacement; }] } });
    const error = await client.get("https://example.com").catch(value => value);
    expect(error).toBe(replacement);
    expect((error as Error & { cause?: unknown }).cause).toBe(original);
  });

  it("routes preparation, validation, and afterResponse failures through catchError", async () => {
    const errors: unknown[] = [];
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({ hooks: { catchError: [(_, __, error) => void errors.push(error)] } });
    await expect(client.get("/x", { prefix: "/bad?query" })).rejects.toBeInstanceOf(TypeError);
    await expect(client.get("https://example.com", {
      validateStatus: () => { throw new Error("validate"); },
    })).rejects.toThrow("validate");
    await expect(client.get("https://example.com", {
      hooks: { afterResponse: [() => { throw new Error("after"); }] },
    })).rejects.toThrow("after");
    expect(errors).toHaveLength(3);
  });
});

describe("timeouts and cancellation", () => {
  const pendingFetch = (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });

  it("times out the whole logical request with TimeoutError", async () => {
    fetchMock.mockImplementation(pendingFetch);
    const client = createHttpClient({ timeout: 15 });
    const error = await client.get("https://example.com").catch(value => value);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({ name: "TimeoutError", code: "E_TIMEOUT", message: "E_TIMEOUT", timeout: 15 });
    expect((error as TimeoutError).cause).toBeInstanceOf(Error);
  });

  it("supports request timeout overrides and disabling timeout", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({ timeout: 10_000 });
    await client.get("https://example.com", { timeout: false });
    await client.get("https://example.com", { timeout: 50 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes through caller cancellation", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    fetchMock.mockImplementation(pendingFetch);
    const promise = createHttpClient({ timeout: false }).get("https://example.com", {
      signal: controller.signal,
    });
    controller.abort(reason);
    await expect(promise).rejects.toBe(reason);
  });
});

describe("retry", () => {
  it("retries configured statuses and runs beforeRequest once", async () => {
    const events: string[] = [];
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createHttpClient({
      retry: { limit: 1 },
      hooks: {
        beforeRequest: [() => void events.push("request")],
        beforeRetry: [async (_, request, context) => {
          events.push(`retry-${context.attempt}-${context.response?.status}`);
          request.headers.set("x-retry", "yes");
        }],
      },
    });
    await client.get("https://example.com");
    expect(events).toEqual(["request", "retry-2-503"]);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("x-retry")).toBe("yes");
  });

  it("does not retry statuses accepted by validateStatus", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const client = createHttpClient({ retry: { limit: 2 }, validateStatus: () => true });
    await client.get("https://example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("merges request retry options, replaces arrays, and supports false", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 418 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const client = createHttpClient({ retry: { limit: 2, statusCodes: [500] } });
    await client.post("https://example.com", {
      retry: { limit: 1, methods: ["post"], statusCodes: [418] },
    });
    await expect(client.get("https://example.com", { retry: false })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries fetch failures but not caller aborts", async () => {
    const retryHook = vi.fn();
    fetchMock
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createHttpClient({ retry: { limit: 1 }, hooks: { beforeRetry: [retryHook] } });
    await client.get("https://example.com");
    expect(retryHook.mock.calls[0]?.[2]).toMatchObject({ attempt: 2 });
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(client.get("https://example.com", { signal: controller.signal })).rejects.toThrow("stop");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After and configured delay", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const promise = createHttpClient({ retry: { limit: 2, delay: 10 } }).get("https://example.com");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry one-shot streams", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const client = createHttpClient({ retry: { limit: 1, methods: ["post"] } });
    await expect(client.post("https://example.com", {
      data: new ReadableStream(),
    })).rejects.toThrow("offline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("response cache", () => {
  it("caches GET responses by final URL and clones values", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ sequence: 1 }));
    const client = createHttpClient({ cache: {} });
    const first = await client.get("https://example.com/data", { searchParams: { page: 1 } });
    const second = await client.get("https://example.com/data", { searchParams: { page: 1 } });
    await expect(first.json()).resolves.toEqual({ sequence: 1 });
    await expect(second.json()).resolves.toEqual({ sequence: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.cache.size).toBe(1);
  });

  it("supports duration strings, LRU eviction, deletion, and clearing", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async input => jsonResponse({ url: input }));
    const client = createHttpClient({ cache: { maxSize: 2, ttl: "5s" } });
    await client.get("https://example.com/1");
    await client.get("https://example.com/2");
    await client.get("https://example.com/3");
    expect(client.cache.size).toBe(2);
    expect(client.cache.get("get https://example.com/1")).toBeNull();
    expect(client.cache.delete("get https://example.com/2")).toBe(true);
    client.cache.set("manual", jsonResponse("value"), "1.5h");
    expect(client.cache.get("manual")).toBeInstanceOf(Response);
    client.cache.clear();
    expect(client.cache.size).toBe(0);
  });

  it("expires entries and supports permanent zero TTL", async () => {
    vi.useFakeTimers();
    const client = createHttpClient();
    client.cache.set("short", new Response("short"), "5ms");
    client.cache.set("forever", new Response("forever"), "0s");
    await vi.advanceTimersByTimeAsync(5);
    expect(client.cache.get("short")).toBeNull();
    expect(client.cache.get("forever")).toBeInstanceOf(Response);
  });

  it("supports request enable/override/disable and only auto-caches GET/HEAD", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createHttpClient({ cache: { ttl: "1m" } });
    await client.get("https://example.com/off", { cache: false });
    await client.get("https://example.com/custom", { cache: { ttl: "1h" } });
    await client.post("https://example.com/post", { cache: true, data: {} });
    await client.head("https://example.com/head", { cache: true });
    expect(client.cache.size).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("supports matcher opt-out, empty keys, and status-aware caching", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createHttpClient({
      validateStatus: response => response.status === 404 || response.status === 204,
      cache: { matcher: (_, __, url) => url.includes("skip") ? false : "" },
    });
    await client.get("https://example.com/cache");
    await client.get("https://example.com/skip");
    expect(client.cache.get("")).toBeInstanceOf(Response);
    expect(client.cache.size).toBe(1);
  });

  it("rechecks cache after beforeRetry changes the URL", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const client = createHttpClient({
      cache: {},
      retry: { limit: 1 },
      hooks: { beforeRetry: [(_, request) => void (request.url = "/cached")] },
    });
    client.cache.set("get https://example.com/cached", new Response(null, { status: 204 }), 0);
    await client.get("/original", { prefix: "https://example.com" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("configuration validation", () => {
  it.each([
    [{ timeout: 0 }, RangeError, "E_TIMEOUT_OPTION"],
    [{ retry: { limit: -1 } }, RangeError, "E_RETRY_LIMIT"],
    [{ retry: { delay: Number.POSITIVE_INFINITY } }, RangeError, "E_RETRY_DELAY"],
    [{ retry: { statusCodes: [99] } }, RangeError, "E_RETRY_STATUS"],
    [{ cache: { maxSize: 0 } }, RangeError, "E_CACHE_SIZE"],
    [{ cache: { ttl: "1y" as "1s" } }, RangeError, "E_CACHE_TTL"],
    [{ prefix: "/api?bad" }, TypeError, "E_PREFIX"],
  ])("rejects invalid client config %#", (options, ErrorType, code) => {
    let error: unknown;
    try {
      createHttpClient(options);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ErrorType);
    expect(error).toMatchObject({ code, message: code });
  });

  it("routes invalid request config through catchError", async () => {
    const hook = vi.fn();
    const client = createHttpClient({ hooks: { catchError: [hook] } });
    await expect(client.get("https://example.com", { timeout: 0 })).rejects.toBeInstanceOf(RangeError);
    expect(hook).toHaveBeenCalledOnce();
  });
});
