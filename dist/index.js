const g = (e) => {
  var c, h, s, u;
  const a = (d) => (f, m) => b(r, { ...m, url: f, method: d }), r = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((c = e == null ? void 0 : e.hooks) == null ? void 0 : c.beforeRequest) || [],
      afterResponse: ((h = e == null ? void 0 : e.hooks) == null ? void 0 : h.afterResponse) || [],
      beforeRetry: ((s = e == null ? void 0 : e.hooks) == null ? void 0 : s.beforeRetry) || [],
      catchError: ((u = e == null ? void 0 : e.hooks) == null ? void 0 : u.catchError) || []
    },
    retryCount: (e == null ? void 0 : e.retryCount) ?? 0,
    retryTimeout: (e == null ? void 0 : e.retryTimeout) ?? 0,
    get: a("GET"),
    post: a("POST"),
    put: a("PUT"),
    delete: a("DELETE"),
    patch: a("PATCH"),
    head: a("HEAD")
  };
  return r;
}, b = async (e, a) => {
  var w, C;
  const r = Object.assign(a, {
    headers: { ...e.headers, ...a.headers },
    searchParams: a.searchParams || {},
    data: a.data || null
  }), c = a.retryCount ?? e.retryCount;
  for (const t of e.hooks.beforeRequest ?? [])
    await t(e, r);
  const h = e.prefix + r.url, s = new URLSearchParams(r.searchParams).toString(), u = s ? `${h}?${s}` : h;
  let d;
  r.method !== "GET" && r.method !== "HEAD" && (r.data instanceof FormData ? d = r.data : typeof r.data == "object" && r.data !== null ? d = JSON.stringify(r.data) : d = r.data);
  let f;
  const m = ((w = a.cache) == null ? void 0 : w.milliseconds) ?? 0, T = m > 0;
  let y;
  if (T) {
    ((C = a.cache) == null ? void 0 : C.matchType) === "url" ? y = u : y = u.split("?")[0];
    const t = R.get(y);
    t && (await E(0), f = t.clone());
  }
  try {
    f === void 0 && (f = await fetch(u, {
      method: r.method,
      body: d,
      headers: r.headers
    }), T && R.set(y, f.clone(), m));
    let t = f;
    for (const l of e.hooks.afterResponse) {
      const x = await l(e, r, t);
      t !== void 0 && (t = x);
    }
    return t;
  } catch (t) {
    if (c > 0) {
      for (const l of e.hooks.beforeRetry)
        l(e, a);
      return await E(e.retryTimeout), b(e, { ...a, retryCount: c - 1 });
    }
    for (const l of e.hooks.catchError)
      l(t);
    throw t;
  }
}, E = (e = 0) => new Promise((a) => setTimeout(() => a(), e));
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
  set(a, r, c) {
    this.cache.has(a) && this.cache.delete(a);
    const h = Date.now() + c;
    if (this.cache.set(a, { value: r, expirationTime: h }), this.size > this.maxSize) {
      const s = this.cache.keys().next().value;
      s && this.cache.delete(s);
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
    const { value: c, expirationTime: h } = r;
    return Date.now() > h ? (this.cache.delete(a), null) : (this.cache.delete(a), this.cache.set(a, r), c);
  }
  /**
   * 获取当前缓存大小
   * @returns 缓存项的数量
   */
  get size() {
    return this.cache.size;
  }
}
const R = new P(1e4);
export {
  g as createHttpClient
};
