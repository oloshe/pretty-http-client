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
exports.createHttpClient = void 0;
const json_bigint_1 = __importDefault(require("json-bigint"));
const createHttpClient = (options) => {
    var _a, _b, _c;
    const client = {
        prefix: options.prefix,
        alias: (_a = options.alias) !== null && _a !== void 0 ? _a : '',
        headers: Object.assign({}, options.headers),
        hooks: {
            beforeRequest: options.hooks.beforeRequest || [],
            afterResponse: options.hooks.afterResponse || [],
            beforeRetry: options.hooks.beforeRetry || [],
            catchError: options.hooks.catchError || []
        },
        retryCount: (_b = options.retryCount) !== null && _b !== void 0 ? _b : 0,
        retryTimeout: (_c = options.retryTimeout) !== null && _c !== void 0 ? _c : 0,
        get: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'GET' })),
        post: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'POST' })),
        put: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'PUT' })),
        delete: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'DELETE' })),
        patch: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'PATCH' })),
        head: (url, options) => sendSequest(client, Object.assign(Object.assign({}, options), { url, method: 'HEAD' }))
    };
    return client;
};
exports.createHttpClient = createHttpClient;
const sendSequest = (client, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const req = Object.assign(options, {
        headers: Object.assign(Object.assign({}, client.headers), options.headers),
        searchParams: options.searchParams || {},
        data: options.data || {}
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
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (req.data instanceof FormData) {
            body = req.data;
        }
        else {
            body = json_bigint_1.default.stringify(req.data);
        }
    }
    let json;
    try {
        const response = yield fetch(url, {
            method: req.method,
            body: body,
            headers: req.headers
        });
        json = yield response.json();
    }
    catch (e) {
        // 重试
        if (retryCount > 0) {
            console.log('retry');
            for (const fn of client.hooks.beforeRetry) {
                fn(client, options);
            }
            yield delay(client.retryTimeout);
            return sendSequest(client, Object.assign(Object.assign({}, options), { retryCount: retryCount - 1 }));
        }
        for (const fn of client.hooks.catchError) {
            fn(e);
        }
        throw e;
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
const delay = (ms = 0) => new Promise(resolve => setTimeout(() => resolve(), ms));
