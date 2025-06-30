const H = (e) => {
  var t, h, y, u;
  const r = (R) => (l, b) => E(a, { ...b, url: l, method: R }), a = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((t = e == null ? void 0 : e.hooks) == null ? void 0 : t.beforeRequest) || [],
      afterResponse: ((h = e == null ? void 0 : e.hooks) == null ? void 0 : h.afterResponse) || [],
      beforeRetry: ((y = e == null ? void 0 : e.hooks) == null ? void 0 : y.beforeRetry) || [],
      catchError: ((u = e == null ? void 0 : e.hooks) == null ? void 0 : u.catchError) || []
    },
    retryCount: (e == null ? void 0 : e.retryCount) ?? 0,
    retryTimeout: (e == null ? void 0 : e.retryTimeout) ?? 0,
    cache: new j((e == null ? void 0 : e.cacheSize) ?? 1e4),
    get: r("GET"),
    post: r("POST"),
    put: r("PUT"),
    delete: r("DELETE"),
    patch: r("PATCH"),
    head: r("HEAD")
  };
  return a;
}, E = async (e, r) => {
  var k, C, n, q, P, S, g;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: { ...r.searchParams },
    data: r.data || null,
    extra: r.extra || {}
  }), t = r.retryCount ?? e.retryCount, h = ((k = r.hooks) == null ? void 0 : k.beforeRequest) ?? e.hooks.beforeRequest ?? [];
  for (const c of h)
    await c(e, a);
  const u = (r.prefix ?? e.prefix) + a.url, R = Object.fromEntries(
    Object.entries(a.searchParams).filter(
      ([c, f]) => f != null
    )
  ), l = new URLSearchParams(R).toString(), b = l ? `${u}?${l}` : u;
  let m;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? m = a.data : typeof a.data == "object" && a.data !== null ? m = JSON.stringify(a.data) : m = a.data);
  let s;
  const D = ((C = r.cache) == null ? void 0 : C.milliseconds) ?? 0, T = typeof ((n = r.cache) == null ? void 0 : n.matcher) == "function";
  let d;
  if (T && (d = (q = r.cache) == null ? void 0 : q.matcher(e, a), d)) {
    const c = e.cache.get(d);
    c && (await w(0), s = c.clone());
  }
  try {
    if (s === void 0 && (s = await fetch(b, {
      method: a.method,
      body: m,
      headers: a.headers
    }), T && d && s.ok && e.cache.set(d, s.clone(), D), !s.ok && t > 0)) {
      const c = ((P = r.hooks) == null ? void 0 : P.beforeRetry) ?? e.hooks.beforeRetry ?? [];
      for (const f of c)
        f(e, r);
      return await w(e.retryTimeout), E(e, {
        ...r,
        retryCount: t - 1
      });
    }
  } catch (c) {
    const f = ((S = r.hooks) == null ? void 0 : S.catchError) ?? e.hooks.catchError ?? [];
    for (const O of f)
      O(c);
    if (t > 0)
      return await w(e.retryTimeout), E(e, {
        ...r,
        retryCount: t - 1
      });
    throw c;
  }
  let x = s;
  const z = ((g = r.hooks) == null ? void 0 : g.afterResponse) ?? e.hooks.afterResponse ?? [];
  for (const c of z) {
    const f = await c(e, a, x);
    f !== void 0 && (x = f);
  }
  return x;
}, w = (e = 0) => new Promise((r) => setTimeout(() => r(), e));
class j {
  constructor(r) {
    this.cache = /* @__PURE__ */ new Map(), this.maxSize = r;
  }
  /**
   * 添加缓存
   * @param key 键
   * @param value 值
   * @param activeTime 有效时间（毫秒）
   */
  set(r, a, t) {
    if (this.cache.has(r) && this.delete(r), this.cache.set(r, {
      value: a,
      expirationTime: t > 0 ? Date.now() + t : null
    }), this.size > this.maxSize) {
      const h = this.cache.keys().next().value;
      h && this.delete(h);
    }
  }
  /**
   * 获取缓存
   * @param key 键
   * @returns 值或者 null（过期或不存在时）
   */
  get(r) {
    const a = this.cache.get(r);
    if (!a) return null;
    const { value: t, expirationTime: h } = a;
    return h !== null && Date.now() > h ? (this.delete(r), null) : (this.delete(r), this.cache.set(r, a), t);
  }
  /**
   * 获取当前缓存大小
   * @returns 缓存项的数量
   */
  get size() {
    return this.cache.size;
  }
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }
  /**
   * 删除缓存项
   */
  delete(r) {
    return this.cache.delete(r);
  }
}
export {
  H as createHttpClient
};
