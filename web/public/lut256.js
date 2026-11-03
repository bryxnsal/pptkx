// Generates a 256-color palette lookup table (LUT)
// Each integer index (0..255) has an independent discrete color,
// following the global progression:
// Index 0   -> Pure Blue   [0, 0, 255]
// Index 85  -> Pure Green  [0, 255, 0]
// Index 170 -> Pure Yellow [255, 255, 0]
// Index 255 -> Pure Red    [255, 0, 0]

export function create256ColorLUT() {
  const lut = new Uint8Array(256 * 4); // 256 RGBA entries

  for (let i = 0; i < 256; i++) {
    const t = i / 255.0;
    let r = 0, g = 0, b = 0;

    if (t <= 0.333333) {
      // 0..85: Blue -> Green
      const f = t / 0.333333;
      r = 0;
      g = Math.round(f * 255);
      b = Math.round((1.0 - f) * 255);
    } else if (t <= 0.666666) {
      // 86..170: Green -> Yellow
      const f = (t - 0.333333) / 0.333333;
      r = Math.round(f * 255);
      g = 255;
      b = 0;
    } else {
      // 171..255: Yellow -> Red
      const f = (t - 0.666666) / 0.333334;
      r = 255;
      g = Math.round((1.0 - f) * 255);
      b = 0;
    }

    lut[i * 4 + 0] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = b;
    lut[i * 4 + 3] = 255; // Alpha
  }

  return lut;
}
