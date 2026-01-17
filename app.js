// app.js — ReluGuard v1 UI logic (ISO 27001 Policy only)

const $ = (id) => document.getElementById(id);

const orgType = $("orgType");
const orgSize = $("orgSize");
const posture = $("posture");
const notes = $("notes");
const format = $("format");

const generateBtn = $("generateBtn");
const demoBtn = $("demoBtn");
const statusEl = $("status");
const outputEl = $("output");
const copyBtn = $("copyBtn");
const downloadBtn = $("downloadBtn");
const themeToggle = $("themeToggle");

function setStatus(msg, kind = "") {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

function buildUserContext() {
  const parts = [];
  parts.push(`Organisation type: ${orgType.value || "(not specified)"}`);
  parts.push(`Organisation size: ${orgSize.value || "(not specified)"}`);
  parts.push(`Regulatory driver: ISO/IEC 27001`);
  parts.push(`Target compliance posture: ${posture.value || "(not specified)"}`);
  if ((notes.value || "").trim()) parts.push(`Notes / scope: ${notes.value.trim()}`);
  return parts.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function callBackend() {
  setStatus("Generating…", "");
  generateBtn.disabled = true;
  demoBtn.disabled = true;

  const payload = {
    // Backend currently supports these fields
    task: "iso27001_policy",
    tone: "audit",
    format: format.value || "markdown",
    text: buildUserContext()
  };

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error ? `${data.error}` : `Request failed (${res.status})`;
      setStatus(`Backend error (${res.status}). ${msg}`, "error");
      return;
    }

    outputEl.value = data.output || "";
    setStatus("Done. Review and adapt before approval.", "ok");
  } catch (e) {
    setStatus(`Network error. ${String(e?.message || e)}`, "error");
  } finally {
    generateBtn.disabled = false;
    demoBtn.disabled = false;
  }
}

function demoGenerate() {
  // A short demo output so the UI feels alive even without backend.
  const demo = `# Information Security Policy (Demo)

## Policy
This is a demo artefact to illustrate structure. Use “Generate audit-ready policy” for live output.

## Assumptions
- Demo mode does not use your backend or any API keys.

## Scope boundaries
- This does not claim compliance.

## Declared gaps
- Organisation-specific decisions are required (roles, tooling, review cadence).

## ISO/IEC 27001 Traceability Map
| Policy Section | ISO intent area |
|---|---|
| Governance | Leadership |
| Risk management | Planning |
| Incident management | Operations |
`;

  outputEl.value = demo;
  setStatus("Demo output loaded (no backend call).", "ok");
}

copyBtn.addEventListener("click", async () => {
  const text = outputEl.value || "";
  if (!text) return setStatus("Nothing to copy yet.", "error");
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "ok");
  } catch {
    setStatus("Copy failed (browser blocked clipboard).", "error");
  }
});

downloadBtn.addEventListener("click", () => {
  const text = outputEl.value || "";
  if (!text) return setStatus("Nothing to download yet.", "error");
  downloadText("reluguard-policy.md", text);
});

generateBtn.addEventListener("click", callBackend);
demoBtn.addEventListener("click", demoGenerate);

// Theme toggle (light/dark)
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("reluguard_theme", theme);
  themeToggle.textContent = theme === "light" ? "Theme: Light" : "Theme: Dark";
}
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
});

// Initialise theme
const savedTheme = localStorage.getItem("reluguard_theme");
setTheme(savedTheme || "light");
setStatus("", "");
