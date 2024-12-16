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
    /** 请求URL参数, 会过滤掉 undefined 和 null 的字段 */
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
    matcher: (client: HttpClient, req: RequestData) => string;
}
/** 请求预处理方法 */
export type BeforeRequest = (client: HttpClient, req: RequestData) => void | Promise<void>;
/** 响应转换方法 */
export type AfterResponse<T = Response> = (client: HttpClient, req: RequestData, res: T) => void | T | Promise<T>;
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
type MethodRequest = <T = Response>(url: string, options?: Partial<RequestOptions>) => Promise<T>;
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
export declare const createHttpClient: <T = Response>(options?: CreateHttpClientOptions<T>) => HttpClient;
export {};
