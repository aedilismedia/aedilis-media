// Aedilis Media: küçük etkileşimler (menü, dinleme penceresi, iletişim formu).
(() => {
  // Mobil menü
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('ana-menu');
  if (toggle && nav) {
    const close = () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // Dinleme penceresi: JS yoksa "Dinle" bağlantısı doğrudan ilk platforma gider.
  const dialog = document.getElementById('listen-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    const title = dialog.querySelector('#listen-title');
    const meta = dialog.querySelector('#listen-meta');
    const list = dialog.querySelector('#listen-links');
    let opener = null;

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('a.listen');
      if (!trigger) return;
      let links;
      try { links = JSON.parse(trigger.dataset.links || '{}'); } catch { return; }
      if (!Object.keys(links).length) return;
      e.preventDefault();
      opener = trigger;
      title.textContent = trigger.dataset.title || '';
      meta.textContent = trigger.dataset.meta || '';
      list.replaceChildren(
        ...Object.entries(links).map(([label, href]) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.className = 'btn';
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = label;
          li.append(a);
          return li;
        })
      );
      const pageLink = dialog.querySelector('#listen-page');
      if (pageLink) {
        const page = trigger.dataset.page;
        pageLink.hidden = !page;
        if (page) pageLink.href = page;
      }
      dialog.showModal();
    });

    // Yayın kartının herhangi bir yerine tıklamak da dinleme penceresini açar.
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.rcard:not(.rcard-locked)');
      if (!card || e.target.closest('a, button, details, summary')) return;
      card.querySelector('a.listen')?.click();
    });

    dialog.addEventListener('click', (e) => {
      // Kutunun dışına (arka plana) ya da "Kapat" düğmesine tıklanınca kapat
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
    dialog.addEventListener('close', () => { if (opener) opener.focus(); });
  }

  // Spotify oynatıcısı: tıklanana kadar üçüncü taraf içerik yüklenmez.
  document.querySelectorAll('[data-spotify]').forEach((box) => {
    const btn = box.querySelector('button');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = `https://open.spotify.com/embed/album/${box.dataset.spotify}?theme=0`;
      frame.width = '100%';
      frame.height = '352';
      frame.title = 'Spotify oynatıcısı';
      frame.allow = 'encrypted-media; clipboard-write; fullscreen';
      frame.loading = 'lazy';
      frame.style.border = '0';
      box.replaceChildren(frame);
    });
  });

  // İletişim formu: uç nokta tanımlıysa JSON olarak gönderir, değilse e-posta uygulamasını açar.
  const form = document.getElementById('iletisim-formu');
  if (form) {
    const status = form.querySelector('.form-status');
    const say = (text, kind) => { status.textContent = text; status.className = `form-status ${kind || ''}`; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const endpoint = form.dataset.endpoint;

      if (!endpoint) {
        const subject = encodeURIComponent(`Aedilis Media: ${data.ad}`);
        const body = encodeURIComponent(`${data.mesaj}\n\n${data.ad}\n${data.eposta}`);
        window.location.href = `mailto:${form.dataset.email}?subject=${subject}&body=${body}`;
        say('E-posta uygulaman açılıyor. Açılmazsa doğrudan ' + form.dataset.email + ' adresine yazabilirsin.');
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      say('Gönderiliyor...');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: data.ad, email: data.eposta, message: data.mesaj }),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        say('Mesajın bize ulaştı. En kısa sürede dönüş yapacağız.', 'is-ok');
      } catch {
        say('Mesaj gönderilemedi. Birazdan tekrar dene ya da ' + form.dataset.email + ' adresine yaz.', 'is-error');
      } finally {
        button.disabled = false;
      }
    });
  }
})();
