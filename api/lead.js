export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const email = String(body.email || "").trim();
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    const lead = {
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
    };

    // ✅ Still log to Vercel logs
    console.log("[RELUGUARD_LEAD]", lead);

    // ✅ Email notification via Resend (optional but recommended)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const TO = process.env.LEAD_NOTIFY_TO;
    const FROM = process.env.LEAD_NOTIFY_FROM || "onboarding@resend.dev";

    // If env vars aren't set, don't fail the submission — just log.
    if (RESEND_API_KEY && TO) {
      const subject = `ReluGuard lead: ${lead.email}${lead.orgName ? ` (${lead.orgName})` : ""}`;

      const text =
`New ReluGuard submission

Email: ${lead.email}
Org: ${lead.orgName || "-"}
Role: ${lead.role || "-"}
Company size: ${lead.companySize || "-"}
Use case: ${lead.useCase || "-"}
Page: ${lead.page || "-"}
Time: ${lead.ts}
IP: ${lead.ip || "-"}
UA: ${lead.ua || "-"}`;

      // Node on Vercel supports fetch
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
        console.warn("[RELUGUARD_LEAD_EMAIL_FAILED]", r.status, errText);
        // Do not fail the lead capture
      } else {
        console.log("[RELUGUARD_LEAD_EMAIL_SENT]");
      }
    } else {
      console.log("[RELUGUARD_LEAD_EMAIL_SKIPPED] Missing RESEND_API_KEY or LEAD_NOTIFY_TO");
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.warn("[RELUGUARD_LEAD_ERROR]", e?.message || e);
    res.status(400).json({ error: "Bad request" });
  }
}
