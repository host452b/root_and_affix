import sharp from 'sharp';

// Generate Flipword split black/white "W" icon at all sizes
const sizes = [
  { size: 128, fontSize: 86, yOffset: 90, strokeWidth: 1.5, radius: 2 },
  { size: 48, fontSize: 32, yOffset: 34, strokeWidth: 1, radius: 1 },
  { size: 16, fontSize: 11, yOffset: 12, strokeWidth: 0.5, radius: 0 },
];

for (const { size, fontSize, yOffset, strokeWidth, radius } of sizes) {
  const half = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${half}" height="${size}" fill="#09090B"/>
  <rect x="${half}" y="0" width="${half}" height="${size}" fill="#FFFFFF"/>
  <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" fill="none" stroke="#D4D4D8" stroke-width="${strokeWidth}" rx="${radius}"/>
  <defs>
    <clipPath id="left"><rect x="0" y="0" width="${half}" height="${size}"/></clipPath>
    <clipPath id="right"><rect x="${half}" y="0" width="${half}" height="${size}"/></clipPath>
  </defs>
  <text x="${half}" y="${yOffset}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF" clip-path="url(#left)">W</text>
  <text x="${half}" y="${yOffset}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#09090B" clip-path="url(#right)">W</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`icons/icon${size}.png`);

  console.log(`✓ icons/icon${size}.png`);
}

console.log('\nDone. Run `bun run build` to copy to dist/');
