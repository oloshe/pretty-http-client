import clientPackage = require("pretty-http-client");

const client: clientPackage.HttpClient = clientPackage.createHttpClient({
  timeout: false,
});

void client.head("https://example.com");
void clientPackage.TimeoutError;
