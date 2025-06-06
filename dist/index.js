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
  var w, T, k, n, C, q, P;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: { ...r.searchParams },
    data: r.data || null,
    extra: r.extra || {}
  }), c = r.retryCount ?? e.retryCount, h = ((w = r.hooks) == null ? void 0 : w.beforeRequest) ?? e.hooks.beforeRequest ?? [];
  for (const t of h)
    await t(e, a);
  const u = (r.prefix ?? e.prefix) + a.url, R = Object.fromEntries(
    Object.entries(a.searchParams).filter(
      ([t, f]) => f != null
    )
  ), l = new URLSearchParams(R).toString(), b = l ? `${u}?${l}` : u;
  let m;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? m = a.data : typeof a.data == "object" && a.data !== null ? m = JSON.stringify(a.data) : m = a.data);
  let s;
  const D = ((T = r.cache) == null ? void 0 : T.milliseconds) ?? 0, E = typeof ((k = r.cache) == null ? void 0 : k.matcher) == "function";
  let d;
  if (E && (d = (n = r.cache) == null ? void 0 : n.matcher(e, a), d)) {
    const t = e.cache.get(d);
    t && (await S(0), s = t.clone());
  }
  try {
    if (s === void 0 && (s = await fetch(b, {
      method: a.method,
      body: m,
      headers: a.headers
    }), E && d && s.ok && e.cache.set(d, s.clone(), D), !s.ok && c > 0)) {
      const t = ((C = r.hooks) == null ? void 0 : C.beforeRetry) ?? e.hooks.beforeRetry ?? [];
      for (const f of t)
        f(e, r);
      return await S(e.retryTimeout), g(e, {
        ...r,
        retryCount: c - 1
      });
    }
  } catch (t) {
    const f = ((q = r.hooks) == null ? void 0 : q.catchError) ?? e.hooks.catchError ?? [];
    for (const O of f)
      O(t);
    throw t;
  }
  let x = s;
  const z = ((P = r.hooks) == null ? void 0 : P.afterResponse) ?? e.hooks.afterResponse ?? [];
  for (const t of z) {
    const f = await t(e, a, x);
    f !== void 0 && (x = f);
  }
  return x;
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
