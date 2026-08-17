/** 客户端支持的请求方法，统一使用小写形式。 */
export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "head";
/** 库自身可能生成的稳定错误码，可用于不依赖错误文案的分支判断。 */
export type BuiltInErrorCode =
  | "E_HTTP_STATUS"
  | "E_TIMEOUT"
  | "E_SEARCH_PARAM"
  | "E_RETRY_LIMIT"
  | "E_RETRY_DELAY"
  | "E_RETRY_METHOD"
  | "E_RETRY_STATUS"
  | "E_CACHE_TTL"
  | "E_CACHE_SIZE"
  | "E_TIMEOUT_OPTION"
  | "E_PREFIX"
  | "E_CATCH_HOOK"
  | "E_ABORTED";


/** TTL 字符串支持的时间单位。 */
export type DurationUnit = "ms" | "s" | "m" | "h" | "d";
/** 由数值和时间单位组成的 TTL 字符串，例如 5s、1m。 */
export type DurationString = `${number}${DurationUnit}`;
/** 缓存有效期；数值表示毫秒，字符串表示带单位的时长。 */
export type CacheTtl = number | DurationString;

/** 查询参数允许直接转换为文本的基础值。 */
export type SearchParamPrimitive = string | number | boolean | null | undefined;
/** 单个查询参数值；数组会展开为同名参数，对象会序列化为 JSON。 */
export type SearchParamValue =
  | SearchParamPrimitive
  | Record<string, unknown>
  | readonly (SearchParamPrimitive | Record<string, unknown>)[];
/** 请求查询参数，可直接传入 URLSearchParams 或普通对象。 */
export type SearchParams = URLSearchParams | Record<string, SearchParamValue>;

/** 请求体类型；普通对象、数组、数值和布尔值会自动序列化为 JSON。 */
export type RequestBody =
  | BodyInit
  | number
  | boolean
  | Record<string, unknown>
  | readonly unknown[]
  | null;

/** 原生 Fetch 的扩展配置，避免与客户端自身的同名配置冲突。 */
export type FetchOptions = Omit<
  RequestInit,
  "method" | "body" | "headers" | "signal"
>;

/** 一次逻辑请求的可变上下文，供请求钩子和重试钩子读取或修改。 */
export interface RequestData {
  /** 原始请求地址，不包含客户端前缀。 */
  url: string;
  /** 请求方法在创建请求后不可修改。 */
  readonly method: HttpMethod;
  /** 合并后的请求头，钩子可继续修改。 */
  headers: Headers;
  /** 请求查询参数，发送前才会序列化。 */
  searchParams: SearchParams;
  /** 请求体数据，发送前才会判断是否需要 JSON 序列化。 */
  data: RequestBody;
  /** 只供业务和钩子传递的附加数据，不参与网络请求。 */
  extra: unknown;
  /** 本次请求使用的地址前缀。 */
  prefix: string;
  /** 透传给原生 Fetch 的扩展配置。 */
  fetchOptions: FetchOptions;
  /** 合并外部取消和内部超时后的最终信号。 */
  readonly signal: AbortSignal;
}

/** 重试策略；未提供的字段会继承客户端配置或内置默认值。 */
export interface RetryOptions {
  /** 最大重试次数，不包含第一次请求；默认为零。 */
  limit?: number;
  /** 每次重试前的基础等待毫秒数。 */
  delay?: number;
  /** 允许重试的方法列表，请求级数组会整体替换客户端数组。 */
  methods?: readonly HttpMethod[];
  /** 允许重试的 HTTP 状态码列表。 */
  statusCodes?: readonly number[];
  /** 是否重试非取消类网络错误。 */
  retryOnNetworkError?: boolean;
}

/** 完成默认值合并和合法性校验后的重试策略。 */
export interface ResolvedRetryOptions {
  /** 已校验的最大重试次数。 */
  readonly limit: number;
  /** 已校验的基础等待毫秒数。 */
  readonly delay: number;
  /** 已复制的允许重试方法列表。 */
  readonly methods: readonly HttpMethod[];
  /** 已复制的允许重试状态码列表。 */
  readonly statusCodes: readonly number[];
  /** 已确定的网络错误重试开关。 */
  readonly retryOnNetworkError: boolean;
}

