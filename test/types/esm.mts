import {
  HttpError,
  createHttpClient,
  type HttpClient,
  type RetryOptions,
} from "pretty-http-client";

const retry: RetryOptions = { limit: 1, methods: ["get"] };
const client: HttpClient = createHttpClient({ retry });

void client.get("https://example.com");
void HttpError;
