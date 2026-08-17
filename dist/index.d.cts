/** 客户端支持的请求方法，统一使用小写形式。 */
export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "head";
/** 库自身可能生成的稳定错误码，可用于不依赖错误文案的分支判断。 */
export type BuiltInErrorCode = "E_HTTP_STATUS" | "E_TIMEOUT" | "E_SEARCH_PARAM" | "E_RETRY_LIMIT" | "E_RETRY_DELAY" | "E_RETRY_METHOD" | "E_RETRY_STATUS" | "E_CACHE_TTL" | "E_CACHE_SIZE" | "E_TIMEOUT_OPTION" | "E_PREFIX" | "E_CATCH_HOOK" | "E_ABORTED";
/** TTL 字符串支持的时间单位。 */
export type DurationUnit = "ms" | "s" | "m" | "h" | "d";
/** 由数值和时间单位组成的 TTL 字符串，例如 5s、1m。 */
export type DurationString = `${number}${DurationUnit}`;
/** 缓存有效期；数值表示毫秒，字符串表示带单位的时长。 */
export type CacheTtl = number | DurationString;
/** 查询参数允许直接转换为文本的基础值。 */
export type SearchParamPrimitive = string | number | boolean | null | undefined;
/** 单个查询参数值；数组会展开为同名参数，对象会序列化为 JSON。 */
export type SearchParamValue = SearchParamPrimitive | Record<string, unknown> | readonly (SearchParamPrimitive | Record<string, unknown>)[];
/** 请求查询参数，可直接传入 URLSearchParams 或普通对象。 */
export type SearchParams = URLSearchParams | Record<string, SearchParamValue>;
/** 请求体类型；普通对象、数组、数值和布尔值会自动序列化为 JSON。 */
export type RequestBody = BodyInit | number | boolean | Record<string, unknown> | readonly unknown[] | null;
/** 原生 Fetch 的扩展配置，避免与客户端自身的同名配置冲突。 */
export type FetchOptions = Omit<RequestInit, "method" | "body" | "headers" | "signal">;
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
export type CacheMatcher = (client: HttpClient, request: Readonly<RequestData>, finalUrl: string) => string | false;
/** 请求发送前执行的钩子，仅在一次逻辑请求开始时运行一次。 */
export type BeforeRequest = (client: HttpClient, request: RequestData) => void | Promise<void>;
/** 响应转换钩子；返回 undefined 时保留上一个值，否则替换流水线结果。 */
export type AfterResponse<Input = unknown, Output = unknown> = (client: HttpClient, request: RequestData, value: Input) => Output | void | Promise<Output | void>;
/** 每次重试前执行的钩子，可修改下一次尝试所用的请求数据。 */
export type BeforeRetry = (client: HttpClient, request: RequestData, context: RetryContext) => void | Promise<void>;
/** 最终失败时执行的观察钩子；钩子抛错会替换原错误并挂载原因为 cause。 */
export type CatchError = (client: HttpClient, request: Readonly<RequestData>, error: unknown) => void | Promise<void>;
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
export type MethodRequest = <T = Response>(url: string, options?: RequestOptions) => Promise<T>;
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
/** 状态校验失败时抛出的错误，保留响应和请求快照供调用方诊断。 */
export declare class HttpError extends Error {
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
    constructor(client: HttpClient, request: Readonly<RequestData>, response: Response, cause?: unknown);
}
/** 整个逻辑请求超过时限时抛出的错误，保留超时值和底层原因。 */
/** 固定错误类型名称。 */
export declare class TimeoutError extends Error {
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
    constructor(client: HttpClient, request: Readonly<RequestData>, timeout: number, cause?: unknown);
}
/** 创建独立 HTTP 客户端，并把客户端配置固化为只读运行时属性。 */
export declare const createHttpClient: (options?: CreateHttpClientOptions) => HttpClient;
