// Exact allowed origins are configured by FRONTEND_URL (comma-separated if needed).
// Never use a wildcard together with Access-Control-Allow-Credentials.
export function getCorsHeaders(request) {
  const configured = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const origin = request?.headers?.get("origin");
  const allowed = origin && configured.includes(origin);
  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const corsHeaders = getCorsHeaders();
export default corsHeaders;