/** 重试钩子的上下文，attempt 表示即将开始的请求次数。 */
export interface RetryContext {
  /** 下一次请求的序号，首次重试时为二。 */
  readonly attempt: number;
  /** 状态码触发重试时的上一次响应。 */
  readonly response?: Response;
  /** 网络失败触发重试时的上一次错误。 */
  readonly error?: unknown;
  /** 可用于中止钩子自身异步工作的请求信号。 */
  readonly signal: AbortSignal;
}

/** 判断响应是否成功；默认使用 Response.ok。 */
export type ValidateStatus = (response: Response) => boolean;
/** 生成响应缓存键；返回 false 可跳过本次缓存。 */
export type CacheMatcher = (
  client: HttpClient,
  request: Readonly<RequestData>,
  finalUrl: string,
) => string | false;

/** 请求发送前执行的钩子，仅在一次逻辑请求开始时运行一次。 */
export type BeforeRequest = (
  client: HttpClient,
  request: RequestData,
) => void | Promise<void>;

/** 响应转换钩子；返回 undefined 时保留上一个值，否则替换流水线结果。 */
export type AfterResponse<Input = unknown, Output = unknown> = (
  client: HttpClient,
  request: RequestData,
  value: Input,
) => Output | void | Promise<Output | void>;

/** 每次重试前执行的钩子，可修改下一次尝试所用的请求数据。 */
export type BeforeRetry = (
  client: HttpClient,
  request: RequestData,
  context: RetryContext,
) => void | Promise<void>;

/** 最终失败时执行的观察钩子；钩子抛错会替换原错误并挂载原因为 cause。 */
export type CatchError = (
  client: HttpClient,
  request: Readonly<RequestData>,
  error: unknown,
) => void | Promise<void>;

/** 四类请求钩子；请求级配置为 false 时会禁用对应的客户端钩子。 */
export interface HookOptions {
  /** 在请求准备前运行。 */
  beforeRequest?: readonly BeforeRequest[] | false;
  /** 在获得最终响应后按顺序转换结果。 */
  afterResponse?: readonly AfterResponse[] | false;
  /** 在每次重试等待前运行。 */
  beforeRetry?: readonly BeforeRetry[] | false;
  /** 在最终抛错前运行。 */
  catchError?: readonly CatchError[] | false;
}

/** 已解析的客户端钩子集合，所有分类都规范化为只读数组。 */
export interface ClientHooks {
  /** 已解析的请求前钩子。 */
  readonly beforeRequest: readonly BeforeRequest[];
  /** 已解析的响应后钩子。 */
  readonly afterResponse: readonly AfterResponse[];
  /** 已解析的重试前钩子。 */
  readonly beforeRetry: readonly BeforeRetry[];
  /** 已解析的错误钩子。 */
  readonly catchError: readonly CatchError[];
}

/** 客户端级缓存配置，启用后默认使用容量 100 和永不过期的 TTL。 */
export interface ClientCacheOptions {
  /** LRU 最大容量，默认为一百。 */
  maxSize?: number;
  /** 默认缓存有效期，零表示永不过期。 */
  ttl?: CacheTtl;
  /** 默认缓存键生成函数。 */
  matcher?: CacheMatcher;
}

/** 请求级缓存配置，用于覆盖客户端的 TTL 或匹配规则。 */
export interface RequestCacheOptions {
  /** 覆盖本次请求的缓存有效期。 */
  ttl?: CacheTtl;
  /** 覆盖本次请求的缓存键生成函数。 */
  matcher?: CacheMatcher;
}

/** 对外暴露的 LRU 响应缓存接口，读写时都会克隆 Response。 */
export interface ResponseCache {
  /** 当前缓存记录数量。 */
  readonly size: number;
  /** 读取并提升记录的 LRU 顺序，未命中或过期时返回 null。 */
  get(key: string): Response | null;
  /** 克隆并写入响应，可为单条记录指定有效期。 */
  set(key: string, value: Response, ttl?: CacheTtl): void;
  /** 删除指定缓存键并返回是否命中。 */
  delete(key: string): boolean;
  /** 清空全部缓存记录。 */
  clear(): void;
}

