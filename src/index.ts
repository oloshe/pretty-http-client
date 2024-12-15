/**
 * 请求数据
 */
export interface RequestData {
  /** 请求url */
  url: string;
  /** Http方法 */
  method: HttpMethod;
  /** 请求头 */
  headers: Record<string, string>;
  /** url query 参数 */
  searchParams: Record<string, any>;
  /** body json 数据 */
  data: Record<string, any> | FormData | string | null;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

/**
 * 请求参数
 */
export interface RequestOptions {
  /** 相对url */
  url: string;
  /** http 方法 */
  method: HttpMethod;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求URL参数 */
  searchParams?: Record<string, any>;
  /** 请求体 */
  data?: string | Record<string, any> | FormData | null;
  /** 重试次数 */
  retryCount?: number;
  /** 缓存规则，只有 GET 方法生效 */
  cache?: CacheOptions;
}

export interface CacheOptions {
  /** 缓存的时长，单位毫秒 */
  milliseconds?: number;
  /** 缓存的匹配类型， 如果是 url 则是匹配完整的 url, 如果是 path 则仅匹配路径，默认为 path*/
  matchType?: "path" | "url";
}

/** 请求预处理方法 */
export type BeforeRequest = (
  client: HttpClient,
  req: RequestData
) => void | Promise<void>;

/** 响应转换方法 */
export type AfterResponse<T = Response> = (
  client: HttpClient,
  req: RequestData,
  res: T
) => void | T | Promise<T>;

/** 重试前的钩子方法 */
export type BeforeRetry = (client: HttpClient, options: RequestOptions) => void;
/** 错误时的拦截方法 */
export type CatchError = (e: any) => void;

interface CreateHttpClientOptions<T = Response> {
  /** 请求前缀 */
  prefix?: string;
  /** 别名 */
  alias?: string;
  /** 通用headers */
  headers?: Record<string, string>;
  /** 钩子 */
  hooks?: Partial<ClientHook>;
  /** 重试次数 */
  retryCount?: number;
  /** 重试延迟 */
  retryTimeout?: number;
}

type MethodRequest = <T = Response>(
  url: string,
  options?: Partial<RequestOptions>
) => Promise<T>;

interface ClientHook {
  /** 请求前钩子 */
  beforeRequest: BeforeRequest[];
  /** 请求后钩子 */
  afterResponse: AfterResponse<any>[];
  /** 重试钩子 */
  beforeRetry: BeforeRetry[];
  /** 捕获错误钩子 */
  catchError: CatchError[];
}

/**
 * http 客户端
 */
interface HttpClient {
  /** 前缀 */
  prefix: string;
  /** 别名 */
  alias: string;
  /** 通用请求头 */
  headers: Record<string, string>;
  /** 请求钩子 */
  hooks: ClientHook;
  /** 重试次数 */
  retryCount: number;
  /** 重试延迟 */
  retryTimeout: number;
  /** GET 请求 */
  get: MethodRequest;
  /** POST 请求 */
  post: MethodRequest;
  /** PUT 请求 */
  put: MethodRequest;
  /** DELETE 请求 */
  delete: MethodRequest;
  /** PATCH 请求 */
  patch: MethodRequest;
  /** HEAD 请求 */
  head: MethodRequest;
}

export const createHttpClient = <T = Response>(
  options?: CreateHttpClientOptions<T>
) => {
  const _sendSequest =
    (method: HttpMethod): MethodRequest =>
    (url, options) =>
      sendSequest(client, { ...options, url, method });
  const client: HttpClient = {
    prefix: options?.prefix ?? "",
    alias: options?.alias ?? "",
    headers: { ...options?.headers },
    hooks: {
      beforeRequest: options?.hooks?.beforeRequest || [],
      afterResponse: options?.hooks?.afterResponse || [],
      beforeRetry: options?.hooks?.beforeRetry || [],
      catchError: options?.hooks?.catchError || [],
    },
    retryCount: options?.retryCount ?? 0,
    retryTimeout: options?.retryTimeout ?? 0,
    get: _sendSequest("GET"),
    post: _sendSequest("POST"),
    put: _sendSequest("PUT"),
    delete: _sendSequest("DELETE"),
    patch: _sendSequest("PATCH"),
    head: _sendSequest("HEAD"),
  };
  return client;
};

const sendSequest = async <T = Response>(
  client: HttpClient,
  options: RequestOptions
): Promise<T> => {
  const req: RequestData = Object.assign(options, {
    headers: { ...client.headers, ...options.headers },
    searchParams: options.searchParams || {},
    data: options.data || null,
  });

  // 重试次数
  const retryCount = options.retryCount ?? client.retryCount;

  // 钩子: beforeRequest
  for (const fn of client.hooks.beforeRequest ?? []) {
    await fn(client, req);
  }

  const baseUrl = client.prefix + req.url;
  const query = new URLSearchParams(req.searchParams).toString();
  const url = query ? `${baseUrl}?${query}` : baseUrl;

  let body: BodyInit | undefined | null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.data instanceof FormData) {
      body = req.data;
    } else if (typeof req.data === "object" && req.data !== null) {
      body = JSON.stringify(req.data);
    } else {
      body = req.data;
    }
  }

  let response!: Response;

  // 缓存时间
  const cacheTime = options.cache?.milliseconds ?? 0;
  // 是否使用缓存
  const useCache = cacheTime > 0;
  let cacheKey: string | undefined;
  // 若使用缓存，则先尝试从缓存中获取数据
  if (useCache) {
    if (options.cache?.matchType === "url") {
      cacheKey = url;
    } else {
      cacheKey = url.split("?")[0];
    }
    const cacheData = PRETTY_CACHE.get(cacheKey);
    if (cacheData) {
      // 缓存未过期
      await delay(0);
      response = cacheData.clone();
    }
  }

  // 如果没有命中缓存，则发送请求
  try {
    if (response === void 0) {
      response = await fetch(url, {
        method: req.method,
        body: body,
        headers: req.headers,
      });
      if (useCache) {
        PRETTY_CACHE.set(cacheKey!, response.clone(), cacheTime);
      }
    }

    let result: T = response as T;
    // 钩子: afterResponse
    // 如果返回值不为 undefined，则替换为返回值
    for (const fn of client.hooks.afterResponse) {
      const tempory = await fn(client, req, result);
      if (result !== undefined) {
        result = tempory;
      }
    }

    return result;
    
  } catch (e: any) {
    // 重试
    if (retryCount > 0) {
      // 触发hook
      for (const fn of client.hooks.beforeRetry) {
        fn(client, options);
      }

      // 等待一段时间再重试
      await delay(client.retryTimeout);
      // 重新发送请求
      return sendSequest(client, { ...options, retryCount: retryCount - 1 });
    }
    for (const fn of client.hooks.catchError) {
      fn(e);
    }
    throw e;
  }
};

