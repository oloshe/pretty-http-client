const H = (e) => {
  var c, h, y, u;
  const r = (R) => (l, b) => g(a, { ...b, url: l, method: R }), a = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((c = e == null ? void 0 : e.hooks) == null ? void 0 : c.beforeRequest) || [],
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
}, g = async (e, r) => {
  var w, x, T, k, C, q, P;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: r.searchParams || {},
    data: r.data || null
  }), c = r.retryCount ?? e.retryCount, h = ((w = r.hooks) == null ? void 0 : w.beforeRequest) ?? e.hooks.beforeRequest ?? [];
  for (const t of h)
    await t(e, a);
  const u = (r.prefix ?? e.prefix) + a.url, R = Object.fromEntries(
    Object.entries(a.searchParams).filter(
      ([t, s]) => s != null
    )
  ), l = new URLSearchParams(R).toString(), b = l ? `${u}?${l}` : u;
  let m;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? m = a.data : typeof a.data == "object" && a.data !== null ? m = JSON.stringify(a.data) : m = a.data);
  let f;
  const D = ((x = r.cache) == null ? void 0 : x.milliseconds) ?? 0, n = typeof ((T = r.cache) == null ? void 0 : T.matcher) == "function";
  let d;
  if (n && (d = (k = r.cache) == null ? void 0 : k.matcher(e, a), d)) {
    const t = e.cache.get(d);
    t && (await S(0), f = t.clone());
  }
  try {
    if (f === void 0 && (f = await fetch(b, {
      method: a.method,
      body: m,
      headers: a.headers
    }), n && d && f.ok && e.cache.set(d, f.clone(), D), !f.ok && c > 0)) {
      const t = ((C = r.hooks) == null ? void 0 : C.beforeRetry) ?? e.hooks.beforeRetry ?? [];
      for (const s of t)
        s(e, r);
      return await S(e.retryTimeout), g(e, {
        ...r,
        retryCount: c - 1
      });
    }
  } catch (t) {
    const s = ((q = r.hooks) == null ? void 0 : q.catchError) ?? e.hooks.catchError ?? [];
    for (const O of s)
      O(t);
    throw t;
  }
  let E = f;
  const z = ((P = r.hooks) == null ? void 0 : P.afterResponse) ?? e.hooks.afterResponse ?? [];
  for (const t of z) {
    const s = await t(e, a, E);
    s !== void 0 && (E = s);
  }
  return E;
}, S = (e = 0) => new Promise((r) => setTimeout(() => r(), e));
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
  set(r, a, c) {
    if (this.cache.has(r) && this.delete(r), this.cache.set(r, {
      value: a,
      expirationTime: c > 0 ? Date.now() + c : null
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
    const { value: c, expirationTime: h } = a;
    return h !== null && Date.now() > h ? (this.delete(r), null) : (this.delete(r), this.cache.set(r, a), c);
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
