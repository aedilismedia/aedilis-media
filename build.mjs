// Aedilis Media: statik site üreticisi.
// data/*.json + content/journal/*.md  ->  dist/ (düz HTML, CSS, JS)
// Kullanım: npm run build   |   npm run dev (derle + http://localhost:4173)

import { readFile, writeFile, mkdir, cp, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const readJSON = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));

// ---------- yardımcılar ----------
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function formatDate(iso) {
  if (!iso) return '';
  if (/^\d{4}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const yearOf = (iso) => String(iso || '').slice(0, 4);

const isExternal = (h) => /^(https?:|mailto:|tel:)/.test(h);

// Sayfa derinliğine göre göreli yol öneki: kök "", /gunluk/x/ -> "../../"
const absUrl = (p) => (/^https?:\/\//.test(p) ? p : new URL(p, site.url.replace(/\/?$/, '/')).href);
const relPrefix = (depth) => '../'.repeat(depth);

function makeUrl(depth) {
  const rel = relPrefix(depth);
  return (href) => {
    if (!href) return '#';
    if (isExternal(href)) return href;
    if (href.startsWith('#')) return depth === 0 ? href : `${rel || './'}${href}`;
    return `${rel}${href}`;
  };
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^-?\d+$/.test(val)) val = Number(val);
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

// ---------- veri ----------
const site = await readJSON('data/site.json');
const divisions = await readJSON('data/divisions.json');
const releases = (await readJSON('data/releases.json')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const videosData = await readJSON('data/videos.json');
const dzs = await readJSON('data/dzs.json');
const dn = await readJSON('data/dn.json');
// Proje adı artık DZS: metinlerde eski ad (ve ek alan hali) kısaltmayla değişir
const dzsShort = (t) => t.replace(/Dördüncü Zamdan Sonra'nın/g, `${dzs.shortName}'nin`).replace(/Dördüncü Zamdan Sonra/g, dzs.shortName);
const hub = await readJSON('data/hub.json');
const basePath = site.basePath || '/';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

async function loadJournal() {
  const dir = path.join(ROOT, 'content/journal');
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const f of files) {
    const { meta, body } = parseFrontmatter(await readFile(path.join(dir, f), 'utf8'));
    if (meta.draft === true) continue;
    const slug = meta.slug || f.replace(/\.md$/, '');
    let html = body ? await marked.parse(body) : '';
    html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" rel="noopener"');
    posts.push({ slug, ...meta, body, html });
  }
  return posts.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(b.date || '').localeCompare(String(a.date || '')));
}
const journal = await loadJournal();

// ---------- parçalar ----------
const PLATFORMS = [
  ['spotify', 'Spotify'],
  ['apple', 'Apple Music'],
  ['youtube', 'YouTube Music'],
  ['deezer', 'Deezer'],
];

function head({ title, description, canonicalPath, depth, ogImage, jsonLd, noindex }) {
  const rel = relPrefix(depth);
  const canonical = new URL(canonicalPath, site.url.replace(/\/?$/, '/')).href;
  const og = absUrl(ogImage || site.ogImage || site.logo);
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0A0A0A">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${esc(/^https?:/.test(site.logo) ? site.logo : rel + site.logo)}">
<link rel="preload" href="${rel}assets/fonts/cinzel-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/montserrat-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/css/fonts.css">
<link rel="stylesheet" href="${rel}assets/css/style.css">
<script>document.documentElement.classList.add('js')</script>
<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "0e50802e58b840188c1caa488af6b975"}'></script><!-- End Cloudflare Web Analytics -->
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}

function header(depth) {
  const url = makeUrl(depth);
  const home = depth === 0 ? './' : relPrefix(depth);
  const links = site.nav
    .map((n) => `<a href="${esc(url(n.href))}"${n.cta ? ' class="nav-cta"' : ''}>${esc(n.label)}</a>`)
    .join('');
  return `<a class="skip-link" href="#icerik">İçeriğe geç</a>
<header class="topbar">
  <a class="brand" href="${home}" aria-label="${esc(site.name)} ana sayfa">
    <img class="brand-mark" src="${esc(url(site.logo))}" alt="" width="36" height="36" onerror="this.remove()">
    <span class="brand-name">AEDILIS MEDIA</span>
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="ana-menu">Menü</button>
  <nav id="ana-menu" class="nav" aria-label="Ana menü">${links}</nav>
</header>`;
}

function footer(depth) {
  const url = makeUrl(depth);
  const links = site.nav.filter((n) => !n.cta).map((n) => `<a href="${esc(url(n.href))}">${esc(n.label)}</a>`).join('');
  return `<footer class="footer">
  <div class="frieze" aria-hidden="true"></div>
  <div class="wrap footer-grid">
    <p class="footer-motto">GEÇMİŞTEN İLHAM, GELECEĞE ETKİ.</p>
    <nav class="footer-nav" aria-label="Alt menü">${links}</nav>
    <p class="footer-copy">${esc(site.footer)}</p>
  </div>
</footer>
<script src="${relPrefix(depth)}assets/js/main.js" defer></script>
</body>
</html>`;
}

function releaseRow(r) {
  const links = Object.fromEntries(PLATFORMS.filter(([k]) => r.links?.[k]).map(([k, label]) => [label, r.links[k]]));
  const first = Object.values(links)[0] || '#';
  return `<li class="release">
  <p class="release-year">${esc(yearOf(r.date))}</p>
  <div class="release-main">
    <h4 class="release-title"${r.lang ? ` lang="${r.lang}"` : ''}>${esc(r.title)}</h4>
    ${r.note ? `<p class="release-note">${esc(r.note)}</p>` : ''}
  </div>
  <p class="release-meta"><span>${esc(r.type)}</span>${/^\d{4}-/.test(r.date || '') ? `<span>${esc(formatDate(r.date))}</span>` : ''}</p>
  <a class="btn btn-small listen" href="${esc(first)}" rel="noopener" data-title="${esc(r.title)}" data-meta="${esc(r.artist)}, ${esc(r.type)}" data-links='${esc(JSON.stringify(links))}'>Dinle<span class="sr-only">: ${esc(r.title)}</span></a>
</li>`;
}

// ---------- müzik sayfası yardımcıları ----------
const toSec = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
function totalLabel(tracks) {
  const sec = tracks.reduce((a, t) => a + toSec(t[1]), 0);
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} dk ${String(s).padStart(2, '0')} sn` : `${m} dk`;
}
function listenButton(r, url) {
  const links = Object.fromEntries(PLATFORMS.filter(([k]) => r.links?.[k]).map(([k, label]) => [label, r.links[k]]));
  const first = Object.values(links)[0] || '#';
  return `<a class="btn btn-small listen" href="${esc(first)}" rel="noopener" data-title="${esc(r.title)}" data-meta="${esc(r.artist)}, ${esc(r.type)}" data-links='${esc(JSON.stringify(links))}'${url ? ` data-page="${esc(url('muzik/' + r.slug + '/'))}"` : ''}>Dinle<span class="sr-only">: ${esc(r.title)}</span></a>`;
}
const lockedCard = (url) => `<li class="rcard rcard-locked has-cover" lang="en">
  <div class="locked-ghost" aria-hidden="true">
    <img class="rcard-cover locked-cover" src="${esc(url(dzs.upcoming.cover))}" alt="" width="360" height="360" loading="lazy" decoding="async">
    <p class="rcard-top"><span class="release-year">2026</span><span class="rcard-type">Albüm</span></p>
    <h4 class="rcard-title">${esc(dzs.upcoming.title)}</h4>
    <p class="rcard-meta">${dzs.upcoming.tracks} parça</p>
  </div>
  <div class="locked-badge">
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1" fill="currentColor"/></svg>
    <span class="locked-label">Yakında</span>
    <span class="locked-date">${esc(formatDate(dzs.upcoming.date))}</span>
    <span class="locked-count" data-date="${esc(dzs.upcoming.date)}T00:00:00+03:00" hidden></span>
    <a class="locked-link" href="${esc(url(dzs.upcoming.slug + '/'))}">Yayın sayfası</a>
    <span class="sr-only">${esc(dzs.upcoming.title)}: yeni albüm, çıkış tarihi ${esc(formatDate(dzs.upcoming.date))}.</span>
  </div>
</li>`;
function releaseCard(r, url) {
  const n = r.tracks.length;
  const meta = [/^\d{4}-/.test(r.date || '') ? formatDate(r.date) : '', `${n} parça`].filter(Boolean).join(' · ');
  const list = n > 1
    ? `<details class="tracks"><summary>Parça listesi</summary><ol>${r.tracks.map((t) => `<li><span>${esc(t[0])}</span><time>${esc(t[1])}</time></li>`).join('')}</ol></details>`
    : '';
  const cover = r.cover ? `<img class="rcard-cover" src="${esc(url(r.cover))}" alt="${esc(r.title)} kapağı" width="360" height="360" loading="lazy" decoding="async">` : '';
  return `<li class="rcard${cover ? ' has-cover' : ''}">
  ${cover}
  <p class="rcard-top"><span class="release-year">${esc(yearOf(r.date))}</span><span class="rcard-type">${esc(r.type)}</span></p>
  <h4 class="rcard-title"${r.lang ? ` lang="${r.lang}"` : ''}>${esc(r.title)}</h4>
  <p class="rcard-meta">${esc(meta)}</p>
  ${r.note ? `<p class="rcard-note">${esc(r.note)}</p>` : ''}
  ${list}
  <div class="rcard-actions">${listenButton(r, url)}</div>
</li>`;
}
const releaseGroup = (title, list, url) =>
  list.length ? `<h3 class="rgroup-title">${esc(title)}</h3>\n    <ul class="rgrid">${list.map((r) => releaseCard(r, url)).join('')}</ul>` : '';
const factList = (facts) => `<dl class="facts">${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`;
const countBy = (list, type) => list.filter((r) => r.type === type).length;
const statLine = (list) => {
  const parts = [['Albüm', 'albüm'], ['EP', 'EP'], ['Single', 'single']].map(([t, l]) => [countBy(list, t), l]).filter(([c]) => c);
  return parts.map(([c, l]) => `${c} ${l}`).join(' · ');
};

function platformLinks(r) {
  return PLATFORMS.filter(([k]) => r.links?.[k])
    .map(([k, label]) => `<li><a class="btn" href="${esc(r.links[k])}" target="_blank" rel="noopener">${label}</a></li>`)
    .join('');
}

function projectRow(p, url) {
  const external = isExternal(p.href || '');
  return `<li class="project">
  ${p.logo ? `<img class="project-logo" src="${esc(url(p.logo))}" alt="" width="64" height="64" loading="lazy" decoding="async" onerror="this.remove()">` : '<span class="project-logo project-logo-empty" aria-hidden="true"></span>'}
  <div class="project-body">
    <h4 class="project-name">${esc(p.name)}</h4>
    <p>${esc(p.text)}</p>
  </div>
  ${p.href ? `<a class="text-link" href="${esc(url(p.href))}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(p.hrefLabel || 'Aç')}<span class="sr-only">: ${esc(p.name)}</span></a>` : ''}
</li>`;
}

function divisionBlock(d, url) {
  const parent = d.parent
    ? `<div class="parent">
    <h4 class="project-name">${esc(d.parent.name)}</h4>
    <p>${esc(d.parent.text)}</p>
    <a class="text-link" href="${esc(url(d.parent.href))}" target="_blank" rel="noopener">${esc(d.parent.hrefLabel)}</a>
  </div>`
    : '';
  return `<article class="division" id="${esc(d.id)}">
  <div class="division-id">
    <img class="division-logo" src="${esc(url(d.logo))}" alt="${esc(d.logoAlt)}" width="360" height="360" loading="lazy" decoding="async">
    <h3>${esc(d.name)}</h3>
    <p>${esc(d.summary)}</p>
  </div>
  <div class="division-work">
    ${parent}
    <ul class="project-list">${d.projects.map((p) => projectRow(p, url)).join('')}</ul>
  </div>
</article>`;
}

function videoCard(v) {
  const link = `https://www.youtube.com/watch?v=${v.id}`;
  return `<li class="video">
  <a class="video-thumb" href="${link}" target="_blank" rel="noopener" aria-label="${esc(v.title)} videosunu YouTube'da izle">
    <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
    <span class="video-play">İzle</span>
  </a>
  <h3 class="video-title"><a href="${link}" target="_blank" rel="noopener">${esc(v.title)}</a></h3>
  <p class="video-date">${esc(formatDate(v.date))}</p>
</li>`;
}

function journalCard(p, url) {
  const inner = `<p class="journal-cat">${esc(p.category || '')}</p>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.excerpt || '')}</p>`;
  return p.body
    ? `<li class="journal-item"><a href="${esc(url(`gunluk/${p.slug}/`))}">${inner}</a></li>`
    : `<li class="journal-item"><div>${inner}</div></li>`;
}

// ---------- sayfalar ----------
// Ortak sayfa iskeleti: üst çubuk + içerik + (isteğe bağlı) dinleme penceresi + alt bilgi
const LISTEN_DIALOG = `
<dialog class="listen-dialog" id="listen-dialog" aria-labelledby="listen-title">
  <div class="dialog-box">
    <button class="dialog-close" type="button" data-close aria-label="Kapat">Kapat</button>
    <p class="tag">Dinleme platformunu seç</p>
    <h3 id="listen-title">Yayın</h3>
    <p id="listen-meta" class="dialog-meta"></p>
    <ul class="platform-links" id="listen-links"></ul>
    <p class="dialog-more"><a class="text-link" id="listen-page" href="#" hidden>Yayın sayfasını aç</a></p>
  </div>
</dialog>
`;

const godOf = (id) => hub.gods.find((g) => g.id === id);

// Bölüm sayfalarının üst alanı: tanrı amblemi + başlık
function pageHero(depth, god, { title, lead }) {
  const url = makeUrl(depth);
  return `<section class="hero hero-sub">
  <div class="wrap hero-grid hero-grid-sub">
    <div class="hero-copy">
      <p class="crumbs"><a href="${depth === 0 ? './' : relPrefix(depth)}">Ana sayfa</a></p>
      <h1 class="page-title">${esc(title)}</h1>
      <p class="motto motto-upper">${esc(god.tagline)}</p>
      <p class="lead">${esc(lead)}</p>
    </div>
    <img class="sub-logo god-emblem" src="${esc(url(god.image))}" alt="" width="200" height="308">
  </div>
  <div class="frieze frieze-draw" aria-hidden="true"></div>
</section>`;
}

function sectionHead(id, title, desc) {
  return `<header class="section-head">
      <h2 id="h-${id}" class="section-title">${esc(title)}</h2>
      ${desc ? `<p class="section-desc">${esc(desc)}</p>` : ''}
    </header>`;
}

function sectionVideolar() {
  return `<section class="section section-alt" id="videolar" aria-labelledby="h-videolar">
  <div class="wrap">
    ${sectionHead('videolar', 'VİDEOLAR', `${videosData.channel.name} kanalında yayınlanan en güncel videolar, yol hikayeleri ve kısa içerikler.`)}
    <ul class="video-grid">${videosData.items.slice(0, 3).map(videoCard).join('')}</ul>
    <p class="section-more"><a class="text-link" href="${esc(videosData.channel.url)}" target="_blank" rel="noopener">Tüm videolar için YouTube kanalı</a></p>
  </div>
</section>`;
}

async function hubPage() {
  const depth = 0;
  const url = makeUrl(depth);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: absUrl(site.logo),
    description: site.description,
    sameAs: site.contact.socials.map((s) => s.href),
  };
  const gods = (
    await Promise.all(
      hub.gods.map(async (g, i) => {
        const square = g.shape === 'square';
        let svg = (await readFile(path.join(ROOT, g.image), 'utf8')).trim();
        svg = svg.replace(/<svg\b[^>]*>/, (open) => {
          const vb = open.match(/viewBox="[^"]*"/)[0];
          return `<svg class="god-emblem${square ? ' god-square' : ''}" xmlns="http://www.w3.org/2000/svg" ${vb} width="${square ? 160 : 200}" height="${square ? 160 : 308}" ${square ? 'fill="none" stroke="#b08a3e" ' : ''}aria-hidden="true" focusable="false">`;
        });
        return `<li class="god god-${i + 1}">
      <a href="${esc(url(g.href))}" aria-label="${esc(g.label)}: ${esc(g.desc)}">
        ${svg}
        <span class="god-label">${esc(g.label)}</span>
      </a>
    </li>`;
      })
    )
  )
    .join('\n    ');
  return (
    head({
      title: 'Aedilis Media: müzik, yol ve hikaye',
      description: site.description,
      canonicalPath: './',
      depth,
      jsonLd,
    }) +
    `
<body class="hub">
<a class="skip-link" href="#icerik">İçeriğe geç</a>
<div class="frieze frieze-draw" aria-hidden="true"></div>
<main id="icerik" class="hub-main" tabindex="-1">
  <h1 class="sr-only">${esc(site.name)}: ${esc(site.motto)}</h1>
  <nav class="stage" aria-label="Ana menü">
    <div class="stage-center">
      <img class="stage-logo" src="${esc(url(hub.center.logo))}" alt="${esc(hub.center.alt)}" width="640" height="640" fetchpriority="high">
      <p class="stage-motto">${esc(hub.center.caption)}</p>
    </div>
    <ul class="gods">
    ${gods}
    </ul>
  </nav>
</main>
<footer class="hub-foot">
  <div class="frieze" aria-hidden="true"></div>
  <p>${esc(site.footer)}</p>
</footer>
<script src="${relPrefix(depth)}assets/js/main.js" defer></script>
</body>
</html>`
  );
}

function muzikPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const god = godOf('muzik');
  const latest = releases.find((r) => r.latest) || releases[0];
  const dzsList = releases.filter((r) => r.project === 'dzs');
  const dnList = releases.filter((r) => r.project === 'dn');
  const dzsTracks = dzsList.reduce((a, r) => a + r.tracks.length, 0);
  const dnTracks = dnList.reduce((a, r) => a + r.tracks.length, 0);
  const music = divisions.find((d) => d.id === 'music');
  return (
    head({ title: 'Müzik | Aedilis Media', description: god.desc, canonicalPath: 'muzik/', depth, ogImage: 'assets/img/og/muzik.jpg' }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
${pageHero(depth, god, { title: 'Müzik', lead: 'Aedilis Media Music çatısı altında iki bağımsız müzik evreni: Türkçe alternatif şarkılar ve gotik konsept albümler.' })}

<section class="section" id="evrenler" aria-labelledby="h-evrenler">
  <div class="wrap">
    <h2 id="h-evrenler" class="sr-only">Müzik projeleri</h2>
    <div class="music-intro">
      <img class="music-intro-logo" src="${esc(url(music.logo))}" alt="${esc(music.logoAlt)}" width="360" height="360" loading="lazy" decoding="async">
      <div>
        <h3>${esc(music.name)}</h3>
        <p>${esc(music.summary)} Her projenin kendi sesi, kendi görsel dünyası ve kendi hikayesi var.</p>
      </div>
    </div>

    <ul class="universes">
      <li class="universe universe-dzs">
        <img class="universe-logo universe-logo-wide" src="${esc(url(dzs.logo))}" alt="" width="1000" height="588" loading="lazy" decoding="async">
        <h3>${esc(dzs.shortName)} <small class="former">(${esc(dzs.formerName)})</small></h3>
        <p class="universe-tag">${esc(dzs.tagline)}</p>
        <p>${esc(dzs.intro)}</p>
        <p class="universe-stats">${esc(statLine(dzsList))} · ${dzsTracks} parça</p>
        <p class="universe-actions"><a class="btn btn-small stretch" href="${url(dzs.slug + '/')}">${esc(dzs.shortName)} evrenine gir</a></p>
      </li>
      <li class="universe universe-dn">
        <img class="universe-logo" src="${esc(url(dn.logo))}" alt="" width="96" height="96" loading="lazy" decoding="async">
        <h3>${esc(dn.name)}</h3>
        <p class="universe-tag">${esc(dn.tagline)} <span class="status-badge">${esc(dn.status.label)}</span></p>
        <p>${esc(dn.intro)}</p>
        <p class="universe-stats">${esc(statLine(dnList))} · ${dnTracks} parça</p>
        <p class="universe-actions"><a class="btn btn-small stretch" href="${url(dn.slug + '/')}">Karanlığa gir</a></p>
      </li>
    </ul>

    <article class="featured${latest.cover ? ' has-cover' : ''}">
      ${latest.cover ? `<img class="featured-cover" src="${esc(url(latest.cover))}" alt="${esc(latest.title)} kapağı" width="360" height="360" decoding="async">` : ''}
      <div class="featured-body">
        <p class="tag">Son yayın</p>
        <h3 class="featured-title"${latest.lang ? ` lang="${latest.lang}"` : ''}>${esc(latest.title)}</h3>
        <p class="featured-meta">${esc(latest.artist)}. ${esc(latest.type)}, ${esc(formatDate(latest.date))}. ${latest.tracks.length} parça.${latest.note ? ' ' + esc(latest.note) : ''}</p>
        <ul class="platform-links" aria-label="${esc(latest.title)} dinleme bağlantıları">${platformLinks(latest)}</ul>
        <p class="featured-more"><a class="text-link" href="${url('muzik/' + latest.slug + '/')}">Yayın sayfası</a></p>
      </div>
    </article>
  </div>
</section>
</main>
` +
    footer(depth)
  );
}

const EMBERS = Array.from({ length: 16 }, (_, i) => {
  const left = (i * 37 + 11) % 100;
  const size = 2 + (i % 4);
  const dur = 9 + ((i * 5) % 9);
  const delay = -((i * 7) % 14);
  const drift = ((i % 5) - 2) * 18;
  return `<span style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;--drift:${drift}px"></span>`;
}).join('');
const THORN = `<div class="dn-rule" aria-hidden="true"><svg viewBox="0 0 64 80" width="26" height="32"><path d="M32 2v76M18 58h28" stroke="currentColor" stroke-width="5" stroke-linecap="square" fill="none"/></svg></div>`;

function dnPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const list = releases.filter((r) => r.project === 'dn');
  const tracks = list.reduce((n, r) => n + r.tracks.length, 0);
  const origin = site.url.replace(/\/?$/, '/');
  const platforms = dn.platforms.map((p) => `<li><a class="btn btn-small" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.label)}</a></li>`).join('');
  return (
    head({
      title: `${dn.name} | Aedilis Media`,
      description: `${dn.name}: ${dn.tagline}. ${dn.intro}`,
      canonicalPath: `${dn.slug}/`,
      depth,
      ogImage: 'assets/img/og/dn.jpg',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: dn.name,
        url: `${origin}${dn.slug}/`,
        description: dn.intro,
        sameAs: dn.platforms.map((p) => p.href),
      },
    }) +
    `
<body class="theme-dn">
${header(depth)}
<main id="icerik" tabindex="-1">
<section class="hero hero-dn">
  <div class="embers" aria-hidden="true">${EMBERS}</div>
  <svg class="dn-star" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><circle r="92" fill="none" stroke="currentColor" stroke-width="1.2"/><circle r="84" fill="none" stroke="currentColor" stroke-width="0.5"/><path d="M0-90 52.9 72.8-85.6-27.8H85.6L-52.9 72.8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="miter"/></svg>
  <div class="wrap dn-hero-inner">
    <p class="crumbs"><a href="${url('muzik/')}">Aedilis Media Music</a></p>
    <img class="dn-sigil" src="${esc(url(dn.logo))}" alt="" width="640" height="640" fetchpriority="high">
    <h1 class="page-title dn-title">${esc(dn.name)}</h1>
    <p class="dn-tag">${esc(dn.tagline)} <span class="status-badge">${esc(dn.status.label)}</span></p>
    <p class="lead dn-lead">${esc(dn.intro)}</p>
    <blockquote class="dn-motto" lang="la"><p>${esc(dn.motto)}</p><footer>${esc(dn.mottoTr)}</footer></blockquote>
    <p class="dn-actions"><a class="btn btn-primary" href="#diskografi">Diskografiye in</a><a class="btn" href="${esc(dn.channel)}" target="_blank" rel="noopener">YouTube Music</a></p>
  </div>
</section>
${THORN}

<section class="section dn-section" aria-labelledby="h-hikaye">
  <div class="wrap prose-grid">
    <h2 id="h-hikaye" class="section-title">Hikaye</h2>
    <div class="prose">
      ${dn.about.map((t) => `<p>${esc(t)}</p>`).join('\n      ')}
      <p class="dn-status">${esc(dn.status.text)}</p>
    </div>
  </div>
  <div class="wrap">${factList(dn.facts)}</div>
</section>
${THORN}

<section class="section dn-section" aria-labelledby="h-kadro">
  <div class="wrap">
    <h2 id="h-kadro" class="section-title">Kurgusal kadro</h2>
    <ul class="cast">${dn.cast.map((c) => `<li class="cast-item"><p class="cast-role">${esc(c.role)}</p><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p></li>`).join('')}</ul>
  </div>
</section>
${THORN}

<section class="section dn-section" id="diskografi" aria-labelledby="h-disko">
  <div class="wrap">
    <h2 id="h-disko" class="section-title">Diskografi <span class="section-count">${list.length} yayın, ${tracks} parça</span></h2>
    ${releaseGroup('Albümler', list.filter((r) => r.type === 'Albüm'), url)}
    ${releaseGroup('EP\'ler', list.filter((r) => r.type === 'EP'), url)}
    ${releaseGroup('Single\'lar', list.filter((r) => r.type === 'Single'), url)}
  </div>
</section>
${THORN}

<section class="section dn-section" aria-labelledby="h-podcast">
  <div class="wrap">
    <h2 id="h-podcast" class="section-title">Podcast</h2>
    <aside class="podcast">
      ${dn.podcast.logo ? `<img class="podcast-logo" src="${esc(url(dn.podcast.logo))}" alt="${esc(dn.podcast.name)} logosu" width="368" height="450" loading="lazy" decoding="async">` : ''}
      <div>
        <h3>${esc(dn.podcast.name)}</h3>
        <p>${esc(dn.podcast.text)}</p>
      </div>
    </aside>
  </div>
</section>
${THORN}

<section class="section dn-section" aria-labelledby="h-dinle">
  <div class="wrap">
    <h2 id="h-dinle" class="section-title">Dinle</h2>
    <ul class="platform-links" aria-label="${esc(dn.name)} platformları">${platforms}</ul>
    <p class="section-more"><a class="text-link" href="${url(dn.post)}">Sahnenin hikayesini oku</a></p>
  </div>
</section>
</main>
${LISTEN_DIALOG}` +
    footer(depth)
  );
}

function yapimPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const god = godOf('yapim');
  const yapim = divisions.find((d) => d.id === 'yapim');
  const yt = site.hero.youtube;
  return (
    head({ title: 'Yapım ve Videolar | Aedilis Media', description: god.desc, canonicalPath: 'yapim/', depth }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
${pageHero(depth, god, { title: 'Yapım', lead: 'Yolculuk, kültür, lezzet ve tarih hikayelerini sinematik videolara dönüştüren yapım bölümü.' })}

<section class="section" id="bolumler" aria-labelledby="h-bolum-yapim">
  <div class="wrap">
    <h2 id="h-bolum-yapim" class="sr-only">Aedilis Media Yapım</h2>
    ${divisionBlock(yapim, url)}
    <p class="yt-stat"><a href="${esc(yt.href)}" target="_blank" rel="noopener"><strong>${esc(yt.count)}</strong> ${esc(yt.label)}</a></p>
  </div>
</section>

${sectionVideolar()}
</main>
` +
    footer(depth)
  );
}

function gunlukPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const god = godOf('gunluk');
  return (
    head({ title: 'Günlük | Aedilis Media', description: god.desc, canonicalPath: 'gunluk/', depth }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
${pageHero(depth, god, { title: 'Günlük', lead: 'Şarkıların, yolların ve üretim süreçlerinin arkasındaki hikayeler.' })}
<section class="section" id="yazilar" aria-labelledby="h-gunluk">
  <div class="wrap">
    ${sectionHead('gunluk', 'YAZILAR', '')}
    <ul class="journal-list">${journal.map((p) => journalCard(p, url)).join('')}</ul>
  </div>
</section>
</main>
` +
    footer(depth)
  );
}

function iletisimPage() {
  const depth = 1;
  const god = godOf('iletisim');
  return (
    head({ title: 'İletişim | Aedilis Media', description: god.desc, canonicalPath: 'iletisim/', depth }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
${pageHero(depth, god, { title: 'İletişim', lead: 'Marka iş birlikleri, yaratıcı projeler, müzik yayınları, video içerikleri ve medya talepleri için iletişim kanalı.' })}

<section class="section" id="iletisim" aria-labelledby="h-iletisim">
  <div class="wrap">
    <div class="contact-grid">
      <div class="contact-info">
        <h2 id="h-iletisim">${esc(site.contact.heading)}</h2>
        <p>${esc(site.contact.text)}</p>
        <p><a class="mail-link" href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></p>
        <ul class="social-list" aria-label="Sosyal medya ve platformlar">
          ${site.contact.socials.map((s) => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}
        </ul>
      </div>
      <form class="contact-form" id="iletisim-formu" action="mailto:${esc(site.contact.email)}" method="post" enctype="text/plain" data-endpoint="${esc(site.contact.formEndpoint || '')}" data-email="${esc(site.contact.email)}">
        <label for="f-ad">Adınız</label>
        <input id="f-ad" name="ad" type="text" autocomplete="name" required maxlength="200">
        <label for="f-eposta">E-posta adresiniz</label>
        <input id="f-eposta" name="eposta" type="email" autocomplete="email" required maxlength="200">
        <label for="f-mesaj">Mesajınız</label>
        <textarea id="f-mesaj" name="mesaj" rows="6" required maxlength="2000"></textarea>
        <button class="btn btn-primary" type="submit">Mesajı gönder</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>

<section class="section section-alt" aria-label="Marka özü ve manifesto">
  <div class="wrap">
    <blockquote class="manifesto-quote">
      <p>${esc(site.manifesto.text)}</p>
    </blockquote>
    <ul class="pillars pillars-wide" aria-label="Marka özü">
      ${site.manifesto.pillars.map((p) => `<li><span class="pillar-name">${esc(p.title)}</span><span class="pillar-text">${esc(p.text)}</span></li>`).join('')}
    </ul>
  </div>
</section>
</main>
` +
    footer(depth)
  );
}

function castItem(c) {
  const url = makeUrl(1);
  return `<li class="cast-item${c.image ? ' has-photo' : ''}">
      ${c.image ? `<img class="cast-photo" src="${esc(url(c.image))}" alt="${esc(c.alt || c.name)}" width="900" height="506" loading="lazy" decoding="async">` : ''}
      <div class="cast-body">
        <p class="cast-role">${esc(c.role)}</p>
        <h4>${esc(c.name)}</h4>
        <p class="cast-tone"><span>Ton</span>${esc(c.tone)}</p>
        <p class="cast-tone"><span>Kadraj</span>${esc(c.camera)}</p>
      </div>
    </li>`;
}
function tlnbPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const u = dzs.upcoming;
  const origin = site.url.replace(/\/?$/, '/');
  const pageUrl = `${origin}${u.slug}/`;
  const live = Object.fromEntries(PLATFORMS.filter(([k]) => u.links?.[k]).map(([k, label]) => [label, u.links[k]]));
  const hasLive = Object.keys(live).length > 0;
  const follow = dzs.platforms.filter((p) => ['Spotify', 'Apple Music', 'YouTube Music', 'Deezer'].includes(p.label));
  const btns = (list) => list.map(([label, href]) => `<li><a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a></li>`).join('');
  return (
    head({
      title: `${u.title} | ${dzs.shortName} | Aedilis Media`,
      description: `${dzs.shortName}: ${u.title}. ${u.type}, ${u.tracks} parça, ${formatDate(u.date)}. ${u.text}`,
      canonicalPath: `${u.slug}/`,
      depth,
      ogImage: `assets/img/og/${u.slug}.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'MusicAlbum',
        name: u.title,
        url: pageUrl,
        image: absUrl(u.cover),
        datePublished: u.date,
        numTracks: u.tracks,
        inLanguage: 'en',
        byArtist: { '@type': 'MusicGroup', name: dzs.shortName, alternateName: dzs.formerName, url: `${origin}${dzs.slug}/` },
      },
    }) +
    `
<body class="theme-dzs tlnb-page">
${header(depth)}
<main id="icerik" tabindex="-1">
<section class="tlnb hero-dzs" data-release="${esc(u.date)}T00:00:00+03:00">
  <div class="dzs-sky" aria-hidden="true"><span class="shooting-star"></span><span class="shooting-star s2"></span></div>
  <div class="dzs-floor" aria-hidden="true"><div></div></div>
  <div class="wrap tlnb-grid">
    <img class="tlnb-cover" src="${esc(url(u.cover))}" alt="${esc(u.title)} albüm kapağı" width="720" height="720" fetchpriority="high">
    <div class="tlnb-info" lang="en">
      <p class="dzs-tag tlnb-state"><span data-before>Yakında</span><span data-after hidden>Yayında</span></p>
      <h1 class="page-title tlnb-title">${esc(u.title)}</h1>
      <p class="tlnb-meta" lang="tr">${esc(u.type)} · ${u.tracks} parça · ${esc(formatDate(u.date))} · Sözler İngilizce</p>
      <div class="tlnb-count" data-before lang="tr" aria-live="off"><div><b data-d>--</b><span>gün</span></div><div><b data-h>--</b><span>saat</span></div><div><b data-m>--</b><span>dk</span></div><div><b data-s>--</b><span>sn</span></div></div>
      <div lang="tr">
        ${hasLive ? `<div data-after hidden><h2 class="chips-title">Dinle</h2><ul class="platform-links">${btns(Object.entries(live))}</ul></div>` : ''}
        <div ${hasLive ? 'data-before' : ''}>
          <p class="tlnb-actions"><a class="btn btn-primary" href="${esc(u.slug)}.ics" download>Takvime ekle</a><button class="btn" type="button" data-share data-url="${esc(pageUrl)}" data-title="${esc(u.title)}">Paylaş</button></p>
          <h2 class="chips-title">${esc(dzs.shortName)}'yi şimdiden takip et</h2>
          <ul class="platform-links">${btns(follow.map((p) => [p.label, p.href]))}</ul>
          <p class="tlnb-note">${hasLive ? '' : 'Yayın gününde dinleme bağlantıları bu sayfada olacak.'}</p>
        </div>
      </div>
    </div>
  </div>
</section>
</main>
` +
    footer(depth)
  );
}