const delay = (ms: number = 0) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

class LRUCache<K, V> {
  private cache: Map<K, { value: V; expirationTime: number }>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map<K, { value: V; expirationTime: number }>();
    this.maxSize = maxSize;
  }

  /**
   * 添加缓存
   * @param key 键
   * @param value 值
   * @param activeTime 有效时间（毫秒）
   */
  set(key: K, value: V, activeTime: number): void {
    // 如果键已经存在，先删除它以移动到队尾
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const expirationTime = Date.now() + activeTime;
    this.cache.set(key, { value, expirationTime });

    // 如果超出最大容量，移除最旧的键
    if (this.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      oldestKey && this.cache.delete(oldestKey);
    }
  }

  /**
   * 获取缓存
   * @param key 键
   * @returns 值或者 null（过期或不存在时）
   */
  get(key: K): V | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const { value, expirationTime } = item;

    // 如果已过期，删除缓存并返回 null
    if (Date.now() > expirationTime) {
      this.cache.delete(key);
      return null;
    }

    // 移到队尾
    this.cache.delete(key);
    this.cache.set(key, item);

    return value;
  }

  /**
   * 获取当前缓存大小
   * @returns 缓存项的数量
   */
  get size(): number {
    return this.cache.size;
  }
}

const PRETTY_CACHE = new LRUCache<string, Response>(10000);