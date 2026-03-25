/* ═══════════════════════════════════════════════════════════════════════════
   AI Vision Dashboard — app.js  (Premium Edition)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Theme State ───────────────────────────────────────────────────────────────
let themeCache = { r1: 79, g1: 142, b1: 247, r2: 61, g2: 217, b2: 164 };
let currentThemeIndex = 0;
const themes = ["", "sunset", "cyberpunk", "emerald", "batman", "witcher"];

let lastFrameTime = 0;
let frameCount    = 0;
let currentFPS    = 0;

function updateThemeCache() {
  const rs = getComputedStyle(document.documentElement);
  // Parse variables or default to standard theme colours
  themeCache.r1 = parseInt(rs.getPropertyValue('--accent-r').trim()) || 79;
  themeCache.g1 = parseInt(rs.getPropertyValue('--accent-g').trim()) || 142;
  themeCache.b1 = parseInt(rs.getPropertyValue('--accent-b').trim()) || 247;
  
  themeCache.r2 = parseInt(rs.getPropertyValue('--accent2-r').trim()) || 61;
  themeCache.g2 = parseInt(rs.getPropertyValue('--accent2-g').trim()) || 217;
  themeCache.b2 = parseInt(rs.getPropertyValue('--accent2-b').trim()) || 164;
}
// Initial fetch after CSS load
setTimeout(updateThemeCache, 50);

// ── Combined Background Graphics ──────────────────────────────────────────────
(function initBackground() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H;
  let particles = [];
  
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    
    particles = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.4,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.5 + 0.15,
      });
    }
  }
  resize();
  window.addEventListener("resize", resize);

  let time = 0;

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);

    // 1. Aesthetics Topographic lines
    const lineCount = 28;
    for (let i = 0; i < lineCount; i++) {
      ctx.beginPath();
      let startY = -100 + (i * ((H + 200) / lineCount));
      ctx.moveTo(-100, startY);

      let p = i / lineCount;
      let r = Math.round(themeCache.r1 * (1 - p) + themeCache.r2 * p);
      let g = Math.round(themeCache.g1 * (1 - p) + themeCache.g2 * p);
      let b = Math.round(themeCache.b1 * (1 - p) + themeCache.b2 * p);

      for (let x = -100; x <= W + 100; x += 30) {
        let nx = x / 400;
        let wave1 = Math.sin(nx * 1.5 + time * 0.3 + i * 0.15) * 45;
        let wave2 = Math.cos(nx * 2.8 - time * 0.4 + i * 0.08) * 30;
        let wave3 = Math.sin(nx * 0.8 + time * 0.2 + i * 0.25) * 70;
        ctx.lineTo(x, startY + wave1 + wave2 + wave3);
      }
      
      let alpha = 0.15 + (Math.sin(p * Math.PI) * 0.40); // Massively increased visibility
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1.5 + (Math.sin(p * Math.PI) * 2.5);
      ctx.stroke();
    }
    
    // 2. Original Particle Network
    const pColor = `${themeCache.r1},${themeCache.g1},${themeCache.b1}`;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${pColor}, ${0.08 * (1 - dist / 140)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pColor}, ${p.alpha})`;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });

    time += 0.007;
    requestAnimationFrame(drawBackground);
  }
  
  drawBackground();
})();

// ── State ─────────────────────────────────────────────────────────────────────
let currentMode       = "face";
let currentConfidence = 0.4;
let downloadFilename  = "";
let wsConnection      = null;
let webcamStream      = null;
let isDetecting       = false;
let allClasses        = [];

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Landing Page Logic ────────────────────────────────────────────────────────
const enterBtn    = $("enter-btn");
const landingPage = $("landing-page");
const dashboardUI = $("dashboard-ui");

if (enterBtn && landingPage && dashboardUI) {
  enterBtn.addEventListener("click", () => {
    // 1. Fade out landing
    landingPage.classList.add("hidden");

    // 2. After transition, remove from flow and show dashboard
    setTimeout(() => {
      landingPage.style.display = "none";
      dashboardUI.style.opacity = "1";
      dashboardUI.style.pointerEvents = "auto";
    }, 950);
  });
}

// ── Theme Dropdown ────────────────────────────────────────────────────────────
const themeBtn = $("theme-btn");
const themeMenu = $("theme-menu");
if (themeBtn && themeMenu) {
  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themeMenu.classList.toggle("show");
  });

  document.querySelectorAll(".theme-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".theme-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      
      const themeVal = opt.getAttribute("data-theme-val");
      if (themeVal) {
        document.documentElement.setAttribute("data-theme", themeVal);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      updateThemeCache();
      showNotif(`Theme set to: ${opt.textContent}`, "info");
      themeMenu.classList.remove("show");
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".theme-dropdown-wrap")) {
      themeMenu.classList.remove("show");
    }
  });
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    const tab = item.dataset.tab;

    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.remove("active");
      n.removeAttribute("aria-current");
    });
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

    item.classList.add("active");
    item.setAttribute("aria-current", "page");
    $(`tab-${tab}`).classList.add("active");

    const meta = {
      upload:  ["Neural Visual Analysis",  "Execute advanced object mapping and facial recognition pipelines"],
      webcam:  ["Real-time Processing",    "Awaiting continuous camera stream initialization"],
      classes: ["Recognition Index",       "System taxonomy and dynamically loaded neural classes"],
    };
    $("page-title").textContent = meta[tab][0];
    $("page-sub").textContent   = meta[tab][1];

    if (tab === "classes") loadClasses();
    if (tab !== "webcam")  stopWebcam();
  });
});

// ── Mode Toggle ───────────────────────────────────────────────────────────────
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    currentMode = btn.dataset.mode;
    $("conf-wrap").style.display = currentMode === "object" ? "flex" : "none";
  });
});

// ── Confidence Slider ─────────────────────────────────────────────────────────
$("conf-slider").addEventListener("input", e => {
  currentConfidence = parseInt(e.target.value) / 100;
  $("conf-val").textContent = `${e.target.value}%`;
});

// ── Keyboard accessibility for drop zone ─────────────────────────────────────
const dropZoneEl = $("drop-zone");
dropZoneEl.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("file-input").click();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  IMAGE UPLOAD
// ══════════════════════════════════════════════════════════════════════════════

const dropZone  = $("drop-zone");
const fileInput = $("file-input");

// Click on card to open file picker
dropZone.addEventListener("click", e => {
  if (e.target.tagName !== "LABEL" && e.target.tagName !== "INPUT")
    fileInput.click();
});

fileInput.addEventListener("change", e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag-and-drop
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

async function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showNotif("Please upload a valid image file.", "error");
    return;
  }

  // Show original preview immediately
  const reader = new FileReader();
  reader.onload = e => { $("original-img").src = e.target.result; };
  reader.readAsDataURL(file);

  $("result-section").style.display = "none";
  $("stats-section").style.display  = "none";
  $("loader").style.display         = "flex";

  const form = new FormData();
  form.append("file", file);
  form.append("mode", currentMode);
  form.append("confidence", currentConfidence);

  try {
    const res  = await fetch("/api/detect/image", { method: "POST", body: form });
    const data = await res.json();

    if (data.error) { showNotif(data.error, "error"); $("loader").style.display = "none"; return; }

    // Bust cache on result image
    $("result-img").src = data.result_url + "?t=" + Date.now();
    downloadFilename    = data.download_name;

    // Stats
    animateCounter($("stat-count"), data.count);
    $("stat-label").textContent = currentMode === "face"
      ? `Face${data.count !== 1 ? "s" : ""} Found`
      : `Object${data.count !== 1 ? "s" : ""} Found`;

    renderDetList($("detection-list"), data.detections);

    if (data.warning) showNotif(data.warning, "warn");

    $("loader").style.display         = "none";
    $("result-section").style.display = "grid";
    $("stats-section").style.display  = "grid";

    showNotif(`✓ ${data.count} detection${data.count !== 1 ? "s" : ""} complete!`, "success");

  } catch (err) {
    $("loader").style.display = "none";
    showNotif("Detection failed — is the server running?", "error");
  }
}

// Counter animation
function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  const dur = 600;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// Download
$("download-btn").addEventListener("click", () => {
  if (downloadFilename)
    window.open(`/api/download/${downloadFilename}`, "_blank");
});

// ══════════════════════════════════════════════════════════════════════════════
//  LIVE WEBCAM
// ══════════════════════════════════════════════════════════════════════════════

const video  = $("webcam-video");
const canvas = $("webcam-canvas");
const ctx    = canvas.getContext("2d");

$("start-btn").addEventListener("click", startWebcam);
$("stop-btn").addEventListener("click", stopWebcam);

async function startWebcam() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = webcamStream;
    await video.play();

    video.onloadedmetadata = () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      $("cam-placeholder").style.display = "none";
    };

    const proto  = location.protocol === "https:" ? "wss" : "ws";
    wsConnection = new WebSocket(`${proto}://${location.host}/ws/webcam`);

    wsConnection.onopen = () => {
      isDetecting = true;
      $("start-btn").style.display  = "none";
      $("stop-btn").style.display   = "flex";
      $("live-pill").style.display  = "inline-flex";
      sendFrame();
    };

    wsConnection.onmessage = e => {
      const data = JSON.parse(e.data);

      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = "data:image/jpeg;base64," + data.frame;

      $("live-count").textContent = data.count;
      renderDetList($("live-det-list"), data.detections);

      if (isDetecting) sendFrame();
    };

    wsConnection.onerror = () => {
      showNotif("WebSocket error — reconnecting…", "warn");
      stopWebcam();
    };

  } catch {
    showNotif("Camera access denied or not available.", "error");
  }
}

function sendFrame() {
  if (!isDetecting || !wsConnection || wsConnection.readyState !== WebSocket.OPEN) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  wsConnection.send(JSON.stringify({
    mode:       currentMode,
    confidence: currentConfidence,
    frame:      canvas.toDataURL("image/jpeg", 0.75),
  }));
}

function stopWebcam() {
  isDetecting = false;
  wsConnection?.close(); wsConnection = null;
  webcamStream?.getTracks().forEach(t => t.stop()); webcamStream = null;

  $("start-btn").style.display  = "flex";
  $("stop-btn").style.display   = "none";
  $("live-pill").style.display  = "none";
  $("live-count").textContent   = "0";
  $("live-det-list").innerHTML  = "";
  $("cam-placeholder").style.display = "flex";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ══════════════════════════════════════════════════════════════════════════════
//  CLASS LIBRARY
// ══════════════════════════════════════════════════════════════════════════════

async function loadClasses() {
  if (allClasses.length > 0) return;

  try {
    const res  = await fetch("/api/classes");
    const data = await res.json();
    allClasses = data.classes;

    $("class-count-badge").textContent = `${data.count} classes`;
    renderClassGrid(allClasses);
  } catch {
    $("class-grid").innerHTML = `<p class="muted">Failed to load classes.</p>`;
  }
}

function renderClassGrid(classes) {
  const grid = $("class-grid");
  grid.innerHTML = classes.map((c, i) =>
    `<span class="class-chip" data-index="${i}" style="animation-delay:${i * 10}ms">${c}</span>`
  ).join("");
}

$("class-search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll(".class-chip").forEach(chip => {
    chip.classList.toggle("hidden", !chip.textContent.toLowerCase().includes(q));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function renderDetList(container, detections) {
  if (!detections || detections.length === 0) {
    container.innerHTML = `<p class="muted" style="padding:6px 0;">No detections found</p>`;
    return;
  }
  container.innerHTML = detections.map((d, i) => `
    <div class="det-item" style="animation-delay:${i * 40}ms">
      <span class="det-label">${d.label}</span>
      ${d.confidence != null
        ? `<span class="det-conf">${(d.confidence * 100).toFixed(0)}%</span>`
        : ""}
    </div>
  `).join("");
}

let toastQueue = 0;
function showNotif(msg, type = "info") {
  const colors = {
    error:   { bg: "#f75858", rgb: "247,88,88" },
    warn:    { bg: "#f7c94f", rgb: "247,201,79" },
    success: { bg: "#3dd9a4", rgb: "61,217,164" },
    info:    { bg: "#4f8ef7", rgb: "79,142,247" },
  };
  const { bg, rgb } = colors[type] || colors.info;

  const icons = {
    error:   "fa-circle-xmark",
    warn:    "fa-triangle-exclamation",
    success: "fa-circle-check",
    info:    "fa-circle-info",
  };

  const n = document.createElement("div");
  n.className = "notif-toast";
  n.style.cssText = `
    background: rgba(${rgb},0.12);
    border: 1px solid rgba(${rgb},0.35);
    color: ${bg};
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(${rgb},0.15);
    top: ${24 + toastQueue * 64}px;
  `;
  n.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" style="font-size:1.05rem;"></i> ${msg}`;
  document.body.appendChild(n);
  toastQueue++;
  setTimeout(() => { n.remove(); toastQueue = Math.max(0, toastQueue - 1); }, 4000);
}