/** 单次请求配置；除 signal 外均可覆盖或扩展客户端配置。 */
export interface RequestOptions {
  /** 覆盖或新增客户端请求头。 */
  headers?: HeadersInit;
  /** 追加或替换 URL 中的同名查询参数。 */
  searchParams?: SearchParams;
  /** 本次请求的数据体。 */
  data?: RequestBody;
  /** 覆盖、启用或禁用本次重试策略。 */
  retry?: false | RetryOptions;
  /** 覆盖、启用或禁用本次响应缓存。 */
  cache?: boolean | RequestCacheOptions;
  /** 追加或禁用本次请求的钩子。 */
  hooks?: HookOptions;
  /** 替换客户端前缀，空字符串表示不使用前缀。 */
  prefix?: string;
  /** 传递给钩子和错误对象的业务附加数据。 */
  extra?: unknown;
  /** 覆盖客户端超时毫秒数，false 表示禁用。 */
  timeout?: number | false;
  /** 调用方提供的取消信号。 */
  signal?: AbortSignal;
  /** 覆盖客户端的响应成功判断函数。 */
  validateStatus?: ValidateStatus;
  /** 是否为未通过状态校验的响应抛出 HttpError。 */
  throwHttpErrors?: boolean;
  /** 其余原生 Fetch 配置。 */
  fetchOptions?: FetchOptions;
}

/** 创建客户端时使用的公共配置。 */
export interface CreateHttpClientOptions {
  /** 所有相对请求地址使用的默认前缀。 */
  prefix?: string;
  /** 只用于业务识别和诊断的客户端别名。 */
  alias?: string;
  /** 每次请求都会复制的默认请求头。 */
  headers?: HeadersInit;
  /** 客户端级默认钩子。 */
  hooks?: HookOptions;
  /** 客户端级重试策略，false 表示默认关闭。 */
  retry?: false | RetryOptions;
  /** 客户端级超时毫秒数，默认十秒，false 表示关闭。 */
  timeout?: number | false;
  /** 客户端级响应成功判断函数。 */
  validateStatus?: ValidateStatus;
  /** 是否默认抛出状态错误，默认为 true。 */
  throwHttpErrors?: boolean;
  /** 客户端级响应缓存，未提供或 false 时默认关闭。 */
  cache?: false | ClientCacheOptions;
}

/** 各请求快捷方法的统一签名；泛型表示响应钩子流水线的最终类型。 */
export type MethodRequest = <T = Response>(
  url: string,
  options?: RequestOptions,
) => Promise<T>;

/** createHttpClient 返回的客户端实例。 */
export interface HttpClient {
  /** 客户端默认前缀。 */
  readonly prefix: string;
  /** 客户端业务别名。 */
  readonly alias: string;
  /** 客户端默认请求头。 */
  readonly headers: Headers;
  /** 已解析的客户端钩子。 */
  readonly hooks: ClientHooks;
  /** 已解析的默认重试策略。 */
  readonly retry: false | Readonly<ResolvedRetryOptions>;
  /** 默认超时毫秒数或关闭状态。 */
  readonly timeout: number | false;
  /** 默认响应状态校验函数。 */
  readonly validateStatus: ValidateStatus;
  /** 默认状态错误抛出开关。 */
  readonly throwHttpErrors: boolean;
  /** 可手动读取和失效的响应缓存。 */
  readonly cache: ResponseCache;
  /** 发送 GET 请求。 */
  readonly get: MethodRequest;
  /** 发送 POST 请求。 */
  readonly post: MethodRequest;
  /** 发送 PUT 请求。 */
  readonly put: MethodRequest;
  /** 发送 DELETE 请求。 */
  readonly delete: MethodRequest;
  /** 发送 PATCH 请求。 */
  readonly patch: MethodRequest;
  /** 发送 HEAD 请求。 */
  readonly head: MethodRequest;
}

/** 内部规范化后的缓存配置，TTL 始终使用毫秒。 */
interface ResolvedCacheOptions {
  readonly ttl: number;
  readonly matcher: CacheMatcher;
}

/** 内部客户端在公共接口基础上保留缓存启用状态和默认策略。 */
interface InternalHttpClient extends HttpClient {
  readonly cacheOptions: ResolvedCacheOptions | false;
}

/** 单条缓存记录，expiresAt 为 null 时表示永不过期。 */
interface CacheEntry {
  readonly response: Response;
  readonly expiresAt: number | null;
}

