/* ==========================================================================
   Ahmed & Ghita — interactions
   Modifiez CONFIG pour changer les informations de l'événement.
   ========================================================================== */
const CONFIG = {
  whatsapp: '212661333948',              // numéro de Ghita (format international, sans +)
  timeZone: 'Africa/Casablanca',
  date: { y: 2026, m: 10, d: 31, h: 18, min: 0 },   // samedi 31 octobre 2026, 18h
  durationHours: 6,                      // durée utilisée pour l'agenda (estimation)
  eventTitle: 'Mariage Ahmed & Ghita',
  location: 'Hôtel Hilton Garden Inn Sidi Maarouf, Bd Zoulikha Nasri, Casablanca',
  maxGuests: 10,
};

const $ = (s, root = document) => root.querySelector(s);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------------
   Date helpers — 18h à Casablanca, quel que soit le fuseau de l'invité
   -------------------------------------------------------------------------- */
function zonedToUtc({ y, m, d, h, min }, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess)).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  const asZoned = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asZoned - guess));
}

let EVENT_START;
try { EVENT_START = zonedToUtc(CONFIG.date, CONFIG.timeZone); }
catch { EVENT_START = new Date('2026-10-31T18:00:00+01:00'); }

/* --------------------------------------------------------------------------
   Intro — ouverture de l'enveloppe
   -------------------------------------------------------------------------- */
const intro = $('#intro');
const audio = $('#audio');
const musicBtn = $('#music');
let musicReady = false;   // le fichier audio a été trouvé

function openInvitation() {
  if (!intro || intro.classList.contains('is-opening')) return;
  intro.classList.add('is-opening');
  startMusic();           // le toucher sur « Ouvrir » autorise le son, même sur iPhone

  const t1 = reducedMotion ? 50 : 1750;
  const t2 = reducedMotion ? 120 : 2950;
  setTimeout(() => {
    intro.classList.add('is-opened');
    document.documentElement.classList.add('revealed');
  }, t1);
  setTimeout(() => {
    intro.hidden = true;
    document.documentElement.classList.remove('intro-on');
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    if (musicReady && audio.paused) nudgeMusic();
  }, t2);
}
$('#open-invite')?.addEventListener('click', openInvitation);

// Lien direct vers une section (#rsvp, #invitation…) : on saute l'intro
if (location.hash && location.hash.length > 1 && intro) {
  intro.hidden = true;
  document.documentElement.classList.remove('intro-on');
  document.documentElement.classList.add('revealed');
}

/* --------------------------------------------------------------------------
   Musique — assets/wedding.wav (ou wedding.mp3, plus léger, s'il existe)
   Elle démarre à l'ouverture de l'enveloppe ; le bouton doré la met en pause.
   -------------------------------------------------------------------------- */
const MUSIC_VOLUME = 0.7;

function setPlaying(on) {
  if (!musicBtn) return;
  musicBtn.setAttribute('aria-pressed', String(on));
  musicBtn.setAttribute('aria-label', on ? 'Mettre la musique en pause' : 'Lancer la musique');
}

function revealMusicButton() {
  if (!musicBtn) return;
  musicReady = true;
  musicBtn.hidden = false;
  const hint = $('#intro-hint');
  if (hint) hint.hidden = false;
}

function nudgeMusic() {
  if (!musicBtn || musicBtn.hidden || reducedMotion) return;
  musicBtn.classList.add('is-nudging');
  const bubble = $('#music-bubble');
  if (bubble) {
    bubble.hidden = false;
    setTimeout(() => { bubble.hidden = true; musicBtn.classList.remove('is-nudging'); }, 5200);
  }
}

