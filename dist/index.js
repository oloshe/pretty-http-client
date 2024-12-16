const S = (e) => {
  var t, h, f, l;
  const a = (y) => (u, d) => x(r, { ...d, url: u, method: y }), r = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((t = e == null ? void 0 : e.hooks) == null ? void 0 : t.beforeRequest) || [],
      afterResponse: ((h = e == null ? void 0 : e.hooks) == null ? void 0 : h.afterResponse) || [],
      beforeRetry: ((f = e == null ? void 0 : e.hooks) == null ? void 0 : f.beforeRetry) || [],
      catchError: ((l = e == null ? void 0 : e.hooks) == null ? void 0 : l.catchError) || []
    },
    retryCount: (e == null ? void 0 : e.retryCount) ?? 0,
    retryTimeout: (e == null ? void 0 : e.retryTimeout) ?? 0,
    cache: new P((e == null ? void 0 : e.cacheSize) ?? 1e4),
    get: a("GET"),
    post: a("POST"),
    put: a("PUT"),
    delete: a("DELETE"),
    patch: a("PATCH"),
    head: a("HEAD")
  };
  return r;
}, x = async (e, a) => {
  var w, E;
  const r = Object.assign(a, {
    headers: { ...e.headers, ...a.headers },
    searchParams: a.searchParams || {},
    data: a.data || null
  }), t = a.retryCount ?? e.retryCount;
  for (const c of e.hooks.beforeRequest ?? [])
    await c(e, r);
  const h = e.prefix + r.url, f = Object.fromEntries(
    Object.entries(r.searchParams).filter(([c, s]) => s != null)
  ), l = new URLSearchParams(f).toString(), y = l ? `${h}?${l}` : h;
  let u;
  r.method !== "GET" && r.method !== "HEAD" && (r.data instanceof FormData ? u = r.data : typeof r.data == "object" && r.data !== null ? u = JSON.stringify(r.data) : u = r.data);
  let d;
  const T = ((w = a.cache) == null ? void 0 : w.milliseconds) ?? 0, b = T > 0;
  let m;
  if (b && (m = (E = a.cache) == null ? void 0 : E.matcher(e, r), m)) {
    const c = e.cache.get(m);
    c && (await C(0), d = c.clone());
  }
  try {
    d === void 0 && (d = await fetch(y, {
      method: r.method,
      body: u,
      headers: r.headers
    }), b && m && e.cache.set(m, d.clone(), T));
    let c = d;
    for (const s of e.hooks.afterResponse) {
      const R = await s(e, r, c);
      R !== void 0 && (c = R);
    }
    return c;
  } catch (c) {
    if (t > 0) {
      for (const s of e.hooks.beforeRetry)
        s(e, a);
      return await C(e.retryTimeout), x(e, { ...a, retryCount: t - 1 });
    }
    for (const s of e.hooks.catchError)
      s(c);
    throw c;
  }
}, C = (e = 0) => new Promise((a) => setTimeout(() => a(), e));
class P {
  constructor(a) {
    this.cache = /* @__PURE__ */ new Map(), this.maxSize = a;
  }
  /**
   * 添加缓存
   * @param key 键
   * @param value 值
   * @param activeTime 有效时间（毫秒）
   */
  set(a, r, t) {
    this.cache.has(a) && this.cache.delete(a);
    const h = Date.now() + t;
    if (this.cache.set(a, { value: r, expirationTime: h }), this.size > this.maxSize) {
      const f = this.cache.keys().next().value;
      f && this.cache.delete(f);
    }
  }
  /**
   * 获取缓存
   * @param key 键
   * @returns 值或者 null（过期或不存在时）
   */
  get(a) {
    const r = this.cache.get(a);
    if (!r) return null;
    const { value: t, expirationTime: h } = r;
    return Date.now() > h ? (this.cache.delete(a), null) : (this.cache.delete(a), this.cache.set(a, r), t);
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
}
export {
  S as createHttpClient
};
