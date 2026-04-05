export default {
  async fetch(request, env) {
    const upstream = env.UPSTREAM_BASE_URL;
    if (!upstream) {
      return new Response("UPSTREAM_BASE_URL is not configured", { status: 500 });
    }

    const requestUrl = new URL(request.url);
    const upstreamUrl = new URL(upstream);
    upstreamUrl.pathname = requestUrl.pathname;
    upstreamUrl.search = requestUrl.search;

    const headers = new Headers(request.headers);
    headers.set("host", upstreamUrl.host);
    headers.set("x-forwarded-host", requestUrl.host);
    headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));

    const response = await fetch(new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual"
    }));

    const nextHeaders = new Headers(response.headers);
    nextHeaders.set("cache-control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders
    });
  }
};
