// KFS 2.0 — share cards. Draws a full-screen image (shaped like the phone's
// own screen) of a week or its top 10, and hands it
// to the phone's share sheet, or offers save / copy where the browser can't
// share files.
(() => {
  const W = 1080, PAD = 72;
  const sheet = document.getElementById('share');
  if (!sheet) return;
  const $ = s => sheet.querySelector(s);
  const img = $('[data-share-img]'), seg = $('[data-share-seg]'), note = $('[data-share-note]');
  const btnShare = $('[data-share-native]'), btnSave = $('[data-share-save]'), btnCopy = $('[data-share-copy]');
  const titleEl = $('#share-title'), subEl = $('[data-share-sub]');

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const logo = new Image();
  logo.src = 'assets/brand/kfs-logo.svg';

  // ── drawing helpers ─────────────────────────────────────────
  const DISPLAY = '"Archivo", system-ui, sans-serif', BODY = '"Inter", system-ui, sans-serif';
  function font(ctx, weight, size, family, stretch = 'normal') {
    ctx.font = `${weight} ${size}px ${family}`;
    if ('fontStretch' in ctx) ctx.fontStretch = stretch;
  }
  function fit(ctx, text, weight, max, width, stretch, family = DISPLAY) {
    font(ctx, weight, max, family, stretch);
    const w = ctx.measureText(text).width;
    const size = w > width ? Math.floor(max * width / w) : max;
    font(ctx, weight, size, family, stretch);
    return size;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }
  function card(ctx, x, y, w, h, r, fill, stroke) {
    rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  // value with a smaller unit after it, baseline-aligned; returns the total width
  function valueUnit(ctx, x, y, value, size, unit, unitSize, color, muted, align = 'left') {
    font(ctx, 800, size, DISPLAY, 'condensed');
    const vw = ctx.measureText(value).width;
    font(ctx, 700, unitSize, DISPLAY);
    const uw = unit ? ctx.measureText(unit).width + size * .06 : 0;
    const x0 = align === 'right' ? x - vw - uw : x;
    font(ctx, 800, size, DISPLAY, 'condensed');
    ctx.fillStyle = color; ctx.fillText(value, x0, y);
    if (unit) {
      font(ctx, 700, unitSize, DISPLAY);
      ctx.fillStyle = muted; ctx.fillText(unit, x0 + vw + size * .06, y);
    }
    return vw + uw;
  }
  function avatar(ctx, cx, cy, r, initials, color, surface) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = surface; ctx.fill();
    ctx.globalAlpha = .2; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(3, r * .06); ctx.strokeStyle = color; ctx.globalAlpha = .7; ctx.stroke(); ctx.globalAlpha = 1;
    font(ctx, 700, r * .62, BODY);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, cy + r * .03);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  function pill(ctx, x, y, text, color, size = 24) {
    font(ctx, 700, size, BODY);
    ctx.letterSpacing = '2px';
    const w = ctx.measureText(text).width + size * 1.3, h = size * 1.75;
    rrect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = color; ctx.globalAlpha = .16; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.fillText(text, x + size * .65, y + h * .68);
    ctx.letterSpacing = '0px';
    return w;
  }
  function outlineNumber(ctx, n, x, y, size, color) {
    font(ctx, 900, size, DISPLAY, 'expanded');
    ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.globalAlpha = .45;
    ctx.textAlign = 'right'; ctx.strokeText(String(n), x, y);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  function caps(ctx, text, x, y, size, color, weight = 600, spacing = 2) {
    font(ctx, weight, size, BODY); ctx.letterSpacing = spacing + 'px'; ctx.fillStyle = color;
    ctx.fillText(text, x, y); const w = ctx.measureText(text).width; ctx.letterSpacing = '0px';
    return w;
  }

  // Image height follows the phone's screen shape; laptops get a 9:16 story.
  function heightFor() {
    const r = screen.height / Math.max(screen.width, 1);
    const phone = matchMedia('(max-width: 640px)').matches && r > 1.5;
    return Math.round(W * (phone ? Math.min(Math.max(r, 16 / 9), 2.3) : 16 / 9));
  }

  // ── shared frame: background, header, title, footer, and a layout that
  //    shares the free height out as gaps between blocks (by weight) ──
  function frame(d, blocksFor) {
    const H = heightFor();
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const T = {
      bg: css('--bg'), surface: css('--surface'), surface3: css('--surface-3'), line: css('--line-2'),
      text: css('--text'), muted: css('--muted'), spark: css('--spark'),
      accent: '#FC4C02', accent2: '#FF8A3D', gold: css('--gold'), silver: css('--silver'), bronze: css('--bronze'),
    };
    const IW = W - PAD * 2, top = 110, bottom = H - 160;

    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(252,76,2,${a})`); g.addColorStop(1, 'rgba(252,76,2,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };
    glow(W, 0, 900, .28); glow(0, H, 800, .12);

    const titleText = d.title.toUpperCase();
    const ts = fit(ctx, titleText, 900, 100, IW, 'expanded');
    const G = { ctx, T, IW, H, avail: bottom - top };
    const blocks = [
      { h: 64, gap: 0, draw: y => header(y) },
      { h: Math.round(ts * .74), gap: 1, draw: y => { fit(ctx, titleText, 900, 100, IW, 'expanded'); ctx.fillStyle = T.text; ctx.fillText(titleText, PAD, y + ts * .74); } },
      ...blocksFor(G),
    ];
    const used = blocks.reduce((s, b) => s + b.h, 0), weights = blocks.reduce((s, b) => s + b.gap, 0);
    const unit = Math.max(14, Math.min(120, (bottom - top - used) / weights));
    let y = top + Math.max(0, (bottom - top - used - unit * weights) / 2);
    blocks.forEach(b => { y += b.gap * unit; b.draw(Math.round(y)); y += b.h; });
    footer();
    return c;

    function header(y) {
      if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, PAD, y, 195, 64);
      font(ctx, 700, 24, BODY); ctx.letterSpacing = '2px';
      const tag = d.tag.toUpperCase(), tagW = ctx.measureText(tag).width + (d.live ? 34 : 0) + 40, tx = W - PAD - tagW;
      rrect(ctx, tx, y + 8, tagW, 48, 24); ctx.lineWidth = 2; ctx.strokeStyle = T.line; ctx.stroke();
      if (d.live) { ctx.beginPath(); ctx.arc(tx + 30, y + 32, 7, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill(); }
      ctx.fillStyle = T.accent; ctx.fillText(tag, tx + (d.live ? 48 : 20), y + 41);
      ctx.letterSpacing = '0px';
    }
    // orange band like the site's ticker
    function footer() {
      ctx.save();
      ctx.translate(0, H - 74); ctx.rotate(-0.02);
      ctx.fillStyle = T.accent; ctx.fillRect(-20, -50, W + 40, 130);
      font(ctx, 900, 36, DISPLAY, 'expanded'); ctx.fillStyle = '#fff';
      ctx.fillText('KNEESFORSPEED.COM', PAD, 14);
      ctx.restore();
    }
  }

  // section label like the site's: orange tick, title, hairline
  function label({ ctx, T }, y, text) {
    ctx.save(); ctx.translate(PAD + 8, y + 18); ctx.transform(1, 0, -.2, 1, 0, 0);
    ctx.fillStyle = T.accent; ctx.fillRect(-8, -8, 16, 16); ctx.restore();
    font(ctx, 800, 30, DISPLAY, 'expanded'); ctx.fillStyle = T.text; ctx.fillText(text, PAD + 30, y + 30);
    const x = PAD + 50 + ctx.measureText(text).width;
    const g = ctx.createLinearGradient(x, 0, W - PAD, 0);
    g.addColorStop(0, T.line); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(x, y + 19, W - PAD - x, 2);
  }
  // "456.5 KM · 38 RUNNERS · 79 RUNS"
  function summary({ ctx, T }, y, parts) {
    let x = PAD;
    parts.forEach(([v, u], i) => {
      if (i) { x += caps(ctx, '·', x + 6, y + 30, 26, T.muted, 600, 0) + 18; }
      font(ctx, 800, 40, DISPLAY, 'condensed'); ctx.fillStyle = T.text; ctx.fillText(v, x, y + 32);
      x += ctx.measureText(v).width + 10;
      x += caps(ctx, u.toUpperCase(), x, y + 30, 22, T.muted) + 12;
    });
  }
  const MEDAL = T => [T.gold, T.silver, T.bronze];

  // ── card: the week ──────────────────────────────────────────
  function drawWeek(d) {
    return frame(d, G => {
      const { ctx, T, IW } = G;
      const [p1, p2, p3] = d.top;
      const ROW1 = 236, ROW = 200;
      return [
        { h: 380, gap: 1, draw: total },
        { h: 120, gap: .45, draw: y => bars(y, 120) },
        { h: 150, gap: .45, draw: strip },
        { h: 52 + (p1 ? ROW1 + 18 : 0) + (p2 ? ROW + 18 : 0) + (p3 ? ROW : 0), gap: 1.2, draw: podium },
      ];

      function total(y) {
        card(ctx, PAD, y, IW, 380, 44, T.surface, T.line);
        caps(ctx, 'TOTAL DISTANCE', PAD + 50, y + 72, 26, T.muted);
        valueUnit(ctx, PAD + 46, y + 252, d.kmStr, 184, 'km', 66, T.text, T.muted);
        font(ctx, 500, 30, BODY); ctx.fillStyle = T.muted;
        ctx.fillText(d.sub, PAD + 50, y + 318);
        const rx = W - PAD - 146, ry = y + 190, rr = 92;
        ctx.lineWidth = 20; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.strokeStyle = T.surface3; ctx.stroke();
        const rg = ctx.createLinearGradient(rx - rr, ry - rr, rx + rr, ry + rr);
        rg.addColorStop(0, T.accent); rg.addColorStop(1, T.accent2);
        ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(d.pct, 1));
        ctx.strokeStyle = rg; ctx.stroke(); ctx.lineCap = 'butt';
        font(ctx, 800, 48, DISPLAY, 'condensed'); ctx.fillStyle = T.text; ctx.textAlign = 'center';
        ctx.fillText(Math.round(d.pct * 100) + '%', rx, ry + 10);
        font(ctx, 600, 15, BODY); ctx.letterSpacing = '1.5px'; ctx.fillStyle = T.muted;
        ctx.fillText('OF RECORD', rx, ry + 40); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
      }
      // every week so far, this one in orange
      function bars(y, maxH) {
        const n = d.weeks.length, gap = 8, bw = (IW - gap * (n - 1)) / n;
        d.weeks.forEach((w, i) => {
          const h = Math.max(8, w.h * maxH);
          rrect(ctx, PAD + i * (bw + gap), y + maxH - h, bw, h, Math.min(7, bw / 2));
          ctx.fillStyle = w.cur ? T.accent : T.spark; ctx.fill();
        });
      }
      function strip(y) {
        card(ctx, PAD, y, IW, 150, 32, T.surface, T.line);
        const cw = IW / 4;
        d.stats.forEach(([lbl, val, unit], i) => {
          const x = PAD + i * cw;
          if (i) { ctx.fillStyle = T.line; ctx.fillRect(x, y + 1, 2, 148); }
          caps(ctx, lbl.toUpperCase(), x + 28, y + 52, 22, T.muted);
          valueUnit(ctx, x + 26, y + 120, val, 64, unit, 26, T.text, T.muted);
        });
      }
      // one full-width row per podium place
      function place(y, h, p, rank, col, big) {
        rrect(ctx, PAD, y, IW, h, 36);
        ctx.fillStyle = T.surface; ctx.fill();
        if (big) {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, col + '2a'); g.addColorStop(.75, col + '00');
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.lineWidth = 2; ctx.strokeStyle = big ? col + '80' : T.line; ctx.stroke();
        ctx.save(); rrect(ctx, PAD, y, IW, h, 36); ctx.clip();
        outlineNumber(ctx, rank, W - PAD - 34, y + h + (big ? 50 : 40), big ? 300 : 250, col);
        ctx.restore();
        const r = big ? 70 : 54, x = PAD + 40 + r * 2 + 34;
        avatar(ctx, PAD + 40 + r, y + h / 2, r, p.initials, p.color, T.surface);
        pill(ctx, x, y + (big ? 30 : 26), (big ? '★ ' : '') + ['1ST', '2ND', '3RD'][rank - 1], col, big ? 22 : 20);
        fit(ctx, p.name.toUpperCase(), 900, big ? 58 : 46, IW - (x - PAD) - 230, 'expanded');
        ctx.fillStyle = T.text; ctx.fillText(p.name.toUpperCase(), x, y + (big ? 136 : 116));
        const ks = big ? 62 : 50, ky = y + h - (big ? 32 : 30);
        const kw = valueUnit(ctx, x - 2, ky, p.big, ks, p.unit, big ? 28 : 24, T.text, T.muted);
        font(ctx, 500, big ? 26 : 24, BODY); ctx.fillStyle = T.muted;
        ctx.fillText('·  ' + p.meta, x + kw + 22, ky - 3);
      }
      function podium(y) {
        label(G, y, 'TOP 3');
        y += 52;
        if (p1) { place(y, ROW1, p1, 1, T.gold, true); y += ROW1 + 18; }
        if (p2) { place(y, ROW, p2, 2, T.silver, false); y += ROW + 18; }
        if (p3) place(y, ROW, p3, 3, T.bronze, false);
      }
    });
  }

  // ── card: the leaderboard top 10 ────────────────────────────
  function drawBoard(d) {
    return frame(d, G => {
      const { ctx, T, IW } = G;
      const n = d.rows.length, GAP = 12;
      // rows take what's left after the fixed blocks and a minimum of breathing room
      const fixed = 64 + 90 + 48 + 52 + (d.more ? 50 : 0) + 7 * 40;
      const rh = Math.max(96, Math.min(146, Math.floor((G.avail - fixed) / n) - GAP));
      const blocks = [
        { h: 48, gap: .6, draw: y => summary(G, y, d.summary) },
        { h: 52 + n * (rh + GAP) - GAP, gap: 1, draw: rows },
      ];
      if (d.more) blocks.push({ h: 40, gap: .5, draw: y => { font(ctx, 500, 28, BODY); ctx.fillStyle = T.muted; ctx.textAlign = 'center'; ctx.fillText(d.more, W / 2, y + 30); ctx.textAlign = 'left'; } });
      return blocks;

      function rows(y) {
        label(G, y, 'LEADERBOARD · TOP ' + n);
        y += 52;
        d.rows.forEach((r, i) => {
          const medal = MEDAL(T)[i];
          rrect(ctx, PAD, y, IW, rh, 28);
          ctx.fillStyle = T.surface; ctx.fill();
          if (medal) {
            const g = ctx.createLinearGradient(PAD, 0, PAD + IW * .7, 0);
            g.addColorStop(0, medal + '24'); g.addColorStop(1, medal + '00');
            ctx.fillStyle = g; ctx.fill();
          }
          ctx.lineWidth = 2; ctx.strokeStyle = medal ? medal + '70' : T.line; ctx.stroke();
          const mid = y + rh / 2;
          // rank
          font(ctx, 800, rh * .42, DISPLAY, 'condensed'); ctx.fillStyle = medal || T.muted;
          ctx.fillText(String(i + 1).padStart(2, '0'), PAD + 30, mid + rh * .15);
          // avatar + name + sub
          const ar = rh * .29, ax = PAD + 130 + ar;
          avatar(ctx, ax, mid, ar, r.initials, r.color, T.surface);
          const nx = ax + ar + 26, nameW = IW - (nx - PAD) - 230;
          fit(ctx, r.name, 700, Math.min(38, rh * .3), nameW, 'normal', BODY);
          ctx.fillStyle = T.text; ctx.fillText(r.name, nx, mid - 4);
          font(ctx, 500, Math.min(25, rh * .2), BODY); ctx.fillStyle = T.muted;
          ctx.fillText(r.sub, nx, mid + rh * .26);
          if (r.delta) {
            const sw = ctx.measureText(r.sub).width;
            const col = r.delta.cls === 'up' ? '#2FBF71' : r.delta.cls === 'down' ? '#E8505B' : T.accent;
            pill(ctx, nx + sw + 16, mid + rh * .26 - Math.min(25, rh * .2) * 1.15, r.delta.txt, col, Math.min(18, rh * .15));
          }
          // km, right-aligned
          valueUnit(ctx, W - PAD - 32, mid + rh * .17, r.km, rh * .46, 'km', rh * .19, T.text, T.muted, 'right');
          y += rh + GAP;
        });
      }
    });
  }

  const DRAW = { week: drawWeek, board: drawBoard };

  // ── sheet wiring ────────────────────────────────────────────
  let cards = [], current = null;
  const cache = new Map();   // card key -> { file, url }

  async function render(key) {
    current = key;
    [...seg.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.card === key));
    let out = cache.get(key);
    if (!out) {
      [btnShare, btnSave, btnCopy].forEach(b => { b.disabled = true; });
      const c = cards.find(x => x.key === key);
      const canvas = DRAW[c.data.kind](c.data);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      out = { file: new File([blob], `kfs-${c.data.slug}.png`, { type: 'image/png' }), url: URL.createObjectURL(blob) };
      cache.set(key, out);
      [btnShare, btnSave, btnCopy].forEach(b => { b.disabled = false; });
    }
    if (current !== key) return;
    img.src = out.url;
    img.alt = cards.find(x => x.key === key).alt;
    note.textContent = '';
  }

  // opts: { title, sub, cards: [{ key, label, alt, data }], start }
  async function open(opts) {
    await Promise.all([
      document.fonts.load('900 96px Archivo'), document.fonts.load('800 96px Archivo'),
      document.fonts.load('600 26px Inter'), document.fonts.load('700 26px Inter'), document.fonts.load('500 26px Inter'),
      logo.decode ? logo.decode().catch(() => {}) : null,
    ]);
    cache.forEach(v => URL.revokeObjectURL(v.url));
    cache.clear();
    cards = opts.cards;
    titleEl.textContent = opts.title;
    subEl.textContent = opts.sub;
    seg.hidden = cards.length < 2;
    seg.innerHTML = cards.map(c => `<button type="button" data-card="${c.key}" aria-pressed="false">${c.label}</button>`).join('');
    await render(opts.start || cards[0].key);
    const f = cache.get(current).file;
    btnShare.hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
    btnCopy.hidden = !(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    window.KFS.openSheet('share');
  }

  seg.addEventListener('click', e => { const b = e.target.closest('[data-card]'); if (b) render(b.dataset.card); });
  btnShare.addEventListener('click', () => {
    // called straight from the tap so iOS keeps the user gesture
    const out = cache.get(current);
    if (out) navigator.share({ files: [out.file], title: 'Knees For Speed' }).catch(() => {});
  });
  btnSave.addEventListener('click', () => {
    const out = cache.get(current);
    if (!out) return;
    const a = document.createElement('a');
    a.href = out.url; a.download = out.file.name;
    document.body.appendChild(a); a.click(); a.remove();
    note.textContent = 'Saved to your downloads.';
  });
  btnCopy.addEventListener('click', async () => {
    const out = cache.get(current);
    if (!out) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': out.file })]);
      note.textContent = 'Copied';
    } catch (e) { note.textContent = 'Copy is blocked here. Use Save instead.'; }
  });

  window.KFSShare = { open };
})();
