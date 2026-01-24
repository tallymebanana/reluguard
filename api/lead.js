export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || "").trim();

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    // ✅ Option D: Log to Vercel (View in Vercel -> Project -> Logs)
    console.log("[RELUGUARD_LEAD]", {
      email,
      orgName: body.orgName ?? null,
      role: body.role ?? null,
      companySize: body.companySize ?? null,
      useCase: body.useCase ?? null,
      page: body.page ?? null,
      ts: body.ts ?? new Date().toISOString(),
      ip:
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        null,
      ua: req.headers["user-agent"] || null,
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "Bad request" });
  }
}