/** 所有受支持的方法，用于校验用户提供的重试方法。 */
const HTTP_METHODS: readonly HttpMethod[] = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
];
/** 默认不实际重试，但预置安全方法、状态码和网络错误策略。 */
const DEFAULT_RETRY: ResolvedRetryOptions = {
  limit: 0,
  delay: 0,
  methods: ["get", "head", "put", "delete"],
  statusCodes: [408, 429, 500, 502, 503, 504],
  retryOnNetworkError: true,
};
/** 默认超时时间为十秒。 */
const DEFAULT_TIMEOUT = 10_000;
/** 默认最多保存一百条响应缓存。 */
const DEFAULT_CACHE_SIZE = 100;
/** 默认缓存键由请求方法和最终 URL 组成。 */
const DEFAULT_CACHE_MATCHER: CacheMatcher = (_, request, finalUrl) =>
  `${request.method} ${finalUrl}`;

/** 状态校验失败时抛出的错误，保留响应和请求快照供调用方诊断。 */
export class HttpError extends Error {
  /** 固定错误类型名称。 */
  readonly name = "HttpError";
  /** 稳定错误码，同时也是默认 message。 */
  readonly code = "E_HTTP_STATUS";
  /** 发起请求的客户端。 */
  readonly client: HttpClient;
  /** 抛错时冻结关键字段后的请求快照。 */
  readonly request: Readonly<RequestData>;
  /** 未通过状态校验的原生响应。 */
  readonly response: Response;
  /** 响应状态码。 */
  readonly status: number;
  /** 可选的底层错误原因。 */
  readonly cause?: unknown;

  constructor(
    client: HttpClient,
    request: Readonly<RequestData>,
    response: Response,
    cause?: unknown,
  ) {
    super("E_HTTP_STATUS");
    Object.setPrototypeOf(this, new.target.prototype);
    this.client = client;
    this.request = request;
    this.response = response;
    this.status = response.status;
    this.cause = cause;
  }
}

/** 整个逻辑请求超过时限时抛出的错误，保留超时值和底层原因。 */
  /** 固定错误类型名称。 */
export class TimeoutError extends Error {
  /** 稳定错误码，同时也是默认 message。 */
  readonly name = "TimeoutError";
  /** 发起请求的客户端。 */
  readonly code = "E_TIMEOUT";
  /** 超时时冻结关键字段后的请求快照。 */
  readonly client: HttpClient;
  /** 生效的超时毫秒数。 */
  readonly request: Readonly<RequestData>;
  /** 触发超时时捕获的底层错误。 */
  readonly timeout: number;
  readonly cause?: unknown;

  constructor(
    client: HttpClient,
    request: Readonly<RequestData>,
    timeout: number,
    cause?: unknown,
  ) {
    super("E_TIMEOUT");
    Object.setPrototypeOf(this, new.target.prototype);
    this.client = client;
    this.request = request;
    this.timeout = timeout;
    this.cause = cause;
  }
}

