const S = (e) => {
  var c, h, f, l;
  const r = (y) => (u, s) => x(a, { ...s, url: u, method: y }), a = {
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
  var E, R;
  const a = Object.assign(r, {
    headers: { ...e.headers, ...r.headers },
    searchParams: r.searchParams || {},
    data: r.data || null
  }), c = r.retryCount ?? e.retryCount;
  for (const t of e.hooks.beforeRequest ?? [])
    await t(e, a);
  const h = e.prefix + a.url, f = Object.fromEntries(
    Object.entries(a.searchParams).filter(([t, d]) => d != null)
  ), l = new URLSearchParams(f).toString(), y = l ? `${h}?${l}` : h;
  let u;
  a.method !== "GET" && a.method !== "HEAD" && (a.data instanceof FormData ? u = a.data : typeof a.data == "object" && a.data !== null ? u = JSON.stringify(a.data) : u = a.data);
  let s;
  const b = ((E = r.cache) == null ? void 0 : E.milliseconds) ?? 0, w = b > 0;
  let m;
  if (w && (m = (R = r.cache) == null ? void 0 : R.matcher(e, a), m)) {
    const t = e.cache.get(m);
    t && (await C(0), s = t.clone());
  }
  try {
    if (s === void 0 && (s = await fetch(y, {
      method: a.method,
      body: u,
      headers: a.headers
    }), w && m && s.ok && e.cache.set(m, s.clone(), b), !s.ok && c > 0)) {
      for (const t of e.hooks.beforeRetry)
        t(e, r);
      return await C(e.retryTimeout), x(e, { ...r, retryCount: c - 1 });
    }
  } catch (t) {
    for (const d of e.hooks.catchError)
      d(t);
    throw t;
  }
  let T = s;
  for (const t of e.hooks.afterResponse) {
    const d = await t(e, a, T);
    d !== void 0 && (T = d);
  }
  return T;
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
      const f = this.cache.keys().next().value;
      f && this.delete(f);
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