const tlnbIcs = () => {
  const u = dzs.upcoming;
  const d = u.date.replace(/-/g, '');
  const next = new Date(Date.UTC(+u.date.slice(0, 4), +u.date.slice(5, 7) - 1, +u.date.slice(8, 10) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const pageUrl = `${site.url.replace(/\/?$/, '/')}${u.slug}/`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aedilis Media//TLNB//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${u.slug}-${d}@aedilismedia.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${dzs.shortName}: ${u.title} yayında`, `DESCRIPTION:${u.title} bugün yayında. ${pageUrl}`, `URL:${pageUrl}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
};

const SYNTH_RULE = `<div class="dzs-rule" aria-hidden="true"><svg viewBox="0 0 40 40" width="22" height="22"><path d="M20 0C21.5 12 28 18.5 40 20 28 21.5 21.5 28 20 40 18.5 28 12 21.5 0 20 12 18.5 18.5 12 20 0Z" fill="currentColor"/></svg></div>`;

function dzsPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const list = releases.filter((r) => r.project === 'dzs');
  const trackCount = list.reduce((n, r) => n + r.tracks.length, 0);
  const dn0 = dzsShort;
  return (
    head({
      title: `${dzs.shortName} (${dzs.formerName}) | Aedilis Media`,
      description: dzs.intro,
      canonicalPath: `${dzs.slug}/`,
      depth,
      ogImage: 'assets/img/og/dzs.jpg',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: dzs.shortName,
        alternateName: dzs.formerName,
        url: new URL(`${dzs.slug}/`, site.url.replace(/\/?$/, '/')).href,
        description: dzs.intro,
        sameAs: dzs.platforms.map((p) => p.href),
      },
    }) +
    `
<body class="theme-dzs">
${header(depth)}
<main id="icerik" tabindex="-1">
<section class="hero hero-dzs hero-vhs">
  <span class="vhs-play" aria-hidden="true">PLAY ▶</span>
  <span class="vhs-date" aria-hidden="true">SONRASI BİZİZ</span>
  <div class="dzs-sky" aria-hidden="true"><span class="shooting-star"></span><span class="shooting-star s2"></span></div>
  <div class="dzs-sun" aria-hidden="true"></div>
  <div class="dzs-floor" aria-hidden="true"><div></div></div>
  <div class="wrap dzs-hero-inner">
    <p class="crumbs"><a href="${url('muzik/')}">Aedilis Media Music</a></p>
    <img class="dzs-hero-logo" src="${esc(url(dzs.logo))}" alt="${esc(dzs.shortName)} logosu" width="1000" height="588" fetchpriority="high" onerror="this.remove()">
    <h1 class="page-title dzs-title">${esc(dzs.shortName)} <small class="former">(${esc(dzs.formerName)})</small></h1>
    <p class="dzs-tag">${esc(dzs.tagline)}</p>
    <p class="lead dzs-lead">${esc(dzs.intro)}</p>
    <p class="dzs-actions"><a class="btn btn-primary" href="#yayinlar">Yayınlara git</a><a class="btn" href="#dinle">Dinle</a></p>
  </div>
</section>
${SYNTH_RULE}

<section class="section" aria-labelledby="h-hikaye">
  <div class="wrap prose-grid">
    <h2 id="h-hikaye" class="section-title">HİKAYE</h2>
    <div class="prose">
      ${dzs.story.map((p) => `<p>${esc(dn0(p))}</p>`).join('')}
      <p class="note">${esc(dn0(dzs.ai))}</p>
      <dl class="facts">${dzs.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>
      <p class="roles">${esc(dzs.roles)}</p>
    </div>
  </div>
</section>
${SYNTH_RULE}

<section class="section section-alt" aria-labelledby="h-kimlik">
  <div class="wrap prose-grid">
    <h2 id="h-kimlik" class="section-title">KİMLİK</h2>
    <div class="prose">
      <p>${esc(dzs.identity.lead)}</p>
      <ul class="eras">${dzs.identity.eras.map((e) => `<li class="era"><p class="era-label">${esc(e.label)}</p><h3 class="era-title">${esc(e.title)}</h3><p>${esc(e.text)}</p></li>`).join('')}</ul>
      <h3 class="chips-title">Konumlandırma</h3>
      <ul class="chips">${dzs.identity.positioning.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="chips-title">Anlatı dünyası</h3>
      <ul class="chips">${dzs.identity.themes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  </div>
</section>
${SYNTH_RULE}

<section class="section" aria-labelledby="h-ses">
  <div class="wrap prose-grid">
    <h2 id="h-ses" class="section-title">SES</h2>
    <div class="prose">
      <p>${esc(dzs.music.lead)}</p>
      <h3 class="chips-title">Türler</h3>
      <ul class="chips">${dzs.music.genres.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="chips-title">Ses dünyası</h3>
      <ul class="chips">${dzs.music.sound.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="chips-title">Vokal</h3>
      <p>${esc(dzs.music.vocal)}</p>
      <h3 class="chips-title">Duygusal ton</h3>
      <ul class="chips">${dzs.music.tones.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="chips-title">Sözlerde, ilk dönem</h3>
      <ul class="chips">${dzs.music.lyrics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3 class="chips-title">Sözlerde, yeni dönem</h3>
      <ul class="chips">${dzs.music.lyricsNew.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
  </div>
</section>
${SYNTH_RULE}

<section class="section section-alt" aria-labelledby="h-sahne">
  <div class="wrap">
    <header class="section-head">
      <h2 id="h-sahne" class="section-title">SAHNE</h2>
      <p class="section-desc">${esc(dzs.castNote)}</p>
    </header>
    <article class="cast-feature">
      <img class="cast-feature-img" src="${esc(url(dzs.featuredCast.image))}" alt="${esc(dzs.featuredCast.alt)}" width="1100" height="825" loading="lazy" decoding="async">
      <div class="cast-feature-body">
        <p class="cast-role">${esc(dzs.featuredCast.role)}</p>
        <h3 class="cast-feature-name">${esc(dzs.featuredCast.name)}</h3>
        ${dzs.featuredCast.text.map((t) => `<p>${esc(t)}</p>`).join('')}
        <p class="cast-tone"><span>Ton</span>${esc(dzs.featuredCast.tone)}</p>
        <p class="cast-tone"><span>Kadraj</span>${esc(dzs.featuredCast.camera)}</p>
      </div>
    </article>
  </div>
</section>
${SYNTH_RULE}

<section class="section" aria-labelledby="h-gorsel">
  <div class="wrap">
    <header class="section-head">
      <h2 id="h-gorsel" class="section-title">GÖRSEL DÜNYA</h2>
      <p class="section-desc">${esc(dzs.visual.lead)}</p>
    </header>
    <ul class="swatches" aria-label="Marka renkleri">${dzs.visual.palette.map(([n, c]) => `<li><span class="swatch" style="background:${esc(c)}" aria-hidden="true"></span>${esc(n)} <code>${esc(c)}</code></li>`).join('')}</ul>
    <p class="visual-note">${esc(dzs.visual.note)}</p>
    <ul class="gallery">${dzs.visual.images.map(([src, alt]) => `<li><img src="${esc(url(src))}" alt="${esc(alt)}" width="1100" height="825" loading="lazy" decoding="async"></li>`).join('')}</ul>
  </div>
</section>
${SYNTH_RULE}

<section class="section section-alt" id="yayinlar" aria-labelledby="h-yayinlar">
  <div class="wrap">
    <header class="section-head">
      <h2 id="h-yayinlar" class="section-title">YAYINLAR</h2>
      <p class="section-desc">${list.length} yayın, ${trackCount} parça: ${esc(statLine(list))}.</p>
    </header>
    <ul class="rgrid">${lockedCard(url)}${list.map((r) => releaseCard(r, url)).join('')}</ul>
      </div>
</section>
${SYNTH_RULE}

<section class="section" id="dinle" aria-labelledby="h-dinle">
  <div class="wrap">
    <header class="section-head">
      <h2 id="h-dinle" class="section-title">DİNLE</h2>
      <p class="section-desc">${esc(dzs.secondary)}</p>
    </header>
    <ul class="platform-links">${dzs.platforms.map((p) => `<li><a class="btn" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.label)}</a></li>`).join('')}</ul>
    <p class="section-more">İletişim: <a class="mail-link" href="mailto:${esc(dzs.email)}">${esc(dzs.email)}</a></p>
  </div>
</section>
</main>

<dialog class="listen-dialog" id="listen-dialog" aria-labelledby="listen-title">
  <div class="dialog-box">
    <button class="dialog-close" type="button" data-close aria-label="Kapat">Kapat</button>
    <p class="tag">Dinleme platformunu seç</p>
    <h3 id="listen-title">Yayın</h3>
    <p id="listen-meta" class="dialog-meta"></p>
    <ul class="platform-links" id="listen-links"></ul>
    <p class="dialog-more"><a class="text-link" id="listen-page" href="#" hidden>Yayın sayfasını aç</a></p>
  </div>
</dialog>
` +
    footer(depth)
  );
}

