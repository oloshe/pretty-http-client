import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// 启动 MSW 服务器
const server = setupServer(
  http.get("https://example.com/api/data", () => {
    return HttpResponse.json('mock data');
  }),
  http.get("https://example.com/timestamp", () => {
    return HttpResponse.json(Date.now());
  }),
  http.get("https://example.com/error", ({ request }) => {
    return new HttpResponse(null, {
      status: 500,
    });
  }),
  http.post("https://example.com/post", async ({ request }) => {
    const url = new URL(request.url);
    const body = await request.json();
    const query = Object.fromEntries(new URLSearchParams(url.search).entries());
    return HttpResponse.json({
      msg: 'ok',
      data: {
        body,
        query,
      },
    });
  }),
  http.post("https://example.com/upload", async ({ request}) => {
    const formData = await request.formData();
    return HttpResponse.json({
      msg: 'ok',
      data: Object.fromEntries(formData.entries()),
    });
  }),
  http.head("https://example.com/head", () => {
    return HttpResponse.text('HEAD RESPONSE');
  }),
  http.post("https://example.com/business", async ({ request }) => {
    const body = await request.json();
    if (body.error) {
      return HttpResponse.json({
        code: 500,
        msg: 'error',
        data: null
      });
    } else {
      return HttpResponse.json({
        code: 0,
        msg: 'ok',
        data: { name: 'test' }
      });
    }
  }),
  http.get('https://example.com/404', async (req, res, ctx) => {
    return new Response(null, { status: 404 });
  }),
  http.get('https://example.com/echo', async ({request}) => {
    const url = new URL(request.url);
    const query = Object.fromEntries(new URLSearchParams(url.search).entries());
    return HttpResponse.json(query);
  }),
);

// 在 Jest 生命周期中控制服务器的启动和停止
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