function startMusic() {
  if (!audio) return;
  try { audio.volume = 0; } catch {}
  const p = audio.play();
  if (!p || !p.then) return;
  p.then(() => {
    revealMusicButton();
    setPlaying(true);
    // fondu d'entrée (ignoré sur iPhone, où le volume suit les boutons du téléphone)
    let v = 0;
    const fade = setInterval(() => {
      v = Math.min(MUSIC_VOLUME, v + 0.05);
      try { audio.volume = v; } catch {}
      if (v >= MUSIC_VOLUME) clearInterval(fade);
    }, 120);
  }).catch(() => setPlaying(false));
}

if (audio && musicBtn) {
  audio.addEventListener('loadedmetadata', revealMusicButton, { once: true });
  audio.addEventListener('playing', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));

  musicBtn.addEventListener('click', () => {
    if (audio.paused) startMusic();
    else audio.pause();
  });

  // Pause quand l'invité quitte l'onglet, reprise à son retour
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) { audio.pause(); audio.dataset.resume = '1'; }
    else if (!document.hidden && audio.dataset.resume) { delete audio.dataset.resume; audio.play().catch(() => {}); }
  });
}

/* --------------------------------------------------------------------------
   Compte à rebours
   -------------------------------------------------------------------------- */
const cdNums = {};
document.querySelectorAll('.countdown__num').forEach((el) => { cdNums[el.dataset.unit] = el; });
const pad = (n) => String(n).padStart(2, '0');

function setNum(el, value) {
  if (!el || el.textContent === value) return;
  el.textContent = value;
  if (!reducedMotion) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
}
function tick() {
  const diff = EVENT_START - Date.now();
  if (diff <= 0) {
    $('#countdown').hidden = true;
    $('#countdown-done').hidden = false;
    return false;
  }
  setNum(cdNums.d, pad(Math.floor(diff / 86400000)));
  setNum(cdNums.h, pad(Math.floor((diff % 86400000) / 3600000)));
  setNum(cdNums.m, pad(Math.floor((diff % 3600000) / 60000)));
  setNum(cdNums.s, pad(Math.floor((diff % 60000) / 1000)));
  return true;
}
if (tick()) {
  const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
}

/* --------------------------------------------------------------------------
   Ajouter à l'agenda (Google Agenda)
   -------------------------------------------------------------------------- */
(function calendarLink() {
  const link = $('#cal-link');
  if (!link) return;
  const fmt = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(EVENT_START.getTime() + CONFIG.durationHours * 3600000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: CONFIG.eventTitle,
    dates: `${fmt(EVENT_START)}/${fmt(end)}`,
    details: 'Réception de mariage — Ahmed & Ghita',
    location: CONFIG.location,
  });
  link.href = `https://calendar.google.com/calendar/render?${params.toString()}`;
})();

/* --------------------------------------------------------------------------
   RSVP — messages WhatsApp personnalisés
   -------------------------------------------------------------------------- */
(function rsvp() {
  const nameInput = $('#guest-name');
  const countOut = $('#guest-count');
  const yes = $('#rsvp-yes');
  const no = $('#rsvp-no');
  const minus = document.querySelector('[data-step="-1"]');
  const plus = document.querySelector('[data-step="1"]');
  if (!yes || !no) return;

  let count = 1;

  const buildYes = (name, n) =>
    `Bonjour Ghita 🌹\n\n${name ? `C'est ${name}. ` : ''}Je confirme avec joie ma présence à votre mariage le samedi 31 octobre 2026` +
    `${n > 1 ? ` (nous serons ${n} personnes)` : ''}.\n\nAu plaisir de célébrer ce beau moment avec vous 🤍✨`;

  const buildNo = (name) =>
    `Bonjour Ghita 🌹\n\n${name ? `C'est ${name}. ` : ''}Merci beaucoup pour votre invitation. ` +
    `Malheureusement, je ne pourrai pas être présent(e) à votre mariage le 31 octobre 2026.\n\nJe vous souhaite tout le bonheur du monde 💛`;

  const wa = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

  function update() {
    const name = (nameInput?.value || '').trim().replace(/\s+/g, ' ');
    yes.href = wa(buildYes(name, count));
    no.href = wa(buildNo(name));
    countOut.textContent = count;
    minus.disabled = count <= 1;
    plus.disabled = count >= CONFIG.maxGuests;
  }

  nameInput?.addEventListener('input', update);
  [minus, plus].forEach((btn) => btn?.addEventListener('click', () => {
    count = Math.min(CONFIG.maxGuests, Math.max(1, count + Number(btn.dataset.step)));
    update();
  }));
  $('#rsvp-form')?.addEventListener('submit', (e) => { e.preventDefault(); yes.click(); });

  update();
})();

