/**
 * 请求数据
 */
export interface RequestData {
    /** 请求url, 不包含 prefix */
    url: string;
    /** Http方法 */
    method: HttpMethod;
    /** 请求头 */
    headers: Record<string, string>;
    /** url query 参数 */
    searchParams: Record<string, any>;
    /** body json 数据 */
    data: Record<string, any> | FormData | string | null;
    /** 额外数据 */
    extra: any;
    /** 前缀 */
    prefix?: string;
}
/** http方法 */
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
    /** 钩子 */
    hooks?: Partial<ClientHook>;
    /** 请求前缀，如果设置了则会覆盖 client.prefix */
    prefix?: string;
    /** 传递额外数据，不参与实际请求 */
    extra?: any;
}
export interface CacheOptions {
    /** 缓存的时长，单位毫秒，如果时间是 0 或小于0 则表示无限制，默认为 0 */
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
interface CreateHttpClientOptions {
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
    /** 缓存大小, LRUCache的最大容量 */
    cacheSize?: number;
}
type MethodRequest = <T = Response>(
/** 请求url */
url: string, options?: Partial<RequestOptions>) => Promise<T>;
interface ClientHook {
    /** 请求前钩子 */
    beforeRequest: BeforeRequest[];
    /** 请求后钩子, 如果返回值不为 undefined，则替换为返回值 */
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
    readonly prefix: string;
    /** 别名 */
    readonly alias: string;
    /** 通用请求头 */
    readonly headers: Record<string, string>;
    /** 请求钩子 */
    readonly hooks: ClientHook;
    /** 重试次数 */
    readonly retryCount: number;
    /** 重试延迟 */
    readonly retryTimeout: number;
    /** LRU 缓存 */
    readonly cache: LRUCache<string, Response>;
    /** GET 请求 */
    readonly get: MethodRequest;
    /** POST 请求 */
    readonly post: MethodRequest;
    /** PUT 请求 */
    readonly put: MethodRequest;
    /** DELETE 请求 */
    readonly delete: MethodRequest;
    /** PATCH 请求 */
    readonly patch: MethodRequest;
    /** HEAD 请求 */
    readonly head: MethodRequest;
}
export declare const createHttpClient: (options?: CreateHttpClientOptions) => HttpClient;
declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    constructor(maxSize: number);
    /**
     * 添加缓存
     * @param key 键
     * @param value 值
     * @param activeTime 有效时间（毫秒）
     */
    set(key: K, value: V, activeTime: number): void;
    /**
     * 获取缓存
     * @param key 键
     * @returns 值或者 null（过期或不存在时）
     */
    get(key: K): V | null;
    /**
     * 获取当前缓存大小
     * @returns 缓存项的数量
     */
    get size(): number;
    /**
     * 清空缓存
     */
    clear(): void;
    /**
     * 删除缓存项
     */
    delete(key: K): boolean;
}
export {};