/** 基于 Map 的轻量 LRU 缓存实现，同时负责 TTL 过期清理。 */
class ResponseCacheImpl implements ResponseCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxSize: number) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): Response | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.response.clone();
  }

  set(key: string, value: Response, ttl: CacheTtl = 0): void {
    const milliseconds = parseTtl(ttl);
    this.entries.delete(key);
    this.entries.set(key, {
      response: value.clone(),
      expiresAt: milliseconds === 0 ? null : Date.now() + milliseconds,
    });
    if (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** 创建独立 HTTP 客户端，并把客户端配置固化为只读运行时属性。 */
export const createHttpClient = (
  options: CreateHttpClientOptions = {},
): HttpClient => {
  assertPrefix(options.prefix ?? "");
  const timeout = validateTimeout(options.timeout ?? DEFAULT_TIMEOUT);
  const retry = options.retry === false
    ? false
    : resolveRetry(DEFAULT_RETRY, options.retry);
  const cacheOptions = resolveClientCache(options.cache);
  const cacheSize = options.cache
    ? validateCacheSize(options.cache.maxSize ?? DEFAULT_CACHE_SIZE)
    : DEFAULT_CACHE_SIZE;
  const hooks = resolveClientHooks(options.hooks);
  const headers = new Headers(options.headers);
  const validateStatus = options.validateStatus ?? (response => response.ok);
  let client!: InternalHttpClient;
  const request = (method: HttpMethod): MethodRequest =>
    (url, requestOptions) => sendRequest(client, method, url, requestOptions);

  client = {
    prefix: options.prefix ?? "",
    alias: options.alias ?? "",
    headers,
    hooks,
    retry,
    timeout,
    validateStatus,
    throwHttpErrors: options.throwHttpErrors ?? true,
    cache: new ResponseCacheImpl(cacheSize),
    cacheOptions,
    get: request("get"),
    post: request("post"),
    put: request("put"),
    delete: request("delete"),
    patch: request("patch"),
    head: request("head"),
  };
  return client;
};

/** 执行完整请求流程：合并配置、运行钩子、缓存、重试、错误转换和清理。 */
const sendRequest = async <T>(
  client: InternalHttpClient,
  method: HttpMethod,
  url: string,
  options: RequestOptions = {},
): Promise<T> => {
  const hooks = resolveRequestHooks(client.hooks, options.hooks);
  const abortState = createAbortState(options.signal);
  const request: RequestData = {
    url,
    method,
    headers: new Headers(client.headers),
    searchParams: options.searchParams ?? {},
    data: options.data ?? null,
    extra: options.extra ?? {},
    prefix: options.prefix ?? client.prefix,
    fetchOptions: { ...options.fetchOptions },
    signal: abortState.controller.signal,
  };
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    abortState.cleanup();
  };

  try {
    mergeHeaders(request.headers, options.headers);
    request.searchParams = cloneSearchParams(request.searchParams);
    const timeout = validateTimeout(options.timeout ?? client.timeout);
    const retry = resolveRequestRetry(client.retry, options.retry);
    const cache = resolveRequestCache(client.cacheOptions, options.cache);
    const validateStatus = options.validateStatus ?? client.validateStatus;
    const throwHttpErrors = options.throwHttpErrors ?? client.throwHttpErrors;

    if (timeout !== false) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        abortState.controller.abort();
      }, timeout);
    }
    throwIfAborted(request.signal);
    for (const hook of hooks.beforeRequest) await hook(client, request);
    throwIfAborted(request.signal);

    let finalResponse!: Response;
    let finalAccepted = false;
    for (let attempt = 1; ; attempt += 1) {
      const prepared = prepareAttempt(request);
      const canUseCache = cache !== false && isCacheableMethod(request.method);
      const cacheKey = canUseCache
        ? cache.matcher(client, request, prepared.url)
        : false;
      if (cacheKey !== false) {
        const cached = client.cache.get(cacheKey);
        if (cached !== null) {
          if (validateStatus(cached)) {
            finalResponse = cached;
            finalAccepted = true;
            break;
          }
          client.cache.delete(cacheKey);
        }
      }

      let response: Response;
      try {
        response = await fetch(prepared.url, {
          ...request.fetchOptions,
          method: request.method,
          body: prepared.body,
          headers: prepared.headers,
          signal: request.signal,
        });
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason ?? error;
        const shouldRetry = retry !== false
          && retry.retryOnNetworkError
          && prepared.replayable
          && canRetry(request.method, attempt, retry)
          && !isAbort(error, request.signal);
        if (!shouldRetry) throw error;
        await runBeforeRetry(hooks.beforeRetry, client, request, {
          attempt: attempt + 1,
          error,
          signal: request.signal,
        });
        await wait(retry.delay, request.signal);
        continue;
      }

      const accepted = validateStatus(response);
      if (accepted) {
        finalResponse = response;
        finalAccepted = true;
        if (cacheKey !== false && cache !== false) {
          client.cache.set(cacheKey, response, cache.ttl);
        }
        break;
      }

      const shouldRetry = retry !== false
        && prepared.replayable
        && retry.statusCodes.includes(response.status)
        && canRetry(request.method, attempt, retry);
      if (!shouldRetry) {
        finalResponse = response;
        break;
      }
      await runBeforeRetry(hooks.beforeRetry, client, request, {
        attempt: attempt + 1,
        response,
        signal: request.signal,
      });
      await wait(getRetryDelay(response, retry.delay), request.signal);
    }

    cleanup();
    if (!finalAccepted && throwHttpErrors) {
      throw new HttpError(client, snapshotRequest(request), finalResponse);
    }

    let result: unknown = finalResponse;
    for (const hook of hooks.afterResponse) {
      const next = await hook(client, request, result);
      if (next !== undefined) result = next;
    }
    return result as T;
  } catch (caught) {
    cleanup();
    const error = timedOut
      ? new TimeoutError(
          client,
          snapshotRequest(request),
          options.timeout === undefined ? client.timeout as number : options.timeout as number,
          caught,
        )
      : caught;
    await runCatchError(hooks.catchError, client, request, error);
    throw error;
  }
};

