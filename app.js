const inputText = document.getElementById("inputText");
const file = document.getElementById("file");
const task = document.getElementById("task");
const tone = document.getElementById("tone");
const format = document.getElementById("format");

const generateBtn = document.getElementById("generate");
const demoModeBtn = document.getElementById("demoMode");
const clearBtn = document.getElementById("clear");
const loadSampleBtn = document.getElementById("loadSample");

const output = document.getElementById("output");
const statusEl = document.getElementById("status");
const charsEl = document.getElementById("chars");
const timerEl = document.getElementById("timer");

const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

let useDemoMode = false;

function setStatus(msg, isError=false){
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff6b6b" : "#a9b4c3";
}

function updateChars(){
  charsEl.textContent = `${inputText.value.length.toLocaleString()} chars`;
}
inputText.addEventListener("input", updateChars);
updateChars();

clearBtn.addEventListener("click", () => {
  inputText.value = "";
  output.textContent = "";
  setStatus("");
  updateChars();
});

loadSampleBtn.addEventListener("click", () => {
  inputText.value =
`DORA ICT Risk Management — excerpt (sample)
The entity shall implement ICT risk management policies that define roles, responsibilities, and governance for ICT risks.
The entity shall maintain an inventory of ICT assets and ensure appropriate logging, monitoring, and incident reporting.
The entity shall test and maintain ICT business continuity and disaster recovery measures.`;
  updateChars();
});

demoModeBtn.addEventListener("click", () => {
  useDemoMode = !useDemoMode;
  demoModeBtn.textContent = useDemoMode ? "Demo mode: ON" : "Demo mode";
  setStatus(useDemoMode ? "Demo mode enabled (local fake response)." : "Demo mode disabled.");
});

file.addEventListener("change", async () => {
  const f = file.files?.[0];
  if (!f) return;

  // MVP: only read plain text files reliably on the frontend
  if (!f.name.toLowerCase().endsWith(".txt") && !f.name.toLowerCase().endsWith(".md")) {
    setStatus("For now, only .txt or .md files auto-load. Paste text for PDF/DOCX.", true);
    return;
  }

  const text = await f.text();
  inputText.value = text;
  updateChars();
  setStatus(`Loaded ${f.name}`);
});

copyBtn.addEventListener("click", async () => {
  const txt = output.textContent || "";
  if (!txt) return setStatus("Nothing to copy yet.", true);
  await navigator.clipboard.writeText(txt);
  setStatus("Copied to clipboard ✅");
});

downloadBtn.addEventListener("click", () => {
  const txt = output.textContent || "";
  if (!txt) return setStatus("Nothing to download yet.", true);
  const blob = new Blob([txt], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grc-output.md";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded grc-output.md ✅");
});

function fakeResponse(payload){
  const { task, tone, format, text } = payload;
  const header = format === "markdown"
    ? `# Output\n\n**Task:** ${task}\n\n**Tone:** ${tone}\n\n---\n\n`
    : `OUTPUT\nTask: ${task}\nTone: ${tone}\n\n--------------------------------\n\n`;

  if (task === "gaps"){
    return header + `Key gaps spotted:\n- Roles/responsibilities not clearly assigned (RACI missing)\n- Evidence expectations (logs, approvals, testing) not stated\n- Frequency of reviews/testing not defined\n- Third-party dependencies and exit plans not addressed\n\nSuggested next additions:\n- Define owners for policy, control operation, and assurance\n- Add monitoring + reporting thresholds and timelines\n- Add annual DR test and quarterly tabletop testing cadence\n`;
  }
  if (task === "controls"){
    return header + `Draft control wording (example):\n1) The organisation shall maintain documented ICT risk management policies approved by senior management.\n2) ICT assets shall be inventoried, classified, and assigned an owner; changes shall be controlled.\n3) Security logging shall be enabled for critical systems; logs shall be monitored and retained per defined schedules.\n4) ICT incidents shall be recorded, triaged, and reported per defined timelines and escalation paths.\n5) Business continuity and disaster recovery capabilities shall be tested at defined intervals and remediated.\n`;
  }
  return header + `High-level mapping (example):\n- DORA: ICT Risk Mgmt / Incident Reporting / Resilience Testing / Third-party Risk\n- ISO 27001: A.5 (Org), A.8 (Asset), A.8.15 (Logging), A.5.24–A.5.28 (Incidents), A.5.29 (BC)\n- NIST CSF 2.0: GV (Govern), ID (Identify), PR (Protect), DE (Detect), RS (Respond), RC (Recover)\n\nNote: mapping depends on full scope + your ISMS structure.\n`;
}

async function callBackend(payload){
  // You’ll implement this endpoint later.
  // Expected: POST /api/generate -> { output: "..." }
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`Backend error (${res.status}). ${txt}`);
  }
  const data = await res.json();
  if (!data.output) throw new Error("Backend returned no 'output'.");
  return data.output;
}

generateBtn.addEventListener("click", async () => {
  const text = inputText.value.trim();
  if (text.length < 50) return setStatus("Paste a bit more text (at least ~50 chars).", true);

  const payload = {
    task: task.value,
    tone: tone.value,
    format: format.value,
    text
  };

  output.textContent = "";
  setStatus("Generating…");
  const t0 = performance.now();

  try{
    const result = useDemoMode ? fakeResponse(payload) : await callBackend(payload);
    output.textContent = result;
    const ms = Math.round(performance.now() - t0);
    timerEl.textContent = `${ms} ms`;
    setStatus("Done ✅");
  }catch(err){
    setStatus(err.message || "Something went wrong.", true);
  }
});
