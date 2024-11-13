import JSON_BIGINT from 'json-bigint'

/**
 * 请求数据
 */
export interface RequestData {
  /** 请求url */
  url: string
  /** Http方法 */
  method: HttpMethod
  /** 请求头 */
  headers: Record<string, string>
  /** url query 参数 */
  searchParams: Record<string, string>
  /** body json 数据 */
  data: Record<string, any> | FormData | null
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'

/**
 * 请求参数
 */
export interface RequestOptions {
  /** 相对url */
  url: string
  /** http 方法 */
  method: HttpMethod
  /** 请求头 */
  headers?: Record<string, string>
  /** 请求URL参数 */
  searchParams?: Record<string, string>
  /** 请求体 */
  data?: Record<string, any> | FormData | null
  /** 重试次数 */
  retryCount?: number
}

export type BeforeRequest = (client: HttpClient, req: RequestData) => void | Promise<void>
export type AfterResponse<T = any> = (client: HttpClient, req: RequestData, res: T) => void | T
export type BeforeRetry = (client: HttpClient, options: RequestOptions) => void
export type CatchError = (e: any) => void

interface CreateHttpClientOptions<T> {
  /** 请求前缀 */
  prefix: string
  /** 别名 */
  alias?: string
  /** 通用headers */
  headers: Record<string, string>
  /** 钩子 */
  hooks: Partial<ClientHook<T>>
  /** 重试次数 */
  retryCount?: number
  /** 重试延迟 */
  retryTimeout?: number
}

type MethodRequest = <T>(url: string, options?: Partial<RequestOptions>) => Promise<T>

interface ClientHook<T> {
  /** 请求前钩子 */
  beforeRequest: BeforeRequest[]
  /** 请求后钩子 */
  afterResponse: AfterResponse<T>[]
  /** 重试钩子 */
  beforeRetry: BeforeRetry[]
  /** 捕获错误钩子 */
  catchError: CatchError[]
}

/**
 * http 客户端
 */
interface HttpClient<T = any> {
  /** 前缀 */
  prefix: string
  /** 别名 */
  alias: string
  /** 通用请求头 */
  headers: Record<string, string>
  /** 请求钩子 */
  hooks: ClientHook<T>
  retryCount: number
  retryTimeout: number
  /** GET 请求 */
  get: MethodRequest
  /** POST 请求 */
  post: MethodRequest
  /** PUT 请求 */
  put: MethodRequest
  /** DELETE 请求 */
  delete: MethodRequest
  /** PATCH 请求 */
  patch: MethodRequest
  /** HEAD 请求 */
  head: MethodRequest
}

export const createHttpClient = <T>(options: CreateHttpClientOptions<T>) => {
  const client: HttpClient<T> = {
    prefix: options.prefix,
    alias: options.alias ?? '',
    headers: { ...options.headers },
    hooks: {
      beforeRequest: options.hooks.beforeRequest || [],
      afterResponse: options.hooks.afterResponse || [],
      beforeRetry: options.hooks.beforeRetry || [],
      catchError: options.hooks.catchError || []
    },
    retryCount: options.retryCount ?? 0,
    retryTimeout: options.retryTimeout ?? 0,
    get: (url, options) => sendSequest(client, { ...options, url, method: 'GET' }),
    post: (url, options) => sendSequest(client, { ...options, url, method: 'POST' }),
    put: (url, options) => sendSequest(client, { ...options, url, method: 'PUT' }),
    delete: (url, options) => sendSequest(client, { ...options, url, method: 'DELETE' }),
    patch: (url, options) => sendSequest(client, { ...options, url, method: 'PATCH' }),
    head: (url, options) => sendSequest(client, { ...options, url, method: 'HEAD' })
  }
  return client
}

const sendSequest = async <T>(client: HttpClient, options: RequestOptions): Promise<T> => {
  const req: RequestData = Object.assign(options, {
    headers: { ...client.headers, ...options.headers },
    searchParams: options.searchParams || {},
    data: options.data || {}
  })

  // 重试次数
  const retryCount = options.retryCount ?? client.retryCount

  // 钩子: beforeRequest
  for (const fn of client.hooks.beforeRequest ?? []) {
    await fn(client, req)
  }

  const baseUrl = client.prefix + req.url
  const query = new URLSearchParams(req.searchParams).toString()
  const url = query ? `${baseUrl}?${query}` : baseUrl

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.data instanceof FormData) {
      body = req.data
    } else {
      body = JSON_BIGINT.stringify(req.data)
    }
  }

  let json: T
  try {
    const response: Response = await fetch(url, {
      method: req.method,
      body: body,
      headers: req.headers
    })

    json = await response.json()
  } catch (e: any) {
    // 重试
    if (retryCount > 0) {
      console.log('retry')
      for (const fn of client.hooks.beforeRetry) {
        fn(client, options)
      }

      await delay(client.retryTimeout)
      return sendSequest(client, { ...options, retryCount: retryCount - 1 })
    }
    for (const fn of client.hooks.catchError) {
      fn(e)
    }
    throw e
  }

  // 钩子: afterResponse
  // 如果返回值不为 undefined，则替换为返回值
  for (const fn of client.hooks.afterResponse) {
    const result = fn(client, req, json)
    if (result !== undefined) {
      json = result
    }
  }

  return json
}

const delay = (ms: number = 0) => new Promise<void>(resolve => setTimeout(() => resolve(), ms))
