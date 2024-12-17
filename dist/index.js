const S = (e) => {
  var c, h, d, l;
  const r = (y) => (u, s) => x(a, { ...s, url: u, method: y }), a = {
    prefix: (e == null ? void 0 : e.prefix) ?? "",
    alias: (e == null ? void 0 : e.alias) ?? "",
    headers: { ...e == null ? void 0 : e.headers },
    hooks: {
      beforeRequest: ((c = e == null ? void 0 : e.hooks) == null ? void 0 : c.beforeRequest) || [],
      afterResponse: ((h = e == null ? void 0 : e.hooks) == null ? void 0 : h.afterResponse) || [],
      beforeRetry: ((d = e == null ? void 0 : e.hooks) == null ? void 0 : d.beforeRetry) || [],
      catchError: ((l = e == null ? void 0 : e.hooks) == null ? void 0 : l.catchError) || []
    },
    retryCount: (e == null ? void 0 : e.retryCount) ?? 0,
    retryTimeout: (e == null ? void 0 : e.retryTimeout) ?? 0,
    cache: new P((e == null ? void 0 : e.cacheSize) ?? 1e4),
    get: r("GET"),
    post: r("POST"),
    put: r("PUT"),
    delete: r("DELETE"),
    patch: r("PATCH"),
    head: r("HEAD")
  };
  return a;
}, x = async (e, r) => {
  var w, E;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: r.searchParams || {},
    data: r.data || null
  }), c = r.retryCount ?? e.retryCount;
  for (const t of e.hooks.beforeRequest ?? [])
    await t(e, a);
  const h = e.prefix + a.url, d = Object.fromEntries(
    Object.entries(a.searchParams).filter(([t, f]) => f != null)
  ), l = new URLSearchParams(d).toString(), y = l ? `${h}?${l}` : h;
  let u;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? u = a.data : typeof a.data == "object" && a.data !== null ? u = JSON.stringify(a.data) : u = a.data);
  let s;
  const T = ((w = r.cache) == null ? void 0 : w.milliseconds) ?? 0, b = T > 0;
  let m;
  if (b && (m = (E = r.cache) == null ? void 0 : E.matcher(e, a), m)) {
    const t = e.cache.get(m);
    t && (await C(0), s = t.clone());
  }
  try {
    s === void 0 && (s = await fetch(y, {
      method: a.method,
      body: u,
      headers: a.headers
    }), b && m && s.ok && e.cache.set(m, s.clone(), T));
    let t = s;
    for (const f of e.hooks.afterResponse) {
      const R = await f(e, a, t);
      R !== void 0 && (t = R);
    }
    return t;
  } catch (t) {
    if (c > 0) {
      for (const f of e.hooks.beforeRetry)
        f(e, r);
      return await C(e.retryTimeout), x(e, { ...r, retryCount: c - 1 });
    }
    for (const f of e.hooks.catchError)
      f(t);
    throw t;
  }
}, C = (e = 0) => new Promise((r) => setTimeout(() => r(), e));
class P {
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
    this.cache.has(r) && this.delete(r);
    const h = Date.now() + c;
    if (this.cache.set(r, { value: a, expirationTime: h }), this.size > this.maxSize) {
      const d = this.cache.keys().next().value;
      d && this.delete(d);
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
    return Date.now() > h ? (this.delete(r), null) : (this.delete(r), this.cache.set(r, a), c);
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
  S as createHttpClient
};
