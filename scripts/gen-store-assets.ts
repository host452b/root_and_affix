/**
 * Generate Chrome Web Store promotional images.
 * Usage: bun run scripts/gen-store-assets.ts
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const OUT = 'assets/store';
mkdirSync(OUT, { recursive: true });

// ── Brand tokens ───────────────────────────────────
const BG = '#FFFFFF';
const FG = '#09090B';
const MUTED = '#71717A';
const BORDER = '#E4E4E7';
const ACCENT_RED = '#B91C1C';
const MONO = 'SF Mono, Menlo, Courier New, monospace';
const SERIF = 'Georgia, serif';

// ── Shared W icon SVG ──────────────────────────────
function wIcon(size: number) {
  const fs = Math.round(size * 0.67);
  const ty = Math.round(size * 0.70);
  return `
    <rect x="0" y="0" width="${size/2}" height="${size}" fill="${FG}"/>
    <rect x="${size/2}" y="0" width="${size/2}" height="${size}" fill="${BG}"/>
    <rect x="1" y="1" width="${size-2}" height="${size-2}" fill="none" stroke="${BORDER}" stroke-width="1.5" rx="4"/>
    <defs>
      <clipPath id="wl"><rect x="0" y="0" width="${size/2}" height="${size}"/></clipPath>
      <clipPath id="wr"><rect x="${size/2}" y="0" width="${size/2}" height="${size}"/></clipPath>
    </defs>
    <text x="${size/2}" y="${ty}" text-anchor="middle" font-family="${SERIF}" font-size="${fs}" font-weight="700" fill="${BG}" clip-path="url(#wl)">W</text>
    <text x="${size/2}" y="${ty}" text-anchor="middle" font-family="${SERIF}" font-size="${fs}" font-weight="700" fill="${FG}" clip-path="url(#wr)">W</text>
  `;
}

// ── Simulated flipped word ─────────────────────────
function flippedWord(x: number, y: number, en: string, fontSize: number) {
  const pad = 6;
  const charW = fontSize * 0.6;
  const boxW = en.length * charW + pad * 2;
  return `
    <rect x="${x}" y="${y - fontSize + 2}" width="${boxW}" height="${fontSize + 6}" fill="${FG}" rx="0"/>
    <text x="${x + pad}" y="${y}" font-family="${MONO}" font-size="${fontSize}" fill="#FAFAFA" letter-spacing="0.5">${en}</text>
  `;
}

// ── Small promo tile: 440x280 ──────────────────────
async function smallTile() {
  const w = 440, h = 280;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${BG}"/>

    <!-- Icon -->
    <g transform="translate(30, 50)">
      ${wIcon(60)}
    </g>

    <!-- Title -->
    <text x="105" y="75" font-family="${SERIF}" font-size="28" font-weight="700" fill="${FG}">Flipword</text>
    <text x="105" y="98" font-family="${MONO}" font-size="11" fill="${MUTED}" letter-spacing="0.5">VIBE ENGLISH READING</text>

    <!-- Tagline -->
    <text x="30" y="150" font-family="${MONO}" font-size="14" fill="${FG}">不用背，读着读着就会了。</text>

    <!-- Simulated page snippet -->
    <g transform="translate(30, 175)">
      <text font-family="system-ui, sans-serif" font-size="14" fill="${MUTED}">
        <tspan x="0" dy="0">今天的</tspan>
      </text>
      ${flippedWord(56, 0, 'weather', 14)}
      <text font-family="system-ui, sans-serif" font-size="14" fill="${MUTED}">
        <tspan x="126" dy="0">非常适合户外</tspan>
      </text>
      ${flippedWord(210, 0, 'activities', 14)}

      <text font-family="system-ui, sans-serif" font-size="14" fill="${MUTED}">
        <tspan x="0" dy="26">这项</tspan>
      </text>
      ${flippedWord(28, 26, 'technology', 14)}
      <text font-family="system-ui, sans-serif" font-size="14" fill="${MUTED}">
        <tspan x="128" dy="0">将会改变整个</tspan>
      </text>
      ${flippedWord(226, 26, 'industry', 14)}
    </g>

    <!-- Feature tags -->
    <g transform="translate(30, 245)">
      <rect x="0" y="0" width="88" height="22" fill="none" stroke="${FG}" stroke-width="1.5"/>
      <text x="44" y="15" font-family="${MONO}" font-size="9" fill="${FG}" text-anchor="middle" letter-spacing="1">43000+ WORDS</text>

      <rect x="96" y="0" width="60" height="22" fill="none" stroke="${FG}" stroke-width="1.5"/>
      <text x="126" y="15" font-family="${MONO}" font-size="9" fill="${FG}" text-anchor="middle" letter-spacing="1">SM-2</text>

      <rect x="164" y="0" width="68" height="22" fill="none" stroke="${FG}" stroke-width="1.5"/>
      <text x="198" y="15" font-family="${MONO}" font-size="9" fill="${FG}" text-anchor="middle" letter-spacing="1">DECODE</text>

      <rect x="240" y="0" width="80" height="22" fill="none" stroke="${FG}" stroke-width="1.5"/>
      <text x="280" y="15" font-family="${MONO}" font-size="9" fill="${FG}" text-anchor="middle" letter-spacing="1">4 THEMES</text>
    </g>

    <!-- Border -->
    <rect x="1" y="1" width="${w-2}" height="${h-2}" fill="none" stroke="${FG}" stroke-width="2"/>
  </svg>`;

  await sharp(Buffer.from(svg)).flatten({ background: BG }).png().toFile(`${OUT}/promo-small-440x280.png`);
  console.log('  promo-small-440x280.png');
}

// ── Large promo tile (marquee): 1400x560 ───────────
async function largeTile() {
  const w = 1400, h = 560;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${BG}"/>

    <!-- Left: branding -->
    <g transform="translate(100, 120)">
      ${wIcon(100)}
    </g>

    <text x="230" y="165" font-family="${SERIF}" font-size="56" font-weight="700" fill="${FG}">Flipword</text>
    <text x="230" y="200" font-family="${MONO}" font-size="16" fill="${MUTED}" letter-spacing="1.5">VIBE ENGLISH READING</text>

    <!-- Tagline -->
    <text x="100" y="290" font-family="${MONO}" font-size="22" fill="${FG}">让阅读慢慢长出英语。</text>
    <text x="100" y="320" font-family="${MONO}" font-size="16" fill="${MUTED}">Don't study English. Just read. Words flip themselves.</text>

    <!-- Feature tags -->
    <g transform="translate(100, 370)">
      <rect x="0" y="0" width="140" height="36" fill="${FG}"/>
      <text x="70" y="23" font-family="${MONO}" font-size="13" fill="${BG}" text-anchor="middle" letter-spacing="1.5">43000+ WORDS</text>

      <rect x="156" y="0" width="100" height="36" fill="none" stroke="${FG}" stroke-width="2"/>
      <text x="206" y="23" font-family="${MONO}" font-size="13" fill="${FG}" text-anchor="middle" letter-spacing="1.5">SM-2</text>

      <rect x="272" y="0" width="120" height="36" fill="none" stroke="${FG}" stroke-width="2"/>
      <text x="332" y="23" font-family="${MONO}" font-size="13" fill="${FG}" text-anchor="middle" letter-spacing="1.5">DECODE</text>

      <rect x="408" y="0" width="130" height="36" fill="none" stroke="${FG}" stroke-width="2"/>
      <text x="473" y="23" font-family="${MONO}" font-size="13" fill="${FG}" text-anchor="middle" letter-spacing="1.5">4 THEMES</text>
    </g>

    <!-- Right: simulated page -->
    <g transform="translate(750, 80)">
      <rect x="0" y="0" width="540" height="400" fill="#FAFAFA" stroke="${BORDER}" stroke-width="1.5" rx="0"/>
      <!-- Browser chrome -->
      <rect x="0" y="0" width="540" height="32" fill="#F4F4F5"/>
      <circle cx="18" cy="16" r="5" fill="#E4E4E7"/>
      <circle cx="36" cy="16" r="5" fill="#E4E4E7"/>
      <circle cx="54" cy="16" r="5" fill="#E4E4E7"/>
      <rect x="80" y="8" width="380" height="16" fill="${BG}" stroke="${BORDER}" stroke-width="1" rx="3"/>
      <text x="270" y="20" font-family="system-ui" font-size="10" fill="${MUTED}" text-anchor="middle">news.example.com</text>

      <!-- Page content -->
      <text font-family="system-ui, sans-serif" font-size="22" fill="${FG}" font-weight="700">
        <tspan x="30" y="72">全球科技峰会今日开幕</tspan>
      </text>
      <line x1="30" y1="82" x2="510" y2="82" stroke="${BORDER}" stroke-width="1"/>

      <!-- Line 1 -->
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="30" dy="110">今年的</tspan>
      </text>
      ${flippedWord(88, 110, 'technology', 15)}
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="198" dy="0">大会聚焦人工</tspan>
      </text>
      ${flippedWord(306, 110, 'intelligence', 15)}

      <!-- Line 2 -->
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="30" dy="140">多位</tspan>
      </text>
      ${flippedWord(60, 140, 'experts', 15)}
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="140" dy="0">分享了最新的</tspan>
      </text>
      ${flippedWord(248, 140, 'research', 15)}
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="336" dy="0">成果。</tspan>
      </text>

      <!-- Line 3 -->
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="30" dy="170">这些创新将深刻</tspan>
      </text>
      ${flippedWord(150, 170, 'influence', 15)}
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="246" dy="0">未来的</tspan>
      </text>
      ${flippedWord(292, 170, 'development', 15)}

      <!-- Line 4 -->
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="30" dy="200">大会也讨论了</tspan>
      </text>
      ${flippedWord(130, 200, 'sustainable', 15)}
      <text font-family="system-ui, sans-serif" font-size="15" fill="#52525B">
        <tspan x="246" dy="0">发展的议题。</tspan>
      </text>

      <!-- Decode panel preview -->
      <rect x="220" y="260" width="280" height="110" fill="${BG}" stroke="${FG}" stroke-width="2" rx="0"/>
      <text x="236" y="282" font-family="${MONO}" font-size="18" font-weight="700" fill="${FG}">technology</text>
      <text x="236" y="300" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">NOUN · 技术，科技</text>
      <line x1="236" y1="310" x2="484" y2="310" stroke="${BORDER}" stroke-width="1"/>
      <text x="236" y="326" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1">DECODE</text>
      <text x="236" y="344" font-family="${MONO}" font-size="12" fill="${FG}">techn(o)  +  log(y)</text>
      <text x="236" y="360" font-family="${MONO}" font-size="10" fill="${MUTED}">skill/craft    study/science</text>
    </g>

    <!-- Border -->
    <rect x="1" y="1" width="${w-2}" height="${h-2}" fill="none" stroke="${FG}" stroke-width="2"/>
  </svg>`;

  await sharp(Buffer.from(svg)).flatten({ background: BG }).png().toFile(`${OUT}/promo-large-1400x560.png`);
  console.log('  promo-large-1400x560.png');
}

// ── Screenshot 1: immersion effect (1280x800) ─────
async function screenshot1() {
  const w = 1280, h = 800;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#F4F4F5"/>

    <!-- Browser window -->
    <rect x="40" y="30" width="1200" height="740" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
    <!-- Tab bar -->
    <rect x="40" y="30" width="1200" height="40" fill="#FAFAFA" stroke="${BORDER}" stroke-width="1"/>
    <circle cx="62" cy="50" r="6" fill="#FF5F57"/>
    <circle cx="82" cy="50" r="6" fill="#FEBC2E"/>
    <circle cx="102" cy="50" r="6" fill="#28C840"/>
    <rect x="130" y="38" width="200" height="24" fill="${BG}" stroke="${BORDER}" stroke-width="1" rx="4"/>
    <text x="230" y="54" font-family="system-ui" font-size="11" fill="${MUTED}" text-anchor="middle">tech.sina.com.cn</text>

    <!-- Article -->
    <text font-family="system-ui, sans-serif" font-size="32" fill="${FG}" font-weight="700">
      <tspan x="100" y="130">人工智能正在重塑全球产业格局</tspan>
    </text>
    <text font-family="system-ui, sans-serif" font-size="13" fill="${MUTED}">
      <tspan x="100" y="155">2026-04-16 · 科技日报</tspan>
    </text>
    <line x1="100" y1="170" x2="1180" y2="170" stroke="${BORDER}" stroke-width="1"/>

    <!-- Paragraph 1 -->
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46" line-height="1.8">
      <tspan x="100" y="210">随着深度学习技术的突破，人工</tspan>
    </text>
    ${flippedWord(552, 210, 'intelligence', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="678" y="210">已经从实验室走向了</tspan>
    </text>

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="245">各个行业的核心</tspan>
    </text>
    ${flippedWord(240, 245, 'application', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="370, 245" dy="0">场景。从医疗</tspan>
    </text>
    ${flippedWord(490, 245, 'diagnosis', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="600" dy="0">到金融</tspan>
    </text>
    ${flippedWord(650, 245, 'analysis', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="748" dy="0">，从自动</tspan>
    </text>
    ${flippedWord(820, 245, 'driving', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="910" dy="0">到智能</tspan>
    </text>

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="280">制造，AI 的</tspan>
    </text>
    ${flippedWord(210, 280, 'influence', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="316" dy="0">无处不在。</tspan>
    </text>

    <!-- Paragraph 2 -->
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="330">业内</tspan>
    </text>
    ${flippedWord(136, 330, 'experts', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="232" dy="0">指出，当前 AI 发展面临三大</tspan>
    </text>
    ${flippedWord(544, 330, 'challenges', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="666" dy="0">：数据</tspan>
    </text>
    ${flippedWord(720, 330, 'privacy', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="808" dy="0">保护、</tspan>
    </text>

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="365">算法</tspan>
    </text>
    ${flippedWord(136, 365, 'transparency', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="282" dy="0">以及</tspan>
    </text>
    ${flippedWord(318, 365, 'ethical', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="398" dy="0">规范。各国</tspan>
    </text>
    ${flippedWord(490, 365, 'government', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="612" dy="0">纷纷出台</tspan>
    </text>
    ${flippedWord(680, 365, 'regulations', 17)}

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="400">试图在</tspan>
    </text>
    ${flippedWord(154, 400, 'innovation', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="276" dy="0">与安全之间找到</tspan>
    </text>
    ${flippedWord(430, 400, 'balance', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="516" dy="0">。</tspan>
    </text>

    <!-- Paragraph 3 -->
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="450">在教育领域，个性化学习</tspan>
    </text>
    ${flippedWord(362, 450, 'platform', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="460" dy="0">正在</tspan>
    </text>
    ${flippedWord(496, 450, 'transform', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="600" dy="0">传统教学模式。</tspan>
    </text>

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="485">通过</tspan>
    </text>
    ${flippedWord(136, 485, 'adaptive', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="236" dy="0">算法，系统能够根据每个学生的</tspan>
    </text>
    ${flippedWord(548, 485, 'progress', 17)}

    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="100" y="520">自动调整学习内容的难度和</tspan>
    </text>
    ${flippedWord(392, 520, 'frequency', 17)}
    <text font-family="system-ui, sans-serif" font-size="17" fill="#3F3F46">
      <tspan x="504" dy="0">。</tspan>
    </text>

    <!-- Decode panel overlay -->
    <rect x="700" y="470" width="360" height="190" fill="${BG}" stroke="${FG}" stroke-width="2.5" rx="0"/>
    <rect x="700" y="470" width="360" height="36" fill="#FAFAFA"/>
    <text x="718" y="494" font-family="${MONO}" font-size="22" font-weight="700" fill="${FG}">intelligence</text>
    <text x="718" y="520" font-family="system-ui" font-size="13" fill="#52525B">n. 智力，智能；情报</text>

    <line x1="718" y1="535" x2="1042" y2="535" stroke="${BORDER}" stroke-width="1"/>
    <text x="718" y="552" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">DECODE</text>
    <text x="718" y="574" font-family="${MONO}" font-size="15" fill="${FG}">intel  +  lig  +  ence</text>
    <text x="718" y="594" font-family="${MONO}" font-size="11" fill="${MUTED}">between   gather   state</text>
    <text x="718" y="612" font-family="${MONO}" font-size="11" fill="${MUTED}">→ "能在事物间收集信息的能力"</text>

    <!-- Action buttons -->
    <rect x="718" y="630" width="82" height="22" fill="${FG}"/>
    <text x="759" y="645" font-family="${MONO}" font-size="10" fill="${BG}" text-anchor="middle" letter-spacing="1">CLEARED</text>
    <rect x="810" y="630" width="72" height="22" fill="none" stroke="${FG}" stroke-width="1.5"/>
    <text x="846" y="645" font-family="${MONO}" font-size="10" fill="${FG}" text-anchor="middle" letter-spacing="1">RE-FLIP</text>

    <!-- Caption bar -->
    <rect x="40" y="740" width="1200" height="30" fill="#FAFAFA" stroke="${BORDER}" stroke-width="1"/>
    <text x="640" y="760" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle" letter-spacing="1">FLIPWORD — VIBE ENGLISH READING · 不用背，读着读着就会了</text>
  </svg>`;

  await sharp(Buffer.from(svg)).flatten({ background: '#F4F4F5' }).png().toFile(`${OUT}/screenshot-1-immersion-1280x800.png`);
  console.log('  screenshot-1-immersion-1280x800.png');
}

// ── Screenshot 2: popup dashboard (1280x800) ──────
async function screenshot2() {
  const w = 1280, h = 800;
  const px = 440, py = 140; // popup position
  const pw = 360, ph = 480;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#F4F4F5"/>

    <!-- Dimmed background page -->
    <rect x="40" y="30" width="1200" height="740" fill="${BG}" stroke="${BORDER}" stroke-width="1" opacity="0.5"/>
    <rect x="40" y="30" width="1200" height="40" fill="#FAFAFA" opacity="0.5"/>

    <!-- Popup window -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${BG}" stroke="${FG}" stroke-width="2.5" rx="0"/>

    <!-- Popup header -->
    <text x="${px+20}" y="${py+32}" font-family="${SERIF}" font-size="20" font-weight="700" fill="${FG}">Flipword</text>
    <text x="${px+pw-20}" y="${py+32}" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="end">中 / EN</text>

    <line x1="${px+20}" y1="${py+45}" x2="${px+pw-20}" y2="${py+45}" stroke="${BORDER}" stroke-width="1"/>

    <!-- ON/OFF toggle area -->
    <rect x="${px+130}" y="${py+60}" width="100" height="50" fill="${FG}" rx="0"/>
    <text x="${px+180}" y="${py+90}" font-family="${MONO}" font-size="20" font-weight="700" fill="${BG}" text-anchor="middle">ON</text>

    <!-- Stats -->
    <text x="${px+20}" y="${py+145}" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">TODAY</text>
    <text x="${px+20}" y="${py+172}" font-family="${MONO}" font-size="28" font-weight="700" fill="${FG}">247</text>
    <text x="${px+95}" y="${py+172}" font-family="${MONO}" font-size="12" fill="#16A34A">+38%</text>

    <text x="${px+200}" y="${py+145}" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">STREAK</text>
    <text x="${px+200}" y="${py+172}" font-family="${MONO}" font-size="28" font-weight="700" fill="${FG}">12d</text>

    <!-- 7-day sparkline -->
    <text x="${px+20}" y="${py+205}" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">7-DAY TREND</text>
    <g transform="translate(${px+20}, ${py+215})">
      <rect x="0" y="20" width="36" height="20" fill="${BORDER}"/>
      <rect x="44" y="12" width="36" height="28" fill="${BORDER}"/>
      <rect x="88" y="8" width="36" height="32" fill="${BORDER}"/>
      <rect x="132" y="15" width="36" height="25" fill="${BORDER}"/>
      <rect x="176" y="5" width="36" height="35" fill="${BORDER}"/>
      <rect x="220" y="10" width="36" height="30" fill="${BORDER}"/>
      <rect x="264" y="0" width="36" height="40" fill="${FG}"/>
    </g>

    <!-- Level & Theme -->
    <line x1="${px+20}" y1="${py+270}" x2="${px+pw-20}" y2="${py+270}" stroke="${BORDER}" stroke-width="1"/>
    <text x="${px+20}" y="${py+295}" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">LEVEL</text>
    <g transform="translate(${px+20}, ${py+305})">
      <rect x="0" y="0" width="44" height="24" fill="none" stroke="${BORDER}" stroke-width="1.5"/>
      <text x="22" y="16" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle">L1</text>
      <rect x="52" y="0" width="44" height="24" fill="${FG}"/>
      <text x="74" y="16" font-family="${MONO}" font-size="11" fill="${BG}" text-anchor="middle">L2</text>
      <rect x="104" y="0" width="44" height="24" fill="none" stroke="${BORDER}" stroke-width="1.5"/>
      <text x="126" y="16" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle">L3</text>
      <rect x="156" y="0" width="44" height="24" fill="none" stroke="${BORDER}" stroke-width="1.5"/>
      <text x="178" y="16" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle">L4</text>
    </g>

    <text x="${px+20}" y="${py+360}" font-family="${MONO}" font-size="9" fill="${MUTED}" letter-spacing="1.5">THEME</text>
    <g transform="translate(${px+20}, ${py+370})">
      <rect x="0" y="0" width="28" height="28" fill="${FG}" stroke="${FG}" stroke-width="2"/>
      <rect x="36" y="0" width="28" height="28" fill="#FAFAF7" stroke="${ACCENT_RED}" stroke-width="2" rx="4"/>
      <rect x="72" y="0" width="28" height="28" fill="#F5F0FF" stroke="#8B5CF6" stroke-width="2" rx="14"/>
      <rect x="108" y="0" width="28" height="28" fill="#FAFAFA" stroke="#D4D4D8" stroke-width="2" rx="8"/>
    </g>

    <!-- Tabs -->
    <line x1="${px}" y1="${py+ph-40}" x2="${px+pw}" y2="${py+ph-40}" stroke="${BORDER}" stroke-width="1"/>
    <text x="${px+60}" y="${py+ph-15}" font-family="${MONO}" font-size="10" fill="${FG}" text-anchor="middle" letter-spacing="1.5" font-weight="700">HOME</text>
    <text x="${px+180}" y="${py+ph-15}" font-family="${MONO}" font-size="10" fill="${MUTED}" text-anchor="middle" letter-spacing="1.5">STATS</text>
    <text x="${px+300}" y="${py+ph-15}" font-family="${MONO}" font-size="10" fill="${MUTED}" text-anchor="middle" letter-spacing="1.5">SETTINGS</text>

    <!-- Caption bar -->
    <rect x="40" y="740" width="1200" height="30" fill="#FAFAFA" stroke="${BORDER}" stroke-width="1"/>
    <text x="640" y="760" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle" letter-spacing="1">FLIPWORD — POPUP DASHBOARD · 每日沉浸统计 + 主题 / 密度控制</text>
  </svg>`;

  await sharp(Buffer.from(svg)).flatten({ background: '#F4F4F5' }).png().toFile(`${OUT}/screenshot-2-popup-1280x800.png`);
  console.log('  screenshot-2-popup-1280x800.png');
}

// ── Screenshot 3: 4 themes comparison (1280x800) ──
async function screenshot3() {
  const w = 1280, h = 800;

  function themeBlock(x: number, y: number, name: string, nameCn: string, bg: string, fg: string, accent: string, markBg: string, markFg: string, radius: string, fontFamily: string) {
    return `
      <rect x="${x}" y="${y}" width="270" height="300" fill="${bg}" stroke="${accent}" stroke-width="2" rx="${radius}"/>
      <text x="${x+20}" y="${y+30}" font-family="${fontFamily}" font-size="16" font-weight="700" fill="${fg}">${name}</text>
      <text x="${x+20}" y="${y+48}" font-family="system-ui" font-size="11" fill="${accent}">${nameCn}</text>
      <line x1="${x+20}" y1="${y+60}" x2="${x+250}" y2="${y+60}" stroke="${accent}" stroke-width="1" opacity="0.3"/>

      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+20}" y="${y+90}">随着深度学习的突破</tspan>
      </text>
      <rect x="${x+20}" y="${y+100}" width="${7*8.4+12}" height="${14+6}" fill="${markBg}" rx="${radius}"/>
      <text x="${x+26}" y="${y+116}" font-family="${fontFamily}" font-size="14" fill="${markFg}" letter-spacing="0.5">concept</text>
      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+108}" y="${y+116}">已经发生了</tspan>
      </text>

      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+20}" y="${y+150}">深刻的变化。各个</tspan>
      </text>
      <rect x="${x+20}" y="${y+158}" width="${8*8.4+12}" height="${14+6}" fill="${markBg}" rx="${radius}"/>
      <text x="${x+26}" y="${y+174}" font-family="${fontFamily}" font-size="14" fill="${markFg}" letter-spacing="0.5">industry</text>
      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+114}" y="${y+174}">都在</tspan>
      </text>

      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+20}" y="${y+208}">积极</tspan>
      </text>
      <rect x="${x+20}" y="${y+216}" width="${7*8.4+12}" height="${14+6}" fill="${markBg}" rx="${radius}"/>
      <text x="${x+26}" y="${y+232}" font-family="${fontFamily}" font-size="14" fill="${markFg}" letter-spacing="0.5">explore</text>
      <text font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.7">
        <tspan x="${x+108}" y="${y+232}">新的可能。</tspan>
      </text>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#F4F4F5"/>

    <!-- Title -->
    <text x="640" y="60" font-family="${MONO}" font-size="13" fill="${MUTED}" text-anchor="middle" letter-spacing="2">4 VISUAL THEMES</text>
    <text x="640" y="85" font-family="system-ui" font-size="16" fill="${FG}" text-anchor="middle">适配不同阅读偏好</text>

    <!-- 4 theme blocks -->
    ${themeBlock(50, 120, 'Brutalist', '粗野主义', '#FFFFFF', '#09090B', '#09090B', '#09090B', '#FAFAFA', '0', `${MONO}`)}
    ${themeBlock(355, 120, 'Editorial', '杂志编辑风', '#FAFAF7', '#1C1917', '#B91C1C', 'none', '#B91C1C', '4', 'Georgia, serif')}
    ${themeBlock(660, 120, 'Soft', '柔和渐变', '#FAF5FF', '#1E1B4B', '#8B5CF6', '#EDE9FE', '#6D28D9', '14', 'system-ui, sans-serif')}
    ${themeBlock(965, 120, 'Minimal', '极简主义', '#FAFAFA', '#171717', '#D4D4D8', '#F5F5F5', '#525252', '8', 'system-ui, sans-serif')}

    <!-- Caption -->
    <rect x="40" y="740" width="1200" height="30" fill="#FAFAFA" stroke="${BORDER}" stroke-width="1"/>
    <text x="640" y="760" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle" letter-spacing="1">FLIPWORD — 4 THEMES · Brutalist · Editorial · Soft · Minimal</text>
  </svg>`;

  await sharp(Buffer.from(svg)).flatten({ background: '#F4F4F5' }).png().toFile(`${OUT}/screenshot-3-themes-1280x800.png`);
  console.log('  screenshot-3-themes-1280x800.png');
}

// ── Run all ────────────────────────────────────────
console.log('Generating store assets...');
await Promise.all([
  smallTile(),
  largeTile(),
  screenshot1(),
  screenshot2(),
  screenshot3(),
]);
console.log(`Done → ${OUT}/`);
