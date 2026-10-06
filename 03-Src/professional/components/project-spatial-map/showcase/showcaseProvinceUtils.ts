export function normalizeShowcaseProvinceKey(value: string) {
  return value.trim().replace(/\s+/g, "").replace(/(维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市)$/, "");
}
