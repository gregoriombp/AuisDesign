

// Compat with the solve skill and the mention runner (they check ok +
// schemaVersion==3 before running). The bridge is serverless and embedded — no
// token, same-origin.
export async function GET() {
  return Response.json({
    ok: true,
    service: "auis-review-bridge",
    mode: "serverless",
    schemaVersion: 3,
    tokenRequired: false,
  });
}