/** 把客户端钩子规范化为空数组或用户提供的数组副本。 */
const resolveClientHooks = (hooks?: HookOptions): ClientHooks => ({
  beforeRequest: hooks?.beforeRequest === false ? [] : [...(hooks?.beforeRequest ?? [])],
  afterResponse: hooks?.afterResponse === false ? [] : [...(hooks?.afterResponse ?? [])],
  beforeRetry: hooks?.beforeRetry === false ? [] : [...(hooks?.beforeRetry ?? [])],
  catchError: hooks?.catchError === false ? [] : [...(hooks?.catchError ?? [])],
});

/** 按客户端优先、请求随后合并钩子，false 表示整类禁用。 */
const resolveRequestHooks = (
  clientHooks: ClientHooks,
  hooks?: HookOptions,
): ClientHooks => ({
  beforeRequest: mergeHooks(clientHooks.beforeRequest, hooks?.beforeRequest),
  afterResponse: mergeHooks(clientHooks.afterResponse, hooks?.afterResponse),
  beforeRetry: mergeHooks(clientHooks.beforeRetry, hooks?.beforeRetry),
  catchError: mergeHooks(clientHooks.catchError, hooks?.catchError),
});

/** 合并单类钩子并避免泄漏用户传入的可变数组。 */
const mergeHooks = <T>(
  clientHooks: readonly T[],
  requestHooks: readonly T[] | false | undefined,
): readonly T[] => requestHooks === false
  ? []
  : [...clientHooks, ...(requestHooks ?? [])];

/** 把请求级请求头覆盖到客户端请求头副本。 */
const mergeHeaders = (target: Headers, headers?: HeadersInit): void => {
  if (headers === undefined) return;
  new Headers(headers).forEach((value, key) => target.set(key, value));
};

/** 克隆查询参数，防止钩子修改调用方传入的数据结构。 */
const cloneSearchParams = (searchParams: SearchParams): SearchParams => {
  if (searchParams instanceof URLSearchParams) return new URLSearchParams(searchParams);
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  );
};

/** 为一次实际 fetch 尝试生成最终 URL、请求头和可重放性标记。 */
const prepareAttempt = (request: RequestData) => {
  const url = buildUrl(request.prefix, request.url, request.searchParams);
  const headers = new Headers(request.headers);
  const body = request.method === "get" || request.method === "head"
    ? undefined
    : buildBody(request.data, headers);
  return {
    url,
    headers,
    body,
    replayable: !isReadableStream(body),
  };
};

/** 生成请求体，并在普通 JSON 数据未显式声明时补充内容类型。 */
const buildBody = (data: RequestBody, headers: Headers): BodyInit | undefined => {
  if (data === null) return undefined;
  if (isJsonBody(data)) {
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return JSON.stringify(data);
  }
  return data;
};

/** 判断数据是否属于需要自动 JSON 序列化的普通值。 */
const isJsonBody = (
  data: Exclude<RequestBody, null>,
): data is number | boolean | Record<string, unknown> | readonly unknown[] => {
  if (typeof data === "number" || typeof data === "boolean") return true;
  if (typeof data !== "object") return false;
  if (Array.isArray(data)) return true;
  const prototype = Object.getPrototypeOf(data);
  return prototype === Object.prototype || prototype === null;
};

/** ReadableStream 通常只能消费一次，因此不能自动重试。 */
const isReadableStream = (body: BodyInit | undefined): boolean =>
  typeof ReadableStream !== "undefined" && body instanceof ReadableStream;

/** 合并前缀、请求地址、原有查询参数、新查询参数和哈希片段。 */
const buildUrl = (
  prefix: string,
  requestUrl: string,
  searchParams: SearchParams,
): string => {
  assertPrefix(prefix);
  const combined = isAbsoluteUrl(requestUrl)
    ? requestUrl
    : joinUrl(prefix, requestUrl);
  const hashIndex = combined.indexOf("#");
  const hash = hashIndex === -1 ? "" : combined.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? combined : combined.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  applySearchParams(params, searchParams);
  const serialized = params.toString();
  return `${path}${serialized === "" ? "" : `?${serialized}`}${hash}`;
};

/** 判断请求地址是否包含协议；绝对地址会绕过 prefix。 */
const isAbsoluteUrl = (value: string): boolean =>
  /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);

/** 连接前缀和相对地址，并归一化连接处的斜杠。 */
const joinUrl = (prefix: string, requestUrl: string): string => {
  if (prefix === "") return requestUrl;
  if (requestUrl === "") return prefix;
  return `${prefix.replace(/\/+$/, "")}/${requestUrl.replace(/^\/+/, "")}`;
};