/* --------------------------------------------------------------------------
   Bokeh doré (canvas)
   -------------------------------------------------------------------------- */
(function bokeh() {
  const canvas = $('#bokeh');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, particles = [], raf = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function make(initial) {
    const big = Math.random() < 0.35;
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 30,
      r: big ? 6 + Math.random() * 16 : 1 + Math.random() * 2.5,
      vy: -(0.08 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.12,
      a: big ? 0.08 + Math.random() * 0.16 : 0.25 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      big,
    };
  }
  function init() {
    resize();
    const n = w < 600 ? 22 : 36;
    particles = Array.from({ length: n }, () => make(true));
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      if (!reducedMotion) {
        p.y += p.vy; p.x += p.vx + Math.sin(t / 3000 + p.phase) * 0.06;
        if (p.y < -40) Object.assign(p, make(false));
      }
      const tw = p.big ? 1 : 0.55 + 0.45 * Math.sin(t / 700 + p.phase);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(255, 236, 190, ${p.a * tw})`);
      g.addColorStop(0.55, `rgba(222, 180, 108, ${p.a * 0.55 * tw})`);
      g.addColorStop(1, 'rgba(222, 180, 108, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!reducedMotion) raf = requestAnimationFrame(draw);
  }
  init();
  window.addEventListener('resize', () => { resize(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(draw);
  });
  raf = requestAnimationFrame(draw);
})();

/* --------------------------------------------------------------------------
   Animations au défilement (GSAP + ScrollTrigger)
   Sans GSAP, tout reste visible : rien n'est caché par défaut en CSS.
   -------------------------------------------------------------------------- */
(function scrollAnimations() {
  if (!window.gsap || !window.ScrollTrigger || reducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  // Apparitions douces
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, {
      y: 30, autoAlpha: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  // Contenu de l'arche, ligne par ligne
  gsap.from('.arch > *:not(.arch__crest)', {
    y: 16, autoAlpha: 0, duration: .9, ease: 'power2.out', stagger: .12,
    scrollTrigger: { trigger: '.arch', start: 'top 78%', once: true },
  });
  gsap.from('.arch__crest', {
    scale: .4, autoAlpha: 0, duration: 1.2, ease: 'back.out(1.6)', stagger: .3,
    scrollTrigger: { trigger: '.arch', start: 'top 80%', once: true },
  });

  // Léger parallaxe de la couverture
  gsap.to('.hero__img', {
    yPercent: 7, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Tracé de l'itinéraire
  const reveal = document.querySelector('.route__reveal');
  if (reveal && reveal.getTotalLength) {
    const len = reveal.getTotalLength();
    gsap.set(reveal, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(reveal, {
      strokeDashoffset: 0, duration: 2.2, ease: 'power1.inOut',
      scrollTrigger: { trigger: '.route', start: 'top 82%', once: true },
    });
    gsap.from('.route__pin-b', {
      y: -24, autoAlpha: 0, duration: .8, ease: 'bounce.out',
      scrollTrigger: { trigger: '.route', start: 'top 60%', once: true },
    });
  }

  // Chiffres du compte à rebours
  gsap.from('.countdown__cell', {
    y: 20, autoAlpha: 0, duration: .8, ease: 'power2.out', stagger: .1,
    scrollTrigger: { trigger: '.countdown', start: 'top 85%', once: true },
  });
})();
