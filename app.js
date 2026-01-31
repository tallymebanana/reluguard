function init() {
  // 🔧 Put your Stripe Payment Link here (must start with https://)
  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/dRm7sE8UC0A4d7g1QaeUU01";

  // ---------- helpers ----------
  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  }

  function isValidEmail(email) {
    const e = String(email || "").trim();
    return e.includes("@") && e.includes(".");
  }

  function buildStripeUrl(base, email) {
    const u = new URL(base);
    // Stripe Payment Links supports prefilled_email
    u.searchParams.set("prefilled_email", email);
    return u.toString();
  }

  function readHoneypot(formEl) {
    return (formEl?.querySelector('input[name="website"]')?.value || "").trim();
  }

  function pickValue(id) {
    return (document.getElementById(id)?.value || "").trim();
  }

  function buildSummary(fields) {
    // Only include non-empty values in the summary (keeps email readable)
    const parts = [];
    if (fields.orgName) parts.push(`Org: ${fields.orgName}`);
    if (fields.riskAppetite) parts.push(`Risk: ${fields.riskAppetite}`);
    if (fields.aiTools) parts.push(`Tools: ${fields.aiTools}`);
    if (fields.dataSensitivity) parts.push(`Data: ${fields.dataSensitivity}`);
    if (fields.regEnvironment) parts.push(`Reg: ${fields.regEnvironment}`);
    if (fields.aiAccessModel) parts.push(`Access model: ${fields.aiAccessModel}`);

    return parts.length ? parts.join(" | ") : "(no extra answers provided)";
  }

  async function postLead(payload) {
    // Best-effort: do not block purchase if logging fails
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- BUY JOURNEY ----------
  const buyForm = document.getElementById("buyJourney");
  const buyMsg = document.getElementById("buyMsg");
  const buyNowBtn = document.getElementById("buyNowBtn");

  if (buyForm) {
    buyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Honeypot (bots): if filled, DROP silently (or show generic message)
      const honeypot = readHoneypot(buyForm);
      if (honeypot) {
        // Drop. No redirect. No logging.
        setMsg(buyMsg, "Could not continue. Please try again.", "err");
        return;
      }

      const fields = {
        orgName: pickValue("orgName"),
        email: pickValue("email"),

        // Existing selects (now optional)
        riskAppetite: pickValue("riskAppetite"),
        aiTools: pickValue("aiTools"),
        dataSensitivity: pickValue("dataSensitivity"),

        // New selects (also optional unless you choose otherwise)
        regEnvironment: pickValue("regEnvironment"),
        aiAccessModel: pickValue("aiAccessModel"),
      };

      // Validate config
      if (!STRIPE_PAYMENT_LINK || !STRIPE_PAYMENT_LINK.startsWith("https://")) {
        setMsg(buyMsg, "Stripe link not configured yet.", "err");
        return;
      }

      // Validate inputs (ONLY email required)
      if (!isValidEmail(fields.email)) {
        setMsg(buyMsg, "Please enter a valid email address.", "err");
        return;
      }

      // UI state
      if (buyNowBtn) {
        buyNowBtn.disabled = true;
        buyNowBtn.textContent = "Opening secure checkout…";
      }
      setMsg(buyMsg, "", null);

      // Build a summary that will definitely appear in your email (via useCase)
      const summary = buildSummary(fields);

      // Log purchase intent (best-effort)
      await postLead({
        // Core
        email: fields.email,
        orgName: fields.orgName || null,

        // Important: keep honeypot field name for backend consistency (always empty here)
        website: "",

        // Keep current behaviour: pack answers into useCase string so you see them in email
        useCase: `Purchase intent | ${summary}`,

        // Also send structured fields for future template automation / better emails
        answers: {
          riskAppetite: fields.riskAppetite || null,
          aiTools: fields.aiTools || null,
          dataSensitivity: fields.dataSensitivity || null,
          regEnvironment: fields.regEnvironment || null,
          aiAccessModel: fields.aiAccessModel || null,
        },

        page: location.href,
        ts: new Date().toISOString(),
      });

      // Redirect to Stripe (same tab = smoother journey)
      window.location.href = buildStripeUrl(STRIPE_PAYMENT_LINK, fields.email);
    });
  }

  // ---------- QUESTION FORM ----------
  const qForm = document.getElementById("questionForm");
  const qEmailEl = document.getElementById("qEmail");
  const qTextEl = document.getElementById("qMsg");
  const qBtn = document.getElementById("qBtn");
  const qFormMsg = document.getElementById("qFormMsg");

  if (qForm) {
    qForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Honeypot (bots): drop
      const honeypot = readHoneypot(qForm);
      if (honeypot) {
        setMsg(qFormMsg, "Could not send. Please try again.", "err");
        return;
      }

      const email = (qEmailEl?.value || "").trim();
      const message = (qTextEl?.value || "").trim();

      if (!isValidEmail(email) || !message) {
        setMsg(qFormMsg, "Please enter your email and a message.", "err");
        return;
      }

      if (qBtn) {
        qBtn.disabled = true;
        qBtn.textContent = "Sending…";
      }
      setMsg(qFormMsg, "", null);

      const ok = await postLead({
        email,
        orgName: null,
        website: "",
        useCase: `Question | ${message}`,
        page: location.href,
        ts: new Date().toISOString(),
      });

      if (ok) {
        setMsg(qFormMsg, "Sent — we’ll reply by email.", "ok");
        qForm.reset();
      } else {
        setMsg(qFormMsg, "Could not send. Please try again.", "err");
      }

      if (qBtn) {
        qBtn.disabled = false;
        qBtn.textContent = "Send";
      }
    });
  }
}

init();