/** 覆盖并序列化查询参数；数组展开、空值忽略、对象使用 JSON。 */
const applySearchParams = (target: URLSearchParams, source: SearchParams): void => {
  if (source instanceof URLSearchParams) {
    const grouped = new Map<string, string[]>();
    source.forEach((value, key) => grouped.set(key, [...(grouped.get(key) ?? []), value]));
    grouped.forEach((values, key) => {
      target.delete(key);
      values.forEach(value => target.append(key, value));
    });
    return;
  }
  Object.entries(source).forEach(([key, value]) => {
    target.delete(key);
    const values = Array.isArray(value) ? value : [value];
    values.forEach(item => {
      if (item === null || item === undefined) return;
      if (typeof item === "object") {
        const serialized = JSON.stringify(item);
        if (serialized === undefined) throw createCodedError(TypeError, "E_SEARCH_PARAM");
        target.append(key, serialized);
      } else {
        target.append(key, String(item));
      }
    });
  });
};

/** 合并并校验重试配置，数组字段使用后提供的值整体替换。 */
const resolveRetry = (
  base: ResolvedRetryOptions,
  options: RetryOptions = {},
): ResolvedRetryOptions => {
  const limit = options.limit ?? base.limit;
  const delay = options.delay ?? base.delay;
  const methods = [...(options.methods ?? base.methods)];
  const statusCodes = [...(options.statusCodes ?? base.statusCodes)];
  if (!Number.isInteger(limit) || limit < 0) throw createCodedError(RangeError, "E_RETRY_LIMIT");
  if (!Number.isFinite(delay) || delay < 0) throw createCodedError(RangeError, "E_RETRY_DELAY");
  if (methods.some(method => !HTTP_METHODS.includes(method))) throw createCodedError(RangeError, "E_RETRY_METHOD");
  if (statusCodes.some(status => !Number.isInteger(status) || status < 100 || status > 599)) {
    throw createCodedError(RangeError, "E_RETRY_STATUS");
  }
  return {
    limit,
    delay,
    methods,
    statusCodes,
    retryOnNetworkError: options.retryOnNetworkError ?? base.retryOnNetworkError,
  };
};

/** 解析请求级重试配置，支持禁用或从关闭状态重新启用。 */
const resolveRequestRetry = (
  clientRetry: false | Readonly<ResolvedRetryOptions>,
  requestRetry: false | RetryOptions | undefined,
): false | ResolvedRetryOptions => {
  if (requestRetry === false) return false;
  if (requestRetry === undefined) return clientRetry === false
    ? false
    : resolveRetry(DEFAULT_RETRY, clientRetry);
  const base = clientRetry === false ? DEFAULT_RETRY : clientRetry;
  return resolveRetry(base, requestRetry);
};

/** 判断当前方法和尝试次数是否仍允许重试。 */
const canRetry = (
  method: HttpMethod,
  attempt: number,
  retry: ResolvedRetryOptions,
): boolean => attempt <= retry.limit && retry.methods.includes(method);

/** 优先解析 Retry-After 秒数或日期，无法解析时使用配置延迟。 */
const getRetryDelay = (response: Response, fallback: number): number => {
  const header = response.headers.get("retry-after");
  if (header === null) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? fallback : Math.max(0, date - Date.now());
};

/** 顺序运行重试前钩子，确保每个修改在下一钩子中可见。 */
const runBeforeRetry = async (
  hooks: readonly BeforeRetry[],
  client: HttpClient,
  request: RequestData,
  context: RetryContext,
): Promise<void> => {
  for (const hook of hooks) await hook(client, request, context);
};

/** 顺序运行错误钩子，并在替换错误时保留原始错误链。 */
const runCatchError = async (
  hooks: readonly CatchError[],
  client: HttpClient,
  request: RequestData,
  error: unknown,
): Promise<void> => {
  for (const hook of hooks) {
    try {
      await hook(client, snapshotRequest(request), error);
    } catch (caught) {
      const replacement = caught instanceof Error ? caught : createCodedError(Error, "E_CATCH_HOOK");
      attachCause(replacement, error);
      throw replacement;
    }
  }
};

/** 为替换错误设置 cause，同时兼容未原生支持 Error.cause 的目标环境。 */
const attachCause = (error: Error, cause: unknown): void => {
  Object.defineProperty(error, "cause", {
    configurable: true,
    value: cause,
  });
};

