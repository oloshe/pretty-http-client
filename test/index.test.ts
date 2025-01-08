import { it, expect } from "vitest";
import { createHttpClient } from "../src/index";
import { delay } from "msw";

const TEST_API_URL = "https://example.com";

it("get", async () => {
  const client = createHttpClient({
    prefix: TEST_API_URL,
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
  });
  const resp = await client.get<string>("/api/data");
  expect(resp).toBe("mock data");
});

it("get - cache", async () => {
  const cacheSize = 3;
  const client = createHttpClient({
    prefix: TEST_API_URL,
    hooks: {
      afterResponse: [(client, req, res) => res.json()],
    },
    cacheSize: cacheSize,
  });
  const echo = (params?: any) =>
    client.get<number>("/echo", {
      searchParams: params,
      cache: {
        milliseconds: 100,
        matcher: (_, req) => req.url + '-' + req.searchParams.a,
      },
    });
  const r1 = await echo({ t: 1 });
  const r2 = await echo({ t: 2 });
  // 由于缓存，所以两次请求返回的都是同一个时间戳
  expect(r2).toEqual(r1);
  expect(client.cache.size).toBe(1);
  // 缓存过期了，新请求的结果将不一样
  await delay(101);
  const r3 = await echo();
  expect(r3).not.toEqual(r1);

  // cache size
  expect(client.cache.size).toBe(1);
  const arr = new Array(cacheSize * 2).fill(0);
  await Promise.all(arr.map((_, i) => echo({ a: i })));
  expect(client.cache.size).toBe(cacheSize);
  const last = arr.length - 1;
  client.cache.set(`/echo-${last}`, new Response('"manually"'), 0);
  expect(client.cache.size).toBe(cacheSize);
  expect(await echo({ a: last })).toBe('manually');
  client.cache.clear();
  expect(client.cache.size).toBe(0);
});

it("post - json", async () => {
  const client = createHttpClient({
    prefix: TEST_API_URL,
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
    prefix: TEST_API_URL,
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
    prefix: TEST_API_URL,
  });
  const resp = await client.head<Response>("/head");
  expect(resp.status).toBe(200);
  const test = await resp.text();
  expect(test).toBe("HEAD RESPONSE");
});

it("hook - beforeRequest", async () => {
  const client = createHttpClient({
    prefix: TEST_API_URL,
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
  interface BaseResponse<T = any> {
    code: number;
    msg: string;
    data: T;
  }
  const client = createHttpClient({
    prefix: TEST_API_URL,
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
          // console.log("response is", res);
        },
      ],
    },
  });
  const getBusiness = (error: boolean) =>
    client.post<{ name: string }>("/business", { data: { error } });
  const resp = await getBusiness(false);
  expect(resp.name).toBe("test");
  await expect(getBusiness(true)).rejects.toThrow("error");
});

it("retry", async () => {
  let retryCount = 0;
  const client = createHttpClient({
    prefix: TEST_API_URL,
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

it("hooks in RequestOptions", async () => {
  const client = createHttpClient({
    prefix: TEST_API_URL,
    hooks: {
      afterResponse: [
        (client, req, res) => res.text(),
      ],
      beforeRequest: [
        (client, req) => {
          req.searchParams.argument = "test";
          req.data = JSON.stringify({ name: "test" });
        },
      ],
      catchError: [
        (e) => {
          console.log(e);
        },
      ]
    },
  });
  const originData = JSON.parse(await client.post<string>("/post"));
  expect(originData.msg).toBe('ok');
  expect(originData.data.query.argument).toBe('test');
  expect(originData.data.body.name).toBe('test');

  const newData = await client.post<any>("/post", {
    hooks: {
      afterResponse: [
        (client, req, res) => res.json(),
        (client, req, res) => {
          res.msg = 'okay';
          return;
        },
      ],
      beforeRequest: [
        (client, req) => {
          req.searchParams.argument = "new";
          req.data = JSON.stringify({ name: "new" });
        },
      ],
    }
  });
  expect(newData.msg).toBe('okay');
  expect(newData.data.query.argument).toBe('new');
  expect(newData.data.body.name).toBe('new');

  let error = "";
  try {
    const response = await client.get('/404', {
      prefix: 'xxx://pornhub.com',
      hooks: {
        afterResponse: [() => {
          throw "error";
        }],
        catchError: [
          (e) => {
            error = e;
          }
        ]
      }
    });
    expect(response.status).toBe(404);
    expect(error).toBe("error");
  } catch(e) {}
});
