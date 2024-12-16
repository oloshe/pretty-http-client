const g = (e) => {
  var c, h, f, l;
  const r = (y) => (u, d) => P(a, { ...d, url: u, method: y }), a = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((c = e == null ? void 0 : e.hooks) == null ? void 0 : c.beforeRequest) || [],
      afterResponse: ((h = e == null ? void 0 : e.hooks) == null ? void 0 : h.afterResponse) || [],
      beforeRetry: ((f = e == null ? void 0 : e.hooks) == null ? void 0 : f.beforeRetry) || [],
      catchError: ((l = e == null ? void 0 : e.hooks) == null ? void 0 : l.catchError) || []
    },
    retryCount: (e == null ? void 0 : e.retryCount) ?? 0,
    retryTimeout: (e == null ? void 0 : e.retryTimeout) ?? 0,
    get: r("GET"),
    post: r("POST"),
    put: r("PUT"),
    delete: r("DELETE"),
    patch: r("PATCH"),
    head: r("HEAD")
  };
  return a;
}, P = async (e, r) => {
  var b, w;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: r.searchParams || {},
    data: r.data || null
  }), c = r.retryCount ?? e.retryCount;
  for (const t of e.hooks.beforeRequest ?? [])
    await t(e, a);
  const h = e.prefix + a.url, f = Object.fromEntries(
    Object.entries(a.searchParams).filter(([t, s]) => s != null)
  ), l = new URLSearchParams(f).toString(), y = l ? `${h}?${l}` : h;
  let u;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? u = a.data : typeof a.data == "object" && a.data !== null ? u = JSON.stringify(a.data) : u = a.data);
  let d;
  const T = ((b = r.cache) == null ? void 0 : b.milliseconds) ?? 0, E = T > 0;
  let m;
  if (E && (m = (w = r.cache) == null ? void 0 : w.matcher(e, a), m)) {
    const t = n.get(m);
    t && (await R(0), d = t.clone());
  }
  try {
    d === void 0 && (d = await fetch(y, {
      method: a.method,
      body: u,
      headers: a.headers
    }), E && m && n.set(m, d.clone(), T));
    let t = d;
    for (const s of e.hooks.afterResponse) {
      const C = await s(e, a, t);
      C !== void 0 && (t = C);
    }
    return t;
  } catch (t) {
    if (c > 0) {
      for (const s of e.hooks.beforeRetry)
        s(e, r);
      return await R(e.retryTimeout), P(e, { ...r, retryCount: c - 1 });
    }
    for (const s of e.hooks.catchError)
      s(t);
    throw t;
  }
}, R = (e = 0) => new Promise((r) => setTimeout(() => r(), e));
class x {
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
    this.cache.has(r) && this.cache.delete(r);
    const h = Date.now() + c;
    if (this.cache.set(r, { value: a, expirationTime: h }), this.size > this.maxSize) {
      const f = this.cache.keys().next().value;
      f && this.cache.delete(f);
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
    return Date.now() > h ? (this.cache.delete(r), null) : (this.cache.delete(r), this.cache.set(r, a), c);
  }
  /**
   * 获取当前缓存大小
   * @returns 缓存项的数量
   */
  get size() {
    return this.cache.size;
  }
}
const n = new x(1e4);
export {
  g as createHttpClient
};
