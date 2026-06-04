/* =========================================================
   thepaint.nia — interactions
   Gallery loads live from Supabase when configured,
   and falls back to gallery.js / static cards otherwise.
   ========================================================= */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  /* ---------- first-open cinematic surprise ---------- */
  (() => {
    const root = document.documentElement;
    const intro = document.getElementById("intro");
    if (!intro) return;
    if (!root.classList.contains("show-intro")) { intro.remove(); return; }

    /* ===== EDIT THIS to personalize the message =====================
       Change the name and the lines below to whatever you want to say. */
    const INTRO = {
      pre: "happy birthday",
      name: "Nia",
      lines: [
        "the world deserves to see what you make.",
        "so I made you a little home for it —",
        "all yours. happy birthday, granny 💛",
      ],
    };
    /* ================================================================ */

    const gate = intro.querySelector(".intro-gate");
    const showStage = intro.querySelector(".intro-show");
    const openBtn = intro.querySelector(".intro-open");
    const enterBtn = intro.querySelector(".intro-enter");
    const nameEl = intro.querySelector(".intro-name");
    const preEl = intro.querySelector(".intro-pre");
    const msgEl = intro.querySelector(".intro-message");
    const canvas = intro.querySelector(".intro-confetti");
    const muteBtn = intro.querySelector(".intro-mute");
    const cakeStage = intro.querySelector(".intro-cake");
    const candlesWrap = intro.querySelector("#candles");
    const cakeHint = intro.querySelector("#cake-hint");
    // Roblox "oof" on each teleport. Drop assets/oof.mp3 in for the real sound;
    // until then it falls back to a synthesized comedic blip.
    const oofEl = new Audio("assets/oof.mp3");
    oofEl.preload = "auto";
    oofEl.volume = 0.75;
    let oofBroken = false;
    oofEl.addEventListener("error", () => { oofBroken = true; });

    nameEl.textContent = INTRO.name;
    preEl.textContent = INTRO.pre;

    let audioCtx = null, masterGain = null, muted = false, confettiRAF = null, opened = false;
    let litCount = 0, blownDone = false, micStream = null;
    const MASTER_VOL = 0.16;
    const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

    const finish = () => {
      try { localStorage.setItem("nia_intro_v1", "1"); } catch (e) {}
      intro.classList.add("intro-closing");
      if (confettiRAF) cancelAnimationFrame(confettiRAF);
      if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
      setTimeout(() => { root.classList.remove("show-intro"); intro.remove(); }, 850);
    };

    // the name + message reveal (runs after the candles are blown out)
    const startReveal = () => {
      if (cakeStage) { cakeStage.classList.remove("in"); cakeStage.hidden = true; }
      showStage.hidden = false;
      requestAnimationFrame(() => showStage.classList.add("in"));
      if (!prefersReduced) startConfetti();
      setTimeout(() => vibrate([0, 25, 35, 25]), 200);
      INTRO.lines.forEach((t, i) => {
        const p = document.createElement("p");
        p.className = "intro-line";
        p.textContent = t;
        p.style.animationDelay = (1.2 + i * 0.95) + "s";
        msgEl.appendChild(p);
      });
      const enterDelay = (1.2 + INTRO.lines.length * 0.95 + 0.9) * 1000;
      setTimeout(() => {
        enterBtn.hidden = false;
        requestAnimationFrame(() => enterBtn.classList.add("in"));
      }, enterDelay);
    };

    /* ---- blow out the candles (mic if allowed, tap as fallback) ---- */
    function buildCandles() {
      if (!candlesWrap) { startReveal(); return; }
      const N = 3;
      candlesWrap.innerHTML = "";
      litCount = N;
      for (let i = 0; i < N; i++) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "candle";
        c.setAttribute("aria-label", "candle");
        c.innerHTML = '<span class="flame"></span><span class="smoke"></span><span class="stick"></span>';
        c.addEventListener("click", () => extinguish(c));
        candlesWrap.appendChild(c);
      }
    }
    function extinguish(c) {
      if (!c || c.classList.contains("out")) return;
      c.classList.add("out");
      litCount--;
      vibrate(18);
      if (litCount <= 0 && !blownDone) onBlown();
    }
    function blowOne() {
      const lit = candlesWrap && candlesWrap.querySelector(".candle:not(.out)");
      if (lit) extinguish(lit);
    }
    function onBlown() {
      blownDone = true;
      if (cakeHint) cakeHint.textContent = "✨ make it a good one ✨";
      if (!prefersReduced) startConfetti();
      vibrate([0, 40, 60, 40]);
      stopMic();
      setTimeout(startReveal, 1500);
    }
    function stopMic() {
      if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    }
    function setupBlow() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        micStream = stream;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const mctx = new AC();
        const src = mctx.createMediaStreamSource(stream);
        const an = mctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        const buf = new Float32Array(an.fftSize);
        let frames = 0, cool = 0;
        const loop = () => {
          if (blownDone) { try { mctx.close(); } catch (e) {} return; }
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let k = 0; k < buf.length; k++) sum += buf[k] * buf[k];
          const rms = Math.sqrt(sum / buf.length);
          if (cool > 0) cool--;
          if (rms > 0.14) { frames++; if (frames >= 3 && cool === 0) { blowOne(); cool = 16; frames = 0; } }
          else frames = 0;
          requestAnimationFrame(loop);
        };
        loop();
      }).catch(() => {
        if (cakeHint) cakeHint.innerHTML = "tap the candles to blow them out 🌬️";
      });
    }

    const openGift = () => {
      if (opened) return;
      opened = true;
      openBtn.disabled = true;
      vibrate([0, 45, 60, 45, 90, 30]);
      gate.classList.add("gone");
      if (cakeStage) {
        cakeStage.hidden = false;
        requestAnimationFrame(() => cakeStage.classList.add("in"));
      }
      playMusic();
      if (muteBtn) muteBtn.hidden = false;
      buildCandles();
      setupBlow();
    };

    openBtn.addEventListener("click", openGift);

    // "step inside" runs away a few times, then lets her catch it → opens the montage
    let step = 0, caught = false;
    // each tap runs the next move; "settle" = hops to the centre looking catchable (a lure)
    const MOVES = [
      { label: "nope 😝", settle: false },
      { label: "too slow, granny!", settle: false },
      { label: "ok fine… catch me 🥹", settle: true },
      { label: "SIKE 😜", settle: false },
      { label: "okok for real… catch me 🥹", settle: true, last: true },
    ];
    const dodge = () => {
      playOof();
      const pad = 16;
      const r = enterBtn.getBoundingClientRect();
      const bw = r.width, bh = r.height;
      if (enterBtn.style.position !== "fixed") {
        enterBtn.style.margin = "0";
        enterBtn.style.position = "fixed";
        enterBtn.style.left = r.left + "px";
        enterBtn.style.top = r.top + "px";
        void enterBtn.offsetWidth; // reflow so the first move glides too
      }
      const m = MOVES[Math.min(step, MOVES.length - 1)];
      enterBtn.textContent = m.label;
      if (m.settle) {
        enterBtn.classList.add("caught");
        enterBtn.style.left = Math.max(pad, (window.innerWidth - bw) / 2) + "px";
        enterBtn.style.top = window.innerHeight * 0.6 + "px";
      } else {
        enterBtn.classList.remove("caught");
        enterBtn.style.left = pad + Math.random() * Math.max(1, window.innerWidth - bw - pad * 2) + "px";
        enterBtn.style.top = window.innerHeight * 0.22 + Math.random() * Math.max(1, window.innerHeight * 0.5 - bh) + "px";
      }
      if (m.last) caught = true; // the next tap finally reveals the site
      step++;
    };
    if (prefersReduced) {
      enterBtn.addEventListener("click", finish);
    } else {
      // click fires reliably on every device; dodge until caught, then reveal
      enterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (caught) { finish(); return; }
        dodge();
      });
    }

    if (muteBtn) muteBtn.addEventListener("click", () => {
      muted = !muted;
      muteBtn.classList.toggle("muted", muted);
      if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, audioCtx.currentTime, 0.02);
    });
    // safety: Esc closes
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("show-intro")) finish(); });

    /* ---- soft K-ballad style melody (original, royal-road progression) ---- */
    const A4 = 440;
    const STEP = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
    const freq = (n) => {
      const name = n.slice(0, -1), oct = +n.slice(-1);
      const midi = (oct + 1) * 12 + STEP[name];
      return A4 * Math.pow(2, (midi - 69) / 12);
    };
    function note(f, start, dur, vol, type) {
      const o = audioCtx.createOscillator(); o.type = type || "triangle"; o.frequency.value = f;
      const h = audioCtx.createOscillator(); h.type = "sine"; h.frequency.value = f * 2;
      const g = audioCtx.createGain(), hg = audioCtx.createGain(); hg.gain.value = 0.22;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, start + dur);
      o.connect(g); h.connect(hg); hg.connect(g); g.connect(masterGain);
      o.start(start); h.start(start); o.stop(start + dur + 0.12); h.stop(start + dur + 0.12);
    }
    function playMusic() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (audioCtx) { try { audioCtx.close(); } catch (e2) {} }
        audioCtx = new AC();
        if (audioCtx.state === "suspended") audioCtx.resume();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = muted ? 0 : MASTER_VOL;
        masterGain.connect(audioCtx.destination);
        // IVmaj7 - V7 - iiim7 - vim7 (the dreamy K-ballad / OST progression)
        const prog = [
          { bass: "F2", notes: ["F4", "A4", "C5", "E5"] },
          { bass: "G2", notes: ["G4", "B4", "D5", "F5"] },
          { bass: "E2", notes: ["E4", "G4", "B4", "D5"] },
          { bass: "A2", notes: ["A4", "C5", "E5", "G5"] },
        ];
        const beat = 0.5, chordBeats = 4, loops = 4;
        const arp = [0, 1, 2, 3, 2, 1, 0, 1];
        let t = audioCtx.currentTime + 0.12;
        for (let L = 0; L < loops; L++) {
          prog.forEach((ch) => {
            note(freq(ch.bass), t, chordBeats * beat * 0.96, 0.5, "sine");
            arp.forEach((idx, k) => note(freq(ch.notes[idx]), t + k * (beat / 2), beat * 0.95, 0.3, "triangle"));
            t += chordBeats * beat;
          });
        }
      } catch (e) {}
    }

    /* ---- confetti ---- */
    function startConfetti() {
      const ctx = canvas.getContext && canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      resize();
      window.addEventListener("resize", resize, { once: true });
      const W = innerWidth, H = innerHeight;
      const colors = ["#f38eb2", "#ffbe73", "#e7b53c", "#fff3c4", "#afd8d1", "#cbe8ef", "#ddd5ff", "#ffffff"];
      const pieces = [];
      const wave = (cx, cy, n, power) => {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = Math.random() * power + 4;
          pieces.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, size: 5 + Math.random() * 8, color: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, shape: Math.random() > 0.5 ? "rect" : "circ" });
        }
      };
      wave(W / 2, H * 0.46, 170, 13);
      setTimeout(() => wave(W * 0.18, H * 0.62, 80, 12), 650);
      setTimeout(() => wave(W * 0.82, H * 0.62, 80, 12), 1050);
      const start = performance.now();
      const frame = (now) => {
        const el = now - start;
        ctx.clearRect(0, 0, W, H);
        pieces.forEach((p) => {
          p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = clamp(1 - el / 5800, 0, 1); ctx.fillStyle = p.color;
          if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); }
          ctx.restore();
        });
        if (el < 6000 && root.classList.contains("show-intro")) confettiRAF = requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, W, H);
      };
      confettiRAF = requestAnimationFrame(frame);
    }

    /* ---- "oof" sound (real file if present, else a synth blip) ---- */
    function playOof() {
      if (!oofBroken) {
        try {
          oofEl.currentTime = 0;
          const p = oofEl.play();
          if (p && p.catch) p.catch(() => synthOof());
          return;
        } catch (e) {}
      }
      synthOof();
    }
    function synthOof() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = audioCtx && audioCtx.state !== "closed" ? audioCtx : new AC();
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(250, t);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.26);
      } catch (e) {}
    }
  })();

  /* ---------- cloud client (optional) ---------- */
  const cfg = window.NIA_CONFIG || {};
  const cloudReady = !!(
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey &&
    !/YOUR-PROJECT|YOUR-ANON/.test(cfg.supabaseUrl + cfg.supabaseAnonKey) &&
    window.supabase
  );
  let supa = null;
  try { if (cloudReady) supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); } catch (e) {}

  const normalize = (p) => ({
    title: p.title || "Untitled",
    medium: p.medium || "",
    description: p.description || "",
    image: p.image_url || p.image || "",
    price: p.price || "",
    status: p.status === "sold" ? "sold" : "available",
    section: p.section === "sketchbook" ? "sketchbook" : "collection"
  });

  /* ---------- card builder ---------- */
  const ZOOM = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>';

  function makeCard(piece, kind) {
    const isSketch = kind === "sketchbook";
    const article = document.createElement("article");
    article.className = isSketch ? "sketchbook-card" : "product-card";
    if (piece.status === "sold") article.classList.add("is-sold");
    article.setAttribute("data-reveal", "");
    article.setAttribute("data-tilt", "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-trigger";
    btn.setAttribute("data-lightbox", "");
    btn.dataset.src = piece.image || "";
    btn.dataset.title = piece.title || "";
    btn.dataset.medium = piece.medium || "";
    btn.dataset.desc = piece.description || "";
    btn.setAttribute("aria-label", "View " + (piece.title || "artwork") + " full size");

    const img = document.createElement("img");
    img.className = "art-image " + (isSketch ? "sketchbook-image" : "gallery-image");
    img.src = piece.image || "";
    img.alt = (piece.title ? piece.title + " — " : "") + "artwork by thepaint.nia";
    img.loading = "lazy";

    const zoom = document.createElement("span");
    zoom.className = "art-zoom";
    zoom.setAttribute("aria-hidden", "true");
    zoom.innerHTML = ZOOM;

    btn.append(img, zoom);

    if (piece.status === "sold") {
      const badge = document.createElement("span");
      badge.className = "sold-badge";
      badge.textContent = "Sold";
      btn.appendChild(badge);
    }

    const copy = document.createElement("div");
    copy.className = "product-copy";
    const h3 = document.createElement("h3");
    h3.textContent = piece.title || "Untitled";
    copy.appendChild(h3);
    if (piece.description) {
      const p = document.createElement("p");
      p.textContent = piece.description;
      copy.appendChild(p);
    }
    const meta = document.createElement("div");
    meta.className = "piece-meta";
    if (piece.medium) {
      const strong = document.createElement("strong");
      strong.textContent = piece.medium;
      meta.appendChild(strong);
    }
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = piece.status === "sold" ? "Sold" : (piece.price ? piece.price : "Enquire");
    meta.appendChild(price);
    copy.appendChild(meta);

    article.append(btn, copy);
    return article;
  }

  /* ---------- scroll reveal (re-usable for dynamic cards) ---------- */
  let revealObserver = null;
  function ensureObserver() {
    if (revealObserver || prefersReduced || !("IntersectionObserver" in window)) return;
    revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
          entry.target.style.setProperty("--reveal-delay", Math.min(i, 6) * 80 + "ms");
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -40px 0px" }
    );
  }
  function observeReveals(root = document) {
    const nodes = $$("[data-reveal]", root).filter((n) => !n.dataset.obs);
    if (prefersReduced || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => { n.classList.add("is-visible"); n.dataset.obs = "1"; });
      return;
    }
    ensureObserver();
    nodes.forEach((n) => { n.dataset.obs = "1"; revealObserver.observe(n); });
  }

  /* ---------- 3D tilt (re-usable for dynamic cards) ---------- */
  function applyTilt(root = document) {
    if (prefersReduced || !finePointer) return;
    $$("[data-tilt]", root).filter((c) => !c.dataset.tilted).forEach((card) => {
      card.dataset.tilted = "1";
      const isHero = card.classList.contains("main-painting");
      let raf = null, rx = 0, ry = 0;
      const render = () => {
        raf = null;
        const base = isHero ? "rotate(2deg) " : "";
        card.style.transform = base + "perspective(800px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
      };
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
        rx = -((e.clientY - r.top) / r.height - 0.5) * 10;
        if (!raf) raf = requestAnimationFrame(render);
      });
      card.addEventListener("pointerleave", () => {
        if (raf) cancelAnimationFrame(raf), (raf = null);
        card.style.transform = isHero ? "rotate(2deg)" : "";
      });
    });
  }

  /* ---------- render gallery from a list of pieces ---------- */
  function renderGallery(pieces, animate) {
    const fill = (grid, kind) => {
      if (!grid) return 0;
      const items = pieces.filter((p) => (p.section || "collection") === kind);
      grid.innerHTML = "";
      items.forEach((p) => grid.appendChild(makeCard(p, kind)));
      return items.length;
    };
    fill($(".collection-grid"), "collection");
    const sketchCount = fill($(".sketchbook-grid"), "sketchbook");
    const sketchSection = $("#sketchbook");
    if (sketchSection) sketchSection.hidden = sketchCount === 0;

    if (animate) {
      observeReveals();
    } else {
      $$(".collection-grid [data-reveal], .sketchbook-grid [data-reveal]").forEach((n) => {
        n.classList.add("is-visible");
        n.dataset.obs = "1";
      });
    }
    applyTilt();
  }

  /* ---------- boot the gallery ---------- */
  // 1) observe + tilt whatever is already in the page (hero, sections, static cards)
  observeReveals();
  applyTilt();
  // 2) instant render from the offline list (gallery.js) so there is never a blank
  if (Array.isArray(window.NIA_GALLERY) && window.NIA_GALLERY.length) {
    renderGallery(window.NIA_GALLERY.map(normalize), true);
  }
  // 3) live render from the cloud if it's set up
  (async () => {
    if (!supa) return;
    try {
      const { data, error } = await supa
        .from("pieces")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (Array.isArray(data)) renderGallery(data.map(normalize), false);
    } catch (e) {
      /* cloud unreachable → keep the offline fallback */
    }
  })();

  /* ---------- sticky nav shadow ---------- */
  (() => {
    const nav = $(".site-nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  })();

  /* ---------- parallax (scroll + pointer) ---------- */
  (() => {
    if (prefersReduced) return;
    const items = $$("[data-parallax]");
    if (!items.length) return;
    let mx = 0, my = 0, sy = 0, raf = null;
    const apply = () => {
      raf = null;
      items.forEach((el) => {
        const f = (parseFloat(el.dataset.parallax) || 12) / 30;
        el.style.transform = "translate3d(" + mx * f * 0.6 + "px, " + (sy * -f + my * f * 0.6) + "px, 0)";
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const hero = $(".hero");
    if (hero && finePointer) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width - 0.5) * 24;
        my = ((e.clientY - r.top) / r.height - 0.5) * 24;
        schedule();
      });
      hero.addEventListener("pointerleave", () => { mx = 0; my = 0; schedule(); });
    }
    window.addEventListener("scroll", () => {
      const h = $(".hero");
      if (!h) return;
      const rect = h.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) { sy = window.scrollY * 0.06; schedule(); }
    }, { passive: true });
  })();

  /* ---------- magnetic buttons ---------- */
  (() => {
    if (prefersReduced || !finePointer) return;
    $$("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.3 + "px, " + (e.clientY - r.top - r.height / 2) * 0.4 + "px)";
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  })();

  /* ---------- ambient sparkles + petals ---------- */
  (() => {
    if (prefersReduced) return;
    const layer = $(".ambient-layer");
    if (!layer) return;
    const SPARK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0l2.2 8.4L22 11l-7.8 2.6L12 22l-2.2-8.4L2 11l7.8-2.6z"/></svg>';
    const PETAL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C7 7 7 14 12 22 17 14 17 7 12 2z"/></svg>';
    const count = window.innerWidth < 720 ? 9 : 16;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      const isPetal = i % 3 === 0;
      s.className = "spark" + (isPetal ? " petal" : "");
      s.innerHTML = isPetal ? PETAL : SPARK;
      const dur = 14 + Math.random() * 16;
      s.style.left = Math.random() * 100 + "vw";
      s.style.fontSize = (0.6 + Math.random() * 1.1) + "rem";
      s.style.animationDuration = dur + "s";
      s.style.animationDelay = -Math.random() * dur + "s";
      s.style.setProperty("--drift", (Math.random() * 120 - 60) + "px");
      s.style.setProperty("--peak", (0.35 + Math.random() * 0.5).toFixed(2));
      layer.appendChild(s);
    }
  })();

  /* ---------- lightbox gallery (event-delegated for dynamic cards) ---------- */
  (() => {
    const lb = $("#lightbox");
    if (!lb) return;
    const img = $(".lb-image", lb);
    const titleEl = $(".lb-title", lb);
    const mediumEl = $(".lb-medium", lb);
    const descEl = $(".lb-desc", lb);
    const closeBtn = $(".lb-close", lb);
    const prevBtn = $(".lb-prev", lb);
    const nextBtn = $(".lb-next", lb);
    const cta = $(".lb-cta", lb);
    let triggers = [], index = 0, lastFocus = null;

    const render = () => {
      const t = triggers[index];
      if (!t) return;
      img.src = t.dataset.src;
      img.alt = t.dataset.title || "Artwork";
      titleEl.textContent = t.dataset.title || "";
      mediumEl.textContent = t.dataset.medium || "";
      descEl.textContent = t.dataset.desc || "";
    };
    const open = (t) => {
      triggers = $$("[data-lightbox]");
      index = triggers.indexOf(t);
      if (index < 0) index = 0;
      lastFocus = document.activeElement;
      render();
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add("is-open"));
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    };
    const close = () => {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      const done = () => { lb.hidden = true; lb.removeEventListener("transitionend", done); if (lastFocus) lastFocus.focus(); };
      lb.addEventListener("transitionend", done);
    };
    const step = (d) => {
      if (!triggers.length) return;
      index = (index + d + triggers.length) % triggers.length;
      img.style.opacity = "0";
      setTimeout(() => { render(); img.style.opacity = "1"; }, 130);
    };

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-lightbox]");
      if (t) { e.preventDefault(); open(t); }
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));
    cta.addEventListener("click", close);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
    img.style.transition = "opacity 130ms ease";
  })();

  /* ---------- contact form ---------- */
  (() => {
    const form = $(".contact-form");
    if (!form) return;
    const hint = $(".form-hint", form);
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[name="email"]');
      if (email && !email.checkValidity()) {
        if (hint) hint.textContent = "Please add a valid email so I can reply 💌";
        email.focus();
        return;
      }
      if (!button) return;
      const original = button.textContent;
      button.textContent = "Sent — thank you!";
      button.disabled = true;
      if (hint) hint.textContent = "Got it! For the fastest reply, DM @thepaint.nia on Instagram too.";
      form.reset();
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 2600);
    });
  })();

  /* ---------- birthday surprise + confetti ---------- */
  (() => {
    const surprise = $("#surprise");
    if (!surprise) return;
    const canvas = $(".confetti-canvas", surprise);
    const closeBtn = $(".surprise-close", surprise);
    const triggers = $$("[data-surprise]");
    let lastFocus = null, confettiRAF = null;

    const open = () => {
      lastFocus = document.activeElement;
      surprise.hidden = false;
      requestAnimationFrame(() => surprise.classList.add("is-open"));
      if (closeBtn) closeBtn.focus();
      if (!prefersReduced) burst();
    };
    const close = () => {
      surprise.classList.remove("is-open");
      if (confettiRAF) cancelAnimationFrame(confettiRAF), (confettiRAF = null);
      const done = () => { surprise.hidden = true; surprise.removeEventListener("transitionend", done); if (lastFocus) lastFocus.focus(); };
      surprise.addEventListener("transitionend", done);
    };

    triggers.forEach((t) => t.addEventListener("click", open));
    if (closeBtn) closeBtn.addEventListener("click", close);
    surprise.addEventListener("click", (e) => { if (e.target === surprise) close(); });
    document.addEventListener("keydown", (e) => { if (!surprise.hidden && e.key === "Escape") close(); });

    let buffer = "";
    document.addEventListener("keydown", (e) => {
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-3);
      if (buffer === "nia" && surprise.hidden) open();
    });

    function burst() {
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      resize();
      const colors = ["#f38eb2", "#ffbe73", "#e7b53c", "#afd8d1", "#cbe8ef", "#ddd5ff", "#fff3c4"];
      const W = window.innerWidth, H = window.innerHeight;
      const pieces = Array.from({ length: 150 }, () => ({
        x: W / 2 + (Math.random() - 0.5) * 80, y: H / 2 - 40,
        vx: (Math.random() - 0.5) * 11, vy: Math.random() * -13 - 4,
        size: 5 + Math.random() * 7, color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.5 ? "rect" : "circle"
      }));
      const start = performance.now();
      const frame = (now) => {
        const elapsed = now - start;
        ctx.clearRect(0, 0, W, H);
        pieces.forEach((p) => {
          p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = clamp(1 - elapsed / 3200, 0, 1); ctx.fillStyle = p.color;
          if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        });
        if (elapsed < 3400 && !surprise.hidden) confettiRAF = requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, W, H);
      };
      window.addEventListener("resize", resize, { once: true });
      confettiRAF = requestAnimationFrame(frame);
    }
  })();
})();