const isoDur = (t) => { const s = toSec(t); return `PT${Math.floor(s / 60)}M${s % 60}S`; };
const releaseKind = { Albüm: 'AlbumRelease', EP: 'EPRelease', Single: 'SingleRelease' };
function releasePage(r, list) {
  const depth = 2;
  const url = makeUrl(depth);
  const i = list.indexOf(r);
  const newer = list[i - 1];
  const older = list[i + 1];
  const isDzs = r.project === 'dzs';
  const proj = isDzs
    ? { name: dzs.shortName, former: dzs.formerName, href: url(dzs.slug + '/'), url: `${site.url.replace(/\/?$/, '/')}${dzs.slug}/`, crumb: dzs.shortName }
    : { name: dn.name, former: '', href: url(dn.slug + '/'), url: `${site.url.replace(/\/?$/, '/')}${dn.slug}/`, crumb: dn.name };
  const dateLabel = /^\d{4}-/.test(r.date || '') ? formatDate(r.date) : String(r.date || '');
  const spotifyId = (r.links?.spotify || '').match(/album\/([A-Za-z0-9]+)/)?.[1];
  const origin = site.url.replace(/\/?$/, '/');
  const nav = (x, label) => x ? `<a class="rel-nav-link" href="${esc(url('muzik/' + x.slug + '/'))}"><span>${label}</span>${esc(x.title)}</a>` : '<span></span>';
  return (
    head({
      title: `${r.title} | ${proj.name} | Aedilis Media`,
      description: `${proj.name}: ${r.title}. ${r.type}, ${dateLabel}, ${r.tracks.length} parça.${r.note ? ' ' + r.note : ''}`,
      canonicalPath: `muzik/${r.slug}/`,
      depth,
      ogImage: `assets/img/og/${r.slug}.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'MusicAlbum',
        name: r.title,
        url: `${origin}muzik/${r.slug}/`,
        image: absUrl(r.cover),
        datePublished: r.date,
        albumReleaseType: `https://schema.org/${releaseKind[r.type] || 'AlbumRelease'}`,
        byArtist: { '@type': 'MusicGroup', name: proj.name, ...(proj.former ? { alternateName: proj.former } : {}), url: proj.url },
        numTracks: r.tracks.length,
        track: r.tracks.map((t, n) => ({ '@type': 'MusicRecording', position: n + 1, name: t[0], duration: isoDur(t[1]) })),
        sameAs: PLATFORMS.filter(([k]) => r.links?.[k]).map(([k]) => r.links[k]),
      },
    }) +
    `
<body class="${isDzs ? 'theme-dzs' : 'theme-dn'}">
${header(depth)}
<main id="icerik" tabindex="-1">
<section class="section rel-page">
  <div class="wrap">
    <p class="crumbs"><a href="${url('muzik/')}">Müzik</a> <span aria-hidden="true">/</span> <a href="${proj.href}">${esc(proj.crumb)}</a></p>
    <div class="rel-grid">
      <img class="rel-cover" src="${esc(url(r.cover))}" alt="${esc(r.title)} kapağı" width="720" height="720" fetchpriority="high">
      <div class="rel-info">
        <p class="tag">${esc(r.type)}</p>
        <h1 class="rel-title">${esc(r.title)}</h1>
        <p class="rel-artist">${esc(proj.name)}${proj.former ? ` <span class="former">(${esc(proj.former)})</span>` : ''}</p>
        <p class="rel-meta">${esc(dateLabel)} · ${r.tracks.length} parça</p>
        ${r.note ? `<p class="rel-note">${esc(r.note)}</p>` : ''}
        <h2 class="chips-title">Dinle</h2>
        <ul class="platform-links">${platformLinks(r)}</ul>
      </div>
    </div>

    <div class="rel-cols">
      <div>
        <h2 class="chips-title">Parça listesi${r.tracks.some((t) => t[2]) ? ' ve hikayeler' : ''}</h2>
        <ol class="rel-tracks">${r.tracks.map((t) => t[2]
          ? `<li><details class="track-story"${r.tracks.length === 1 ? ' open' : ''}><summary><span>${esc(t[0])}</span><time>${esc(t[1])}</time></summary><p>${esc(t[2])}</p></details></li>`
          : `<li><div class="track-plain"><span>${esc(t[0])}</span><time>${esc(t[1])}</time></div></li>`).join('')}</ol>
        ${r.tracks.some((t) => t[2]) ? '<p class="story-note">Hikayeler, şarkı sözlerinden yola çıkılarak yazılmış kısa anlatılardır. Bir parçaya tıklayarak hikayesini okuyabilirsin.</p>' : ''}
      </div>
      ${spotifyId ? `<div>
        <h2 class="chips-title">Önizleme</h2>
        <div class="player" data-spotify="${esc(spotifyId)}">
          <p>Oynatıcı Spotify'a ait. Yüklediğinde Spotify ile bağlantı kurulur.</p>
          <button class="btn" type="button">Spotify oynatıcısını yükle</button>
        </div>
      </div>` : ''}
    </div>

    <nav class="rel-nav" aria-label="Diğer yayınlar">${nav(newer, 'Daha yeni')}${nav(older, 'Daha eski')}</nav>
  </div>
</section>
</main>
` +
    footer(depth)
  );
}

