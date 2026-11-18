export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode refusée." });
    return;
  }
  const database = !!(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  res.json({
    database,
    oauth: {
      google: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      microsoft: !!(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ),
    },
    encryption: /^[a-f0-9]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY || ""),
    app_url: !!process.env.APP_URL,
    ai: !!(process.env.HELIX_AI_URL && process.env.HELIX_AI_KEY && process.env.HELIX_AI_MODEL),
    background_sync: !!process.env.CRON_SECRET,
  });
}
