// 🔧 Put your Stripe Payment Link here:
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/7sYbIU6Mu96A1oyeCWeUU00";

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

function buildStripeUrl(base, email, org) {
  const u = new URL(base);

  // Stripe supports prefilled_email on Payment Links
  u.searchParams.set("prefilled_email", email);

  // Optional: store org as reference (shows in Stripe as client reference)
  if (org) u.searchParams.set("client_reference_id", org.slice(0, 64));

  return u.toString();
}

(function () {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ✅ Integrated buy journey: email -> Stripe checkout
  const buyForm = document.getElementById("buyJourney");
  const buyMsg = document.getElementById("buyMsg");
  const buyNowBtn = document.getElementById("buyNowBtn");

  if (buyForm) {
    buyForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const org = (document.getElementById("orgName")?.value || "").trim();
      const email = (document.getElementById("email")?.value || "").trim();

      if (!STRIPE_PAYMENT_LINK || !STRIPE_PAYMENT_LINK.startsWith("https://")) {
        setMsg(buyMsg, "Stripe link not configured yet.", "err");
        return;
      }

      if (!isValidEmail(email)) {
        setMsg(buyMsg, "Please enter a valid email address.", "err");
        return;
      }

      buyNowBtn.disabled = true;
      buyNowBtn.textContent = "Opening secure checkout…";
      setMsg(buyMsg, "", null);

      // Open Stripe in same tab (cleaner journey)
      window.location.href = buildStripeUrl(STRIPE_PAYMENT_LINK, email, org);
    });
  }

  // -----------------------------
  // Existing enquiry form (leadForm)
  // -----------------------------
  const form = document.getElementById("leadForm");
  const msg = document.getElementById("formMsg");
  const btn = document.getElementById("submitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const orgName = (document.getElementById("orgName2")?.value || "").trim();
    const email = (document.getElementById("email2")?.value || "").trim();
    const role = document.getElementById("role")?.value || ""; // if present on your page
    const companySize = document.getElementById("companySize")?.value || ""; // if present
    const useCase = document.getElementById("useCase")?.value || "";

    if (!isValidEmail(email)) {
      setMsg(msg, "Please enter a valid email address.", "err");
      return;
    }

    const payload = {
      email,
      orgName: orgName || null,
      role,
      companySize,
      useCase,
      page: location.href,
      ts: new Date().toISOString(),
    };

    btn.disabled = true;
    btn.textContent = "Sending…";
    setMsg(msg, "", null);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let body = {};
        try { body = await res.json(); } catch {}
        throw new Error(body.error || "Submission failed. Please try again.");
      }

      setMsg(msg, "Sent — we’ll reply by email.", "ok");
      btn.disabled = false;
      btn.textContent = "Send";
      form.reset();
    } catch (err) {
      setMsg(msg, err.message || "Something went wrong.", "err");
      btn.disabled = false;
      btn.textContent = "Send";
    }
  });
})();

