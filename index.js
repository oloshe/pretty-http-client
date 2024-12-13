"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpClient = exports.jsonBigInt = void 0;
const json_bigint_1 = __importDefault(require("json-bigint"));
exports.jsonBigInt = json_bigint_1.default;
const createHttpClient = (options) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const client = {
        prefix: (_a = options === null || options === void 0 ? void 0 : options.prefix) !== null && _a !== void 0 ? _a : "",
        alias: (_b = options === null || options === void 0 ? void 0 : options.alias) !== null && _b !== void 0 ? _b : "",
        headers: Object.assign({}, options === null || options === void 0 ? void 0 : options.headers),
        hooks: {
            beforeRequest: ((_c = options === null || options === void 0 ? void 0 : options.hooks) === null || _c === void 0 ? void 0 : _c.beforeRequest) || [],
            afterResponse: ((_d = options === null || options === void 0 ? void 0 : options.hooks) === null || _d === void 0 ? void 0 : _d.afterResponse) || [],
            beforeRetry: ((_e = options === null || options === void 0 ? void 0 : options.hooks) === null || _e === void 0 ? void 0 : _e.beforeRetry) || [],
            catchError: ((_f = options === null || options === void 0 ? void 0 : options.hooks) === null || _f === void 0 ? void 0 : _f.catchError) || [],
        },
        retryCount: (_g = options === null || options === void 0 ? void 0 : options.retryCount) !== null && _g !== void 0 ? _g : 0,
        retryTimeout: (_h = options === null || options === void 0 ? void 0 : options.retryTimeout) !== null && _h !== void 0 ? _h : 0,
        get: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "GET" })),
        post: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "POST" })),
        put: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "PUT" })),
        delete: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "DELETE" })),
        patch: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "PATCH" })),
        head: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: "HEAD" })),
    };
    return client;
};
exports.createHttpClient = createHttpClient;
const sendSequest = (client, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const req = Object.assign(options, {
        headers: Object.assign(Object.assign({}, client.headers), options.headers),
        searchParams: options.searchParams || {},
        data: options.data || {},
    });
    // 重试次数
    const retryCount = (_a = options.retryCount) !== null && _a !== void 0 ? _a : client.retryCount;
    // 钩子: beforeRequest
    for (const fn of (_b = client.hooks.beforeRequest) !== null && _b !== void 0 ? _b : []) {
        yield fn(client, req);
    }
    const baseUrl = client.prefix + req.url;
    const query = new URLSearchParams(req.searchParams).toString();
    const url = query ? `${baseUrl}?${query}` : baseUrl;
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.data instanceof FormData) {
            body = req.data;
        }
        else {
            body = json_bigint_1.default.stringify(req.data);
        }
    }
    let json;
    // 缓存时间
    const cacheTime = (_d = (_c = options.cache) === null || _c === void 0 ? void 0 : _c.milliseconds) !== null && _d !== void 0 ? _d : 0;
    // 是否使用缓存
    const useCache = cacheTime > 0;
    let cacheKey;
    // 若使用缓存，则先尝试从缓存中获取数据
    if (useCache) {
        if (((_e = options.cache) === null || _e === void 0 ? void 0 : _e.matchType) === "path") {
            cacheKey = url.split("?")[0];
        }
        else {
            cacheKey = url;
        }
        const cacheData = PRETTY_CACHE.get(cacheKey);
        if (cacheData) {
            // 缓存未过期
            const response = cacheData;
            json = json_bigint_1.default.parse(yield response.text());
        }
    }
    // 如果没有命中缓存，则发送请求
    if (!json) {
        try {
            const response = yield fetch(url, {
                method: req.method,
                body: body,
                headers: req.headers,
            });
            if (useCache) {
                PRETTY_CACHE.set(cacheKey, response, cacheTime);
            }
            json = json_bigint_1.default.parse(yield response.text());
        }
        catch (e) {
            // 重试
            if (retryCount > 0) {
                // 触发hook
                for (const fn of client.hooks.beforeRetry) {
                    fn(client, options);
                }
                // 等待一段时间再重试
                yield delay(client.retryTimeout);
                // 重新发送请求
                return sendSequest(client, Object.assign(Object.assign({}, options), { retryCount: retryCount - 1 }));
            }
            for (const fn of client.hooks.catchError) {
                fn(e);
            }
            throw e;
        }
    }
    // 钩子: afterResponse
    // 如果返回值不为 undefined，则替换为返回值
    for (const fn of client.hooks.afterResponse) {
        const result = fn(client, req, json);
        if (result !== undefined) {
            json = result;
        }
    }
    return json;
});
const delay = (ms = 0) => new Promise((resolve) => setTimeout(() => resolve(), ms));
class LRUCache {
    constructor(maxSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    /**
     * 添加缓存
     * @param key 键
     * @param value 值
     * @param activeTime 有效时间（毫秒）
     */
    set(key, value, activeTime) {
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
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
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
    has(key) {
        return this.cache.has(key);
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
const PRETTY_CACHE = new LRUCache(10000);