/** 创建请求快照，避免错误对象中的诊断数据被后续修改。 */
const snapshotRequest = (request: RequestData): Readonly<RequestData> => ({
  ...request,
  headers: new Headers(request.headers),
  searchParams: cloneSearchParams(request.searchParams),
  fetchOptions: { ...request.fetchOptions },
});

/** 解析客户端缓存开关和默认配置。 */
const resolveClientCache = (
  options: false | ClientCacheOptions | undefined,
): ResolvedCacheOptions | false => {
  if (options === false || options === undefined) return false;
  return {
    ttl: parseTtl(options.ttl ?? 0),
    matcher: options.matcher ?? DEFAULT_CACHE_MATCHER,
  };
};

/** 合并请求级缓存配置，并允许单次请求启用或禁用缓存。 */
const resolveRequestCache = (
  clientCache: ResolvedCacheOptions | false,
  requestCache: boolean | RequestCacheOptions | undefined,
): ResolvedCacheOptions | false => {
  if (requestCache === false) return false;
  if (requestCache === undefined) return clientCache;
  const base = clientCache === false
    ? { ttl: 0, matcher: DEFAULT_CACHE_MATCHER }
    : clientCache;
  if (requestCache === true) return base;
  return {
    ttl: parseTtl(requestCache.ttl ?? base.ttl),
    matcher: requestCache.matcher ?? base.matcher,
  };
};

/** 只有 GET 和 HEAD 响应允许进入自动缓存。 */
const isCacheableMethod = (method: HttpMethod): boolean =>
  method === "get" || method === "head";

/** 创建带稳定 code 属性的原生错误，message 与 code 保持一致。 */
const createCodedError = <T extends Error>(
  ErrorType: new (message?: string) => T,
  code: BuiltInErrorCode,
): T & { readonly code: BuiltInErrorCode } =>
  Object.assign(new ErrorType(code), { code });

/** 把数字或带单位的 TTL 转为非负毫秒数。 */
const parseTtl = (value: CacheTtl): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw createCodedError(RangeError, "E_CACHE_TTL");
    return value;
  }
  const match = /^\s*(\d+(?:\.\d+)?)(ms|s|m|h|d)\s*$/.exec(value);
  if (match === null) throw createCodedError(RangeError, "E_CACHE_TTL");
  const amount = Number(match[1]);
  const multipliers: Record<DurationUnit, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[match[2] as DurationUnit];
};

/** 缓存容量必须是正整数。 */
const validateCacheSize = (value: number): number => {
  if (!Number.isInteger(value) || value <= 0) throw createCodedError(RangeError, "E_CACHE_SIZE");
  return value;
};

/** 超时允许使用正数毫秒或 false，false 表示禁用。 */
const validateTimeout = (value: number | false): number | false => {
  if (value === false) return false;
  if (!Number.isFinite(value) || value <= 0) throw createCodedError(RangeError, "E_TIMEOUT_OPTION");
  return value;
};

/** 前缀只负责路径拼接，不允许携带查询字符串或哈希。 */
const assertPrefix = (prefix: string): void => {
  if (prefix.includes("?") || prefix.includes("#")) {
    throw createCodedError(TypeError, "E_PREFIX");
  }
};

/** 合并外部取消信号和内部超时控制器，并提供监听器清理函数。 */
const createAbortState = (external?: AbortSignal) => {
  const controller = new AbortController();
  const abort = () => controller.abort(external?.reason);
  if (external?.aborted) abort();
  else external?.addEventListener("abort", abort, { once: true });
  return {
    controller,
    cleanup: () => external?.removeEventListener("abort", abort),
  };
};

/** 在进入钩子或等待前主动检查取消状态。 */
const throwIfAborted = (signal: AbortSignal): void => {
  if (!signal.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  const error = createCodedError(Error, "E_ABORTED");
  error.name = "AbortError";
  throw error;
};

/** 识别所有不应进入重试流程的主动取消和超时错误。 */
const isAbort = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted
  || (error instanceof Error && error.name === "AbortError")
  || error instanceof TimeoutError;

/** 支持取消的重试等待，结束后会移除监听器。 */
const wait = (milliseconds: number, signal: AbortSignal): Promise<void> => {
  throwIfAborted(signal);
  if (milliseconds === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? createCodedError(Error, "E_ABORTED"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
};
