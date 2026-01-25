function init() {
  // 🔧 Put your Stripe Payment Link here (must start with https://)
  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/7sYbIU6Mu96A1oyeCWeUU00";

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

  // Footer year (if you have it)
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- BUY JOURNEY ----------
  const buyForm = document.getElementById("buyJourney");
  const buyMsg = document.getElementById("buyMsg");
  const buyNowBtn = document.getElementById("buyNowBtn");

  if (buyForm) {
    buyForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const org = (document.getElementById("orgName")?.value || "").trim();
      const email = (document.getElementById("email")?.value || "").trim();
      const risk = document.getElementById("riskAppetite")?.value || "";
      const tools = document.getElementById("aiTools")?.value || "";
      const data = document.getElementById("dataSensitivity")?.value || "";

      // Validate config
      if (!STRIPE_PAYMENT_LINK || !STRIPE_PAYMENT_LINK.startsWith("https://")) {
        setMsg(buyMsg, "Stripe link not configured yet.", "err");
        return;
      }

      // Validate inputs
      if (!isValidEmail(email)) {
        setMsg(buyMsg, "Please enter a valid email address.", "err");
        return;
      }
      if (!risk || !tools || !data) {
        setMsg(buyMsg, "Please answer the 3 questions above.", "err");
        return;
      }

      // UI state
      if (buyNowBtn) {
        buyNowBtn.disabled = true;
        buyNowBtn.textContent = "Opening secure checkout…";
      }
      setMsg(buyMsg, "", null);

      // Log purchase intent (best-effort)
      // We pack the custom answers into useCase so your current /api/lead.js email includes them.
      const useCase =
        `Purchase intent | Risk: ${risk} | Tools: ${tools} | Data: ${data}`;

      await postLead({
        email,
        orgName: org || null,
        useCase,
        page: location.href,
        ts: new Date().toISOString(),
      });

      // Redirect to Stripe (same tab = smoother journey)
      window.location.href = buildStripeUrl(STRIPE_PAYMENT_LINK, email);
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
