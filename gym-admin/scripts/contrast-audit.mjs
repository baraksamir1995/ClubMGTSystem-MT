// WCAG 2.x contrast verifier for the CLBY admin theme palettes.
// Usage: node contrast.mjs
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// ── Candidate palettes ──────────────────────────────────────────────
const dark = {
  // Ippon-matched CLBY near-black surface ramp (true #0A0A0A base)
  surface: '#0A0A0A', surface2: '#161616', surface3: '#1F1F1F', surface4: '#272727',
  fg: '#F5F5F2', fgMuted: '#B8B6AF', fgFaint: '#B0AEA7',
  line: '#262626', lineStrong: '#767676',
  brand: '#B8FF2E', brandFill: '#B8FF2E', brandDim: '#A1E125', brandInk: '#0A0A0A', brandEdge: '#B8FF2E',
  accent: '#FFA070',
  success: '#8CD9A8', warning: '#F2C572', danger: '#F5A9A9', info: '#9CC9FB',
  successSoft: '#17251C', warningSoft: '#292014', dangerSoft: '#2B1919', infoSoft: '#16202D',
  neutralSoft: '#1F1F1F',
  onStatus: '#0A0A0A',
  focus: '#B8FF2E',
  chart: ['#B8FF2E', '#7DD3FC', '#FCD34D', '#FDA4AF', '#C4B5FD', '#FDBA74'],
};
const light = {
  // Ippon-matched warm neutrals; CTAs are solid dark green + white ink
  surface: '#F6F6F4', surface2: '#FFFFFF', surface3: '#F0F0ED', surface4: '#E7E7E3',
  fg: '#0F0F0E', fgMuted: '#4B4B44', fgFaint: '#50504A',
  line: '#DDDDD6', lineStrong: '#74746C',
  brand: '#375309', brandFill: '#375309', brandDim: '#2C4207', brandInk: '#FFFFFF', brandEdge: '#375309',
  accent: '#8F300F',
  success: '#0F4C2A', warning: '#6B4400', danger: '#8B1E24', info: '#1A4489',
  successSoft: '#E9F6EF', warningSoft: '#F9F0DE', dangerSoft: '#FBEBEB', infoSoft: '#EAF1FB',
  neutralSoft: '#EFF1F3',
  onStatus: '#FFFFFF',
  focus: '#375309',
  chart: ['#3D5C0A', '#075985', '#92400E', '#9F1239', '#5B21B6', '#B34A0D'],
};

let fails = 0;
function check(label, a, b, min) {
  const r = ratio(a, b);
  const ok = r >= min;
  if (!ok) fails++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${label.padEnd(58)} ${r.toFixed(2)}:1 (need ${min}:1)`);
}

for (const [name, t] of [['DARK', dark], ['LIGHT', light]]) {
  console.log(`\n════ ${name} ════`);
  const surfaces = [['surface', t.surface], ['surface2', t.surface2], ['surface3', t.surface3]];
  // 7:1 text on every surface it can sit on
  for (const [sn, s] of surfaces) {
    check(`fg on ${sn}`, t.fg, s, 7);
    check(`fg-muted on ${sn}`, t.fgMuted, s, 7);
    check(`fg-faint on ${sn}`, t.fgFaint, s, 7);
  }
  check('fg on surface4', t.fg, t.surface4, 7);
  // status/accent text: on page surface, card surface, and its soft tint
  for (const k of ['success', 'warning', 'danger', 'info', 'accent', 'brand']) {
    check(`${k} text on surface`, t[k], t.surface, 7);
    check(`${k} text on surface2`, t[k], t.surface2, 7);
    check(`${k} text on surface3`, t[k], t.surface3, 7);
    const soft = t[`${k}Soft`];
    if (soft) check(`${k} text on ${k}-soft`, t[k], soft, 7);
  }
  // solid fills: label text on fill
  check('brand-ink on brand-fill', t.brandInk, t.brandFill, 7);
  check('brand-ink on brand-dim', t.brandInk, t.brandDim, 7);
  for (const k of ['success', 'warning', 'danger', 'info'])
    check(`on-status on ${k} solid`, t.onStatus, t[k], 7);
  // 3:1 UI component / graphics minimums
  for (const [sn, s] of surfaces) {
    check(`line-strong vs ${sn}`, t.lineStrong, s, 3);
    check(`focus ring vs ${sn}`, t.focus, s, 3);
  }
  check('brand-edge (btn boundary) vs surface', t.brandEdge, t.surface, 3);
  check('brand-edge (btn boundary) vs surface2', t.brandEdge, t.surface2, 3);
  for (const k of ['success', 'warning', 'danger', 'info'])
    check(`${k} icon/dot vs surface2`, t[k], t.surface2, 3);
  t.chart.forEach((c, i) => check(`chart-${i + 1} vs surface2`, c, t.surface2, 3));
}
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
process.exit(fails ? 1 : 0);

// ── Avatar fills (theme-invariant): white initials must stay AAA ────
console.log('\n════ AVATAR ════');
let avatarFails = 0;
for (const c of ['#8C2B1A', '#7A4A0E', '#155E5E', '#563397', '#8A2F68', '#1F5E3A', '#2A4A8C', '#5C5813']) {
  const r = ratio('#FFFFFF', c);
  const ok = r >= 7;
  if (!ok) avatarFails++;
  console.log(`${ok ? '  ok ' : 'FAIL '} white initials on ${c}`.padEnd(60) + ` ${r.toFixed(2)}:1 (need 7:1)`);
}
if (avatarFails) process.exit(1);
