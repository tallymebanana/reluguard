// api/lead.js
// ✅ Hardened lead capture endpoint for Vercel + Resend
// - Rate limiting (best-effort per serverless instance)
// - Payload size guard
// - Input validation + length caps
// - CRLF sanitisation for email subject
// - Honeypot support (field: "website")

export default async function handler(req, res) {
  const json = (status, body) => {
    res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };

  const clamp = (v, n) => (v == null ? "" : String(v).trim().slice(0, n));
  const oneLine = (v, n) => clamp(v, n).replace(/[\r\n]/g, " ");

  // Safely read an object of answers and clamp each value
  const clampObj = (obj, limits = {}) => {
    const out = {};
    if (!obj || typeof obj !== "object") return out;
    for (const [k, v] of Object.entries(obj)) {
      // Only allow simple scalar values
      const key = clamp(k, 60);
      if (!key) continue;
      const limit = Number(limits[key] || 200);
      out[key] = clamp(v, limit) || "";
    }
    return out;
  };

  // Convert answers object into readable lines for email
  const answersToText = (answers) => {
    const entries = Object.entries(answers || {}).filter(([, v]) => String(v || "").trim());
    if (!entries.length) return "-";
    return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
  };

  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    // ✅ Payload size guard (best-effort; platform may cap too)
    const contentLen = Number(req.headers["content-length"] || 0);
    if (contentLen && contentLen > 20_000) return json(413, { error: "Payload too large" });

    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
    }

    // ✅ Honeypot (bots often fill this)
    const honeypot = clamp(body.website, 200);
    if (honeypot) return json(200, { ok: true }); // silently accept

    const email = clamp(body.email, 200);
    if (!email || email.length < 5 || !email.includes("@")) {
      return json(400, { error: "Valid email required" });
    }

    // ✅ Best-effort rate limit (per instance)
    globalThis.__RG_RL__ ||= new Map();

    const ip =
      (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
        .toString()
        .split(",")[0]
        .trim()
        .slice(0, 80);

    const now = Date.now();
    const key = `lead:${ip}`;
    const windowMs = 60_000; // 1 minute
    const maxReq = 8;        // 8/minute per IP

    const entry = globalThis.__RG_RL__.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    globalThis.__RG_RL__.set(key, entry);

    if (entry.count > maxReq) return json(429, { error: "Too many requests" });

    // NEW: accept structured answers (optional)
    const answers = clampObj(body.answers, {
      riskAppetite: 120,
      aiTools: 200,
      dataSensitivity: 200,
      regEnvironment: 160,
      aiAccessModel: 220,
    });

    const lead = {
      email,
      orgName: clamp(body.orgName, 200),
      role: clamp(body.role, 200),
      companySize: clamp(body.companySize, 100),
      useCase: clamp(body.useCase, 1200),
      answers,
      page: clamp(body.page, 400),
      ts: clamp(body.ts, 60) || new Date().toISOString(),
      ip,
      ua: clamp(req.headers["user-agent"], 300),
    };

    console.log("[RELUGUARD_LEAD]", lead);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const TO = process.env.LEAD_NOTIFY_TO;
    const FROM = process.env.LEAD_NOTIFY_FROM || "onboarding@resend.dev";

    if (!RESEND_API_KEY || !TO) {
      console.warn("[RELUGUARD_LEAD] Missing RESEND_API_KEY or LEAD_NOTIFY_TO");
      return json(200, { ok: true });
    }

    const subject = oneLine(
      `ReluGuard lead — ${lead.email}${lead.orgName ? ` (${lead.orgName})` : ""}`,
      140
    );

    const text =
`New ReluGuard submission

Email: ${lead.email}
Org: ${lead.orgName || "-"}
Role: ${lead.role || "-"}
Company size: ${lead.companySize || "-"}
Use case: ${lead.useCase || "-"}

Policy tailoring answers:
${answersToText(lead.answers)}

Page: ${lead.page || "-"}
Time: ${lead.ts}
IP: ${lead.ip || "-"}
UA: ${lead.ua || "-"}`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject,
        text,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.warn("[RELUGUARD_LEAD_EMAIL_FAILED]", r.status, errText.slice(0, 800));
      return json(200, { ok: true });
    }

    return json(200, { ok: true });
  } catch (e) {
    console.warn("[RELUGUARD_LEAD_ERROR]", e?.message || e);
    return json(400, { error: "Bad request" });
  }
}
