// Generates build/icon.ico (Windows), build/icon.icns (macOS) and
// build/icon.png for the Electron build. No image dependencies: pixels are
// rendered from signed-distance functions and PNG/ICO/ICNS encoded by hand.
// Mirrors the home-screen tile: lilac rounded square with the dark network glyph.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const LILAC = [0xcf, 0xc5, 0xf4];
const INK = [0x1f, 0x24, 0x30];

// --- geometry (in a 256-unit design space) ---------------------------------
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby))
  );
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function glyphDistance(x, y) {
  // three node squares
  const squares = [
    [128, 84],
    [74, 182],
    [182, 182],
  ];
  let d = Infinity;
  for (const [cx, cy] of squares) {
    d = Math.min(d, sdRoundRect(x, y, cx, cy, 26, 26, 9));
  }
  // connecting bus: stem, crossbar, two drops (stroke width 13)
  const lines = [
    [128, 110, 128, 144],
    [74, 144, 182, 144],
    [74, 144, 74, 156],
    [182, 144, 182, 156],
  ];
  for (const [ax, ay, bx, by] of lines) {
    d = Math.min(d, sdSegment(x, y, ax, ay, bx, by) - 6.5);
  }
  return d;
}

function tileDistance(x, y) {
  return sdRoundRect(x, y, 128, 128, 120, 120, 58);
}

// --- raster -----------------------------------------------------------------
function renderRGBA(size) {
  const px = Buffer.alloc(size * size * 4);
  const scale = 256 / size;
  const sub = size <= 32 ? 4 : 2; // more supersampling where pixels are scarce
  const step = scale / sub;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tileHits = 0;
      let glyphHits = 0;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const dx = x * scale + (sx + 0.5) * step;
          const dy = y * scale + (sy + 0.5) * step;
          if (tileDistance(dx, dy) < 0) tileHits++;
          if (glyphDistance(dx, dy) < 0) glyphHits++;
        }
      }
      const samples = sub * sub;
      const tileA = tileHits / samples;
      const glyphA = glyphHits / samples;
      const i = (y * size + x) * 4;
      // glyph only exists inside the tile, so composite is a simple mix
      const mix = Math.min(glyphA, tileA);
      px[i] = Math.round(LILAC[0] + (INK[0] - LILAC[0]) * (tileA ? mix / tileA : 0));
      px[i + 1] = Math.round(LILAC[1] + (INK[1] - LILAC[1]) * (tileA ? mix / tileA : 0));
      px[i + 2] = Math.round(LILAC[2] + (INK[2] - LILAC[2]) * (tileA ? mix / tileA : 0));
      px[i + 3] = Math.round(tileA * 255);
    }
  }
  return px;
}

// --- PNG encoding ------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- ICNS wrapper ---------------------------------------------------------------
// Modern icns is just PNG blobs in typed chunks; macOS picks the size it needs.
const ICNS_TYPES = {
  32: ["ic11"], // 16pt @2x
  64: ["ic12"], // 32pt @2x
  128: ["ic07"],
  256: ["ic08", "ic13"], // 256pt @1x, 128pt @2x
  512: ["ic09", "ic14"], // 512pt @1x, 256pt @2x
  1024: ["ic10"], // 512pt @2x
};

function encodeICNS(pngBySize) {
  const chunks = [];
  for (const [size, types] of Object.entries(ICNS_TYPES)) {
    const png = pngBySize.get(Number(size));
    if (!png) continue;
    for (const type of types) {
      const header = Buffer.alloc(8);
      header.write(type, 0, "ascii");
      header.writeUInt32BE(8 + png.length, 4);
      chunks.push(header, png);
    }
  }
  const body = Buffer.concat(chunks);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, "ascii");
  fileHeader.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([fileHeader, body]);
}

// --- ICO wrapper --------------------------------------------------------------
function encodeICO(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size === 256 ? 0 : size;
    e[1] = size === 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit count
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]);
}

const outDir = path.join(__dirname, "..", "build");
fs.mkdirSync(outDir, { recursive: true });
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngBySize = new Map(
  sizes.map((size) => [size, encodePNG(renderRGBA(size), size)])
);

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
fs.writeFileSync(
  path.join(outDir, "icon.ico"),
  encodeICO(icoSizes.map((size) => ({ size, png: pngBySize.get(size) })))
);
fs.writeFileSync(path.join(outDir, "icon.icns"), encodeICNS(pngBySize));
fs.writeFileSync(path.join(outDir, "icon.png"), pngBySize.get(512));
console.log(`build/icon.ico written (${icoSizes.join(", ")} px)`);
console.log("build/icon.icns written (32-1024 px)");
console.log("build/icon.png written (512 px)");
