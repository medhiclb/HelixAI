import { authorize, connectionFor, fail } from "../lib/server.mjs";
import { syncConnection } from "../lib/sync.mjs";
export default async function handler(req, res) {
  try {
    const ctx = await authorize(req);
    const connection = await connectionFor(ctx, req.body.provider);
    res.setHeader("Cache-Control", "no-store");
    res.json(await syncConnection(ctx.client, connection));
  } catch (e) {
    fail(res, e);
  }
}