function postPage(p) {
  const depth = 2;
  const url = makeUrl(depth);
  return (
    head({
      title: `${p.title} | Aedilis Media`,
      description: p.excerpt || site.description,
      canonicalPath: `gunluk/${p.slug}/`,
      depth,
    }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
<article class="post wrap">
  <p class="crumbs"><a href="${url('gunluk/')}">Günlük</a></p>
  <h1 class="page-title post-title">${esc(p.title)}</h1>
  <p class="post-meta">${esc(p.category || '')}${p.date ? `<span>${esc(formatDate(p.date))}</span>` : ''}</p>
  <div class="prose">${p.html}</div>
  <p class="section-more"><a class="text-link" href="${url('gunluk/')}">Günlüğe dön</a></p>
</article>
</main>
` +
    footer(depth)
  );
}

function notFoundPage() {
  const b = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const html = head({
    title: 'Sayfa bulunamadı | Aedilis Media',
    description: 'Aradığın sayfa bulunamadı.',
    canonicalPath: '404.html',
    depth: 0,
    noindex: true,
  })
    .replaceAll('href="assets/', `href="${b}assets/`)
    .replaceAll('href="./"', `href="${b}"`);
  return (
    html +
    `
<body>
<header class="topbar">
  <a class="brand" href="${b}"><span class="brand-name">AEDILIS MEDIA</span></a>
</header>
<main id="icerik" class="wrap notfound">
  <p class="lead">404</p>
  <h1 class="page-title">Sayfa bulunamadı</h1>
  <p>Aradığın adres taşınmış ya da hiç var olmamış olabilir.</p>
  <p><a class="btn btn-primary" href="${b}">Ana sayfaya dön</a></p>
</main>
</body>
</html>`
  );
}

// ---------- fontlar ----------
const FONT_FILES = [
  ['@fontsource-variable/cinzel', 'cinzel-latin-wght-normal.woff2'],
  ['@fontsource-variable/cinzel', 'cinzel-latin-ext-wght-normal.woff2'],
  ['@fontsource-variable/montserrat', 'montserrat-latin-wght-normal.woff2'],
  ['@fontsource-variable/montserrat', 'montserrat-latin-ext-wght-normal.woff2'],
  ['@fontsource/new-rocker', 'new-rocker-latin-400-normal.woff2'],
  ['@fontsource/new-rocker', 'new-rocker-latin-ext-400-normal.woff2'],
  ['@fontsource/audiowide', 'audiowide-latin-400-normal.woff2'],
  ['@fontsource/audiowide', 'audiowide-latin-ext-400-normal.woff2'],
];
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
function fontsCss() {
  const face = (family, file, range, w) => {
    const fmt = w === '400' ? 'woff2' : 'woff2-variations';
    return `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${w};src:url('../fonts/${file}') format('${fmt}');unicode-range:${range}}`;
  };
  return [
    face('Cinzel', 'cinzel-latin-ext-wght-normal.woff2', LATIN_EXT, '400 900'),
    face('Cinzel', 'cinzel-latin-wght-normal.woff2', LATIN, '400 900'),
    face('Montserrat', 'montserrat-latin-ext-wght-normal.woff2', LATIN_EXT, '100 900'),
    face('Montserrat', 'montserrat-latin-wght-normal.woff2', LATIN, '100 900'),
    face('New Rocker', 'new-rocker-latin-ext-400-normal.woff2', LATIN_EXT, '400'),
    face('New Rocker', 'new-rocker-latin-400-normal.woff2', LATIN, '400'),
    face('Audiowide', 'audiowide-latin-ext-400-normal.woff2', LATIN_EXT, '400'),
    face('Audiowide', 'audiowide-latin-400-normal.woff2', LATIN, '400'),
  ].join('\n');
}

// ---------- derleme ----------
async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // statik dosyalar
  await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
  await mkdir(path.join(DIST, 'assets/fonts'), { recursive: true });
  for (const [pkg, file] of FONT_FILES) {
    await cp(path.join(ROOT, 'node_modules', pkg, 'files', file), path.join(DIST, 'assets/fonts', file));
  }
  await writeFile(path.join(DIST, 'assets/css/fonts.css'), fontsCss());
  await writeFile(path.join(DIST, '.nojekyll'), '');

  const write = async (rel, content) => {
    const file = path.join(DIST, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };

  await write('index.html', await hubPage());
  await write('muzik/index.html', muzikPage());
  await write('yapim/index.html', yapimPage());
  await write('gunluk/index.html', gunlukPage());
  await write('iletisim/index.html', iletisimPage());
  await write(`${dzs.slug}/index.html`, dzsPage());
  await write(`${dn.slug}/index.html`, dnPage());
  await write(`${dzs.upcoming.slug}/index.html`, tlnbPage());
  await write(`${dzs.upcoming.slug}/${dzs.upcoming.slug}.ics`, tlnbIcs());
  // Eski adres: GitHub Pages sunucu yönlendirmesi vermez, bu yüzden küçük bir yönlendirme sayfası bırakıyoruz.
  const target = `${site.url.replace(/\/?$/, '/')}${dzs.slug}/`;
  await write('dorduncu-zamdan-sonra/index.html', `<!DOCTYPE html>\n<html lang="tr"><head><meta charset="utf-8"><title>DZS | Aedilis Media</title><meta name="robots" content="noindex"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0; url=../${dzs.slug}/"><script>location.replace('../${dzs.slug}/' + location.hash)</script></head><body><p><a href="../${dzs.slug}/">DZS sayfasına git</a></p></body></html>\n`);
  const pages = [{ loc: '', pri: '1.0' }, { loc: 'muzik/', pri: '0.9' }, { loc: 'yapim/', pri: '0.9' }, { loc: 'gunluk/', pri: '0.7' }, { loc: 'iletisim/', pri: '0.7' }, { loc: `${dzs.slug}/`, pri: '0.8' }, { loc: `${dn.slug}/`, pri: '0.8' }, { loc: `${dzs.upcoming.slug}/`, pri: '0.8' }];
  for (const r of releases) {
    await write(`muzik/${r.slug}/index.html`, releasePage(r, releases.filter((x) => x.project === r.project)));
    pages.push({ loc: `muzik/${r.slug}/`, pri: '0.7' });
  }
  for (const p of journal.filter((x) => x.body)) {
    await write(`gunluk/${p.slug}/index.html`, postPage(p));
    pages.push({ loc: `gunluk/${p.slug}/`, pri: '0.6' });
  }
  await write('404.html', notFoundPage());

  const origin = site.url.replace(/\/?$/, '/');
  await write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      pages.map((p) => `  <url><loc>${origin}${p.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${p.pri}</priority></url>`).join('\n') +
      `\n</urlset>\n`
  );
  await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}sitemap.xml\n`);

  console.log(`Derlendi: ${pages.length + 1} sayfa -> dist/`);
}

await build();

// ---------- yerel önizleme ----------
if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT) || 4173;
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
  http
    .createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(DIST, p);
      try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(await readFile(path.join(DIST, '404.html')));
      }
    })
    .listen(port, () => console.log(`Önizleme: http://localhost:${port}`));
}
