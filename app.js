(function () {
  // 🔧 Put your Stripe Payment Link here:
  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/7sYbIU6Mu96A1oyeCWeUU00";

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const buyBtn = document.getElementById("buyBtn");
  if (buyBtn && STRIPE_PAYMENT_LINK && STRIPE_PAYMENT_LINK.startsWith("https://")) {
    buyBtn.setAttribute("href", STRIPE_PAYMENT_LINK);
  }

  const form = document.getElementById("leadForm");
  const msg = document.getElementById("formMsg");
  const btn = document.getElementById("submitBtn");

  if (!form) return;

  function setMsg(text, type) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.classList.remove("ok", "err");
    if (type === "ok") msg.classList.add("ok");
    if (type === "err") msg.classList.add("err");
  }

  function isValidEmail(email) {
    const e = String(email || "").trim();
    return e.includes("@") && e.includes(".");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const orgName = (document.getElementById("orgName")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const role = document.getElementById("role")?.value || "";
    const companySize = document.getElementById("companySize")?.value || "";
    const useCase = document.getElementById("useCase")?.value || "";

    if (!isValidEmail(email)) {
      setMsg("Please enter a valid email address.", "err");
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

    try {
      const prev = localStorage.getItem("reluguard_lead_ts");
      if (prev) {
        const ageMs = Date.now() - Number(prev);
        if (ageMs < 30_000) {
          setMsg("Already submitted — redirecting…", "ok");
          location.href = "thanks.html";
          return;
        }
      }
    } catch {}

    btn.disabled = true;
    btn.textContent = "Submitting…";
    setMsg("", null);

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

      try { localStorage.setItem("reluguard_lead_ts", String(Date.now())); } catch {}
      setMsg("Request received — redirecting…", "ok");
      setTimeout(() => (location.href = "thanks.html"), 500);
    } catch (err) {
      setMsg(err.message || "Something went wrong.", "err");
      btn.disabled = false;
      btn.textContent = "Request the template";
    }
  });
})();
