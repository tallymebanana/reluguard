// api/generate.js
// Vercel Serverless Function (Node.js). No package.json needed.

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function clampStr(s, max) {
  if (!s) return "";
  return String(s).slice(0, max);
}

module.exports = async (req, res) => {
  // Basic CORS for browser calls (same-origin on Vercel, but harmless)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.end();
  if (req.method !== "POST") return json(res, 405, { error: "Use POST" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 500, { error: "Server missing OPENAI_API_KEY" });

  // Guardrails (cost + abuse control)
  const MAX_CHARS = Number(process.env.RELUGUARD_MAX_CHARS || 12000);
  const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // you can change later in Vercel env vars

  let payload;
  try {
    payload = req.body || {};
    // Vercel usually parses JSON; if not, try parsing raw
    if (typeof payload === "string") payload = JSON.parse(payload);
  } catch {
    return json(res, 400, { error: "Invalid JSON body" });
  }

  const task = clampStr(payload.task, 40) || "policy";
  const tone = clampStr(payload.tone, 40) || "audit";
  const format = clampStr(payload.format, 20) || "markdown";
  const userText = clampStr(payload.text, MAX_CHARS);

  if (userText.length < 50) {
    return json(res, 400, { error: `Please provide at least ~50 characters of input text.` });
  }

  // “Audit-ready” = artefact + assumptions + scope boundaries + declared gaps + traceability + how-produced note.
  const system = `
You are ReluGuard, an AI assistant that produces "audit-ready artefacts" (NOT compliance verdicts).
You MUST:
- Avoid claiming the organisation is compliant.
- Be explicit about assumptions and scope boundaries.
- Provide a traceability map to ISO/IEC 27001 intent-level clauses (high-level mapping is fine).
- Produce output that a human can review and take ownership of.
If input appears confidential, remind the user to redact sensitive data; do not store or request secrets.
`;

  const taskInstructions = `
Create an ISO/IEC 27001-aligned Information Security Policy artefact.
Return in ${format === "plain" ? "plain text" : "Markdown"}.

Output structure (use headings):
1) Policy (clean, concise, auditor-friendly)
   - Purpose, Scope, Definitions (brief)
   - Governance & Responsibilities
   - Risk management
   - Asset management
   - Access control
   - Cryptography (high level)
   - Logging & monitoring (high level)
   - Incident management
   - Third-party / supplier security (high level)
   - Business continuity / disaster recovery (high level)
   - Awareness & training
   - Compliance, exceptions, review cadence
2) Assumptions
3) Scope boundaries (what this policy does NOT cover / “handled elsewhere”)
4) Declared gaps / items requiring organisation-specific decisions
5) ISO/IEC 27001 traceability map (table: Policy Section → ISO intent area)
6) “How this was produced” note (inputs used + human review required)

Tone: ${tone}. Task label: ${task}.
Keep it practical and not overly long.
`;

  const input = `
User-provided context (may be partial, treat as drafting material):
${userText}
`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: system.trim() },
          { role: "user", content: taskInstructions.trim() + "\n\n" + input.trim() }
        ],
        // Cost control:
        max_output_tokens: 1800
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return json(res, 502, { error: `OpenAI error (${r.status})`, detail: errText.slice(0, 800) });
    }

    const data = await r.json();

    // Responses API typically returns output text in output_text
    const outputText =
      data.output_text ||
      (Array.isArray(data.output)
        ? data.output.map(o => (o.content || []).map(c => c.text || "").join("")).join("\n")
        : "");

    if (!outputText) return json(res, 502, { error: "No output returned from model." });

    return json(res, 200, { output: outputText });
  } catch (e) {
    return json(res, 500, { error: "Server exception", detail: String(e && e.message ? e.message : e).slice(0, 400) });
  }
};
