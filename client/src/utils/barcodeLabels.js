// Code 128 symbol widths (ISO/IEC 15417); Code Set B, modulo-103 check digit.
const patterns = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
export function encodeBarcode(value) {
  if (typeof value !== 'string' || !/^[\x20-\x7e]{1,60}$/.test(value)) throw new Error('Printable labels support 1–60 printable ASCII characters. Use a shorter barcode alias for other values.');
  const data = Array.from(value, char => char.charCodeAt(0) - 32);
  const checksum = (104 + data.reduce((sum, code, i) => sum + code * (i + 1), 0)) % 103;
  const symbols = [104, ...data, checksum, 106];
  let x = 10; const bars = [];
  for (const symbol of symbols) {
    [...patterns[symbol]].forEach((n, i) => { const width = Number(n); if (i % 2 === 0) bars.push({ x, width }); x += width; });
  }
  return { symbols, bars, modules: x + 10, widthMm: (x + 10) * 0.254, wide: value.length > 26 };
}
export function labelPages(count, wide) {
  if (!Number.isInteger(count) || count < 1 || count > 96) throw new Error('Choose between 1 and 96 labels.');
  const perPage = wide ? 8 : 16;
  return Array.from({ length: Math.ceil(count / perPage) }, (_, i) => Math.min(perPage, count - i * perPage));
}
