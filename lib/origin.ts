export function appOrigin(request: Request) {
  const configured = process.env.BETTER_AUTH_URL;
  if (configured) {
    const url = new URL(configured);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
      throw new Error("BETTER_AUTH_URL must use HTTPS");
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("BETTER_AUTH_URL must contain only the site origin");
    }
    return url.origin;
  }
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
    return url.origin;
  }
  throw new Error("BETTER_AUTH_URL is not configured");
}
