import { it, expect } from "vitest";
import { createHttpClient } from "../src/index";
import { delay } from "msw";

it("get", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
  });
  const resp = await client.get<string>("/api/data");
  expect(resp).toBe("mock data");
});

it("get - cache", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
    cacheSize: 3,
  });
  const getData = (params?: any) =>
    client.get<number>("/timestamp", {
      searchParams: params,
      cache: {
        milliseconds: 100,
        matcher: (_, req) => req.url + JSON.stringify(req.searchParams),
      },
    });
  const timestamp1 = await getData();
  const timestamp2 = await getData();
  // 由于缓存，所以两次请求返回的都是同一个时间戳
  expect(timestamp2).toEqual(timestamp1);
  expect(client.cache.size).toBe(1);
  await delay(150);
  const timestamp3 = await getData();
  expect(timestamp3).not.toEqual(timestamp1);

  expect(client.cache.size).toBe(1);
  await Promise.all([
    getData({ a: 1 }),
    getData({ a: 2 }),
    getData({ a: 3 }),
    getData({ a: 4 }),
  ]);
  expect(client.cache.size).toBe(3);
  client.cache.clear();
  expect(client.cache.size).toBe(0);
});

it("post - json", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
    headers: {
      "Content-Type": "application/json",
    },
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
  });

  interface BodyData {
    name: string;
    age: number;
    address: string;
  }

  const resp = await client.post<{
    msg: string;
    data: { body: BodyData; query: any };
  }>("/post", {
    data: {
      name: "John",
      age: 18,
      address: "New York",
    },
    searchParams: {
      noNull: null,
      noUndefined: undefined,
    },
  });
  expect(resp.msg).toBe("ok");
  expect(resp.data.body.name).toBe("John");
  expect(resp.data.body.age).toBe(18);
  expect(resp.data.body.address).toBe("New York");
  expect(resp.data.query.noNull).toBeUndefined();
  expect(resp.data.query.noUndefined).toBeUndefined();
});

it("post - FormData", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
  });
  const formData = new FormData();
  formData.append("name", "John");
  formData.append("age", "18");
  const resp = await client.post<{ data: any }>("/upload", {
    data: formData,
  });
  expect(resp.data.name).toBe("John");
  expect(resp.data.age).toBe("18");
});

it("head", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
  });
  const resp = await client.head<Response>("/head");
  expect(resp.status).toBe(200);
  const test = await resp.text();
  expect(test).toBe("HEAD RESPONSE");
});

it("hook - beforeRequest", async () => {
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      beforeRequest: [
        (client, req) => {
          req.searchParams.argument = "test";
          req.data = JSON.stringify({ name: "test" });
        },
      ],
      afterResponse: [(client, req, res) => res.json()],
    },
  });
  const resp = await client.post<{ data: { body: any; query: any } }>("/post");
  expect(resp.data.body.name).toBe("test");
  expect(resp.data.query.argument).toBe("test");
});

it("hook - afterResponse", async () => {
  let errorHappened = false;
  interface BaseResponse<T = any> {
    code: number;
    msg: string;
    data: T;
  }
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      afterResponse: [
        (client, req, res) => res.json() as Promise<BaseResponse>,
        (client, req, res: BaseResponse) => {
          const { code, msg, data } = res;
          if (code === 0) {
            return data;
          } else {
            throw msg;
          }
        },
        (client, req, res: BaseResponse) => {
          console.log("response is", res);
        },
      ],
      catchError: [
        (e) => {
          errorHappened = true;
        },
      ],
    },
  });
  const getBusiness = (error: boolean) =>
    client.post<{ name: string }>("/business", { data: { error } });
  const resp = await getBusiness(false);
  expect(resp.name).toBe("test");
  await expect(getBusiness(true)).rejects.toThrow("error");
  expect(errorHappened).toBe(true);
});

it("retry", async () => {
  let retryCount = 0;
  const client = createHttpClient({
    prefix: "https://example.com",
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
      beforeRetry: [
        (client, options) => {
          retryCount++;
        },
      ],
    },
    retryCount: 2,
    retryTimeout: 10,
  });
  try {
    const resp = await client.get<Response>("/error");
    expect(resp.status).toBe(500);
  } catch (e) {}
  expect(retryCount).toBe(2);
});
