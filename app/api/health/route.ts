export function GET() {
  return Response.json({
    ok: true,
    service: "trip-weave-api",
    routes: ["/api/flights/search-stream"],
  });
}
