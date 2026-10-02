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
    ${sectionHead('videolar', 'VİDEOLAR', `${videosData.channel.name} kanalında yayınlanan en güncel videolar, yol hikâyeleri ve kısa içerikler.`)}
    <ul class="video-grid">${videosData.items.slice(0, 3).map(videoCard).join('')}</ul>
    <p class="section-more"><a class="text-link" href="${esc(videosData.channel.url)}" target="_blank" rel="noopener">Tüm videolar için YouTube kanalı</a></p>
  </div>
</section>`;
}

function hubPage() {
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
  const gods = hub.gods
    .map(
      (g, i) => `<li class="god god-${i + 1}">
      <a href="${esc(url(g.href))}" aria-label="${esc(g.label)}: ${esc(g.desc)}">
        <img class="god-emblem" src="${esc(url(g.image))}" alt="" width="200" height="308" decoding="async">
        <span class="god-label">${esc(g.label)}</span>
        <span class="god-name">${esc(g.god)}</span>
      </a>
    </li>`
    )
    .join('\n    ');
  return (
    head({
      title: 'Aedilis Media: müzik, yol ve hikâye',
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
  <a class="sideproject" href="${esc(hub.sideProject.href)}" aria-label="${esc(hub.sideProject.name)}: ${esc(hub.sideProject.text)}">
    <img src="${esc(url(hub.sideProject.image))}" alt="" width="40" height="40" decoding="async">
    <span class="sideproject-name">${esc(hub.sideProject.name)}</span>
    <span class="sideproject-text">${esc(hub.sideProject.text)}</span>
  </a>
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
  const dznRows = releases.filter((r) => r.project === 'dzs').map(releaseRow).join('');
  const dnRows = releases.filter((r) => r.project === 'dn').map(releaseRow).join('');
  const music = divisions.find((d) => d.id === 'music');
  return (
    head({ title: 'Müzik | Aedilis Media', description: god.desc, canonicalPath: 'muzik/', depth }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
${pageHero(depth, god, { title: 'Müzik', lead: 'Alternatif Türkçe şarkılardan gotik konsept albümlere uzanan bağımsız müzik yayınları.' })}

<section class="section" id="bolumler" aria-labelledby="h-bolum-muzik">
  <div class="wrap">
    <h2 id="h-bolum-muzik" class="sr-only">Aedilis Media Music</h2>
    ${divisionBlock(music, url)}
  </div>
</section>

<section class="section section-alt" id="yayinlar" aria-labelledby="h-muzik">
  <div class="wrap">
    ${sectionHead('muzik', 'YAYINLAR', '')}

    <article class="featured">
      <p class="tag">Son yayın</p>
      <h3 class="featured-title"${latest.lang ? ` lang="${latest.lang}"` : ''}>${esc(latest.title)}</h3>
      <p class="featured-meta">${esc(latest.artist)}. ${esc(latest.type)}, ${esc(formatDate(latest.date))}.</p>
      <ul class="platform-links" aria-label="${esc(latest.title)} dinleme bağlantıları">${platformLinks(latest)}</ul>
    </article>

    <div class="catalog">
      <h3 class="catalog-title">Dördüncü Zamdan Sonra</h3>
      <p class="catalog-note">Şehirli melankoli ve alternatif Türkçe müzik. <a class="text-link" href="${url('dorduncu-zamdan-sonra/')}">Proje sayfası</a></p>
      <ol class="release-list">${dznRows}</ol>
    </div>

    <div class="catalog">
      <h3 class="catalog-title">Demonium Nihil</h3>
      <p class="catalog-note">Gotik atmosfer ve teatral anlatım. <a class="text-link" href="https://music.youtube.com/channel/UCw-kFfzMi7bCFa63q4fgf6Q" target="_blank" rel="noopener">Tüm yayınlar</a></p>
      <ol class="release-list">${dnRows}</ol>
    </div>
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
${pageHero(depth, god, { title: 'Yapım', lead: 'Yolculuk, kültür, lezzet ve tarih hikâyelerini sinematik videolara dönüştüren yapım bölümü.' })}

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
${pageHero(depth, god, { title: 'Günlük', lead: 'Şarkıların, yolların ve üretim süreçlerinin arkasındaki hikâyeler.' })}
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

function dzsPage() {
  const depth = 1;
  const url = makeUrl(depth);
  const rows = releases.filter((r) => r.project === 'dzs').map(releaseRow).join('');
  return (
    head({
      title: `${dzs.name} | Aedilis Media`,
      description: dzs.intro,
      canonicalPath: `${dzs.slug}/`,
      depth,
      ogImage: dzs.logo,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: dzs.name,
        url: new URL(`${dzs.slug}/`, site.url.replace(/\/?$/, '/')).href,
        description: dzs.intro,
        sameAs: dzs.platforms.map((p) => p.href),
      },
    }) +
    `
<body>
${header(depth)}
<main id="icerik" tabindex="-1">
<section class="hero hero-sub">
  <div class="wrap hero-grid hero-grid-sub">
    <div class="hero-copy">
      <p class="crumbs"><a href="${url('muzik/')}">Aedilis Media Music</a></p>
      <h1 class="page-title">${esc(dzs.name)}</h1>
      <p class="motto motto-upper">${esc(dzs.tagline)}</p>
      <p class="lead">${esc(dzs.intro)}</p>
    </div>
    <img class="sub-logo" src="${esc(url(dzs.logo))}" alt="${esc(dzs.name)} logosu" width="360" height="360" onerror="this.remove()">
  </div>
  <div class="frieze frieze-draw" aria-hidden="true"></div>
</section>

<section class="section" aria-labelledby="h-hikaye">
  <div class="wrap prose-grid">
    <h2 id="h-hikaye" class="section-title">HİKÂYE</h2>
    <div class="prose">
      ${dzs.story.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="note">${esc(dzs.ai)}</p>
      <dl class="facts">${dzs.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>
    </div>
  </div>
</section>

<section class="section section-alt" aria-labelledby="h-yayinlar">
  <div class="wrap">
    <header class="section-head">
      <h2 id="h-yayinlar" class="section-title">YAYINLAR</h2>
      <p class="section-desc">Altı yayın: bir albüm, iki EP ve üç single.</p>
    </header>
    <ol class="release-list">${rows}</ol>
  </div>
</section>

<section class="section" aria-labelledby="h-dinle">
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
  </div>
</dialog>
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
];
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
function fontsCss() {
  const face = (family, file, range, w) =>
    `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${w};src:url('../fonts/${file}') format('woff2-variations');unicode-range:${range}}`;
  return [
    face('Cinzel', 'cinzel-latin-ext-wght-normal.woff2', LATIN_EXT, '400 900'),
    face('Cinzel', 'cinzel-latin-wght-normal.woff2', LATIN, '400 900'),
    face('Montserrat', 'montserrat-latin-ext-wght-normal.woff2', LATIN_EXT, '100 900'),
    face('Montserrat', 'montserrat-latin-wght-normal.woff2', LATIN, '100 900'),
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

  await write('index.html', hubPage());
  await write('muzik/index.html', muzikPage());
  await write('yapim/index.html', yapimPage());
  await write('gunluk/index.html', gunlukPage());
  await write('iletisim/index.html', iletisimPage());
  await write(`${dzs.slug}/index.html`, dzsPage());
  const pages = [{ loc: '', pri: '1.0' }, { loc: 'muzik/', pri: '0.9' }, { loc: 'yapim/', pri: '0.9' }, { loc: 'gunluk/', pri: '0.7' }, { loc: 'iletisim/', pri: '0.7' }, { loc: `${dzs.slug}/`, pri: '0.8' }];
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
