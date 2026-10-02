// YouTube kanalının son videolarını data/videos.json içine yazar.
// Anahtar gerekmez: kanalın herkese açık RSS akışını kullanır.
// Başarısız olursa mevcut dosyaya dokunmaz ve hata vermeden çıkar (site eski listeyle derlenir).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/videos.json');
const data = JSON.parse(await readFile(FILE, 'utf8'));
const COUNT = 3;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AedilisSiteBuild/1.0)', 'Accept-Language': 'tr' };

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

try {
  let id = data.channel.id;
  if (!id) {
    const res = await fetch(data.channel.url, { headers: UA });
    const html = await res.text();
    id = html.match(/"channelId":"(UC[\w-]{22})"/)?.[1] || html.match(/channel\/(UC[\w-]{22})/)?.[1];
    if (!id) throw new Error('Kanal kimliği sayfada bulunamadı');
    data.channel.id = id;
  }

  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { headers: UA });
  if (!res.ok) throw new Error(`RSS yanıtı: ${res.status}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((m) => ({
      id: m[1].match(/<yt:videoId>([^<]+)</)?.[1],
      title: decode(m[1].match(/<title>([^<]+)</)?.[1] || ''),
      date: m[1].match(/<published>(\d{4}-\d{2}-\d{2})/)?.[1],
    }))
    .filter((v) => v.id && v.title && v.date)
    .slice(0, COUNT);

  if (!items.length) throw new Error('RSS akışında video yok');

  data.items = items;
  data.updated = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`${items.length} video güncellendi (${data.updated}).`);
} catch (err) {
  console.warn(`Videolar güncellenemedi, mevcut liste korunuyor: ${err.message}`);
}
