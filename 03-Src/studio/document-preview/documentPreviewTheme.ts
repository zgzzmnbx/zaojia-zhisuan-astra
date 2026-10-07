type Theme = 'light' | 'dark';
const STYLE_ID = 'gongwen-document-theme';
const ATTRIBUTE = 'data-gongwen-document-theme';
type PreviewRoot = ShadowRoot | HTMLElement;
export function documentThemeRoot(container: HTMLElement): PreviewRoot {
  const root = container.shadowRoot ?? container;
  // Current File Viewer renders directly in its controller root. Older adapters
  // may own this one named nested root; never walk unrelated application trees.
  if (root.querySelector('section.docx')) return root;
  return root.querySelector<HTMLElement>('.file-render-host')?.shadowRoot ?? root;
}
function themeCss(shadow: boolean) {
  const prefix = shadow ? `:host([${ATTRIBUTE}="dark"])` : `[${ATTRIBUTE}="dark"]`;
  return `
${prefix} .docx-fit-viewer, ${prefix} .docx-wrapper { background: #171a20 !important; color-scheme: dark; }
${prefix} section.docx { background-color: #252a32 !important; box-shadow: 0 2px 14px #0006 !important; }
${prefix} [data-gw-paper] { background-color: #252a32 !important; }
${prefix} [data-gw-ink="text"] { color: #e5e7eb !important; }
${prefix} [data-gw-ink="muted"] { color: #bbc2cc !important; }
${prefix} [data-gw-ink="protected"] { color: var(--gw-original-ink) !important; }
${prefix} [data-gw-ink="color"] { color: var(--gw-readable-ink) !important; }
${prefix} section.docx:has(.docx-page-background) { background-color: white !important; }
${prefix} [data-gw-border] { border-color: #737c89 !important; }
`;
}

export function neutralChannel(color: string): number | null {
  const match = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (!match || (match[4] !== undefined && Number(match[4]) < 1)) return null;
  const values = match.slice(1, 4).map(Number);
  return Math.max(...values) - Math.min(...values) <= 12 ? Math.round(values.reduce((sum, value) => sum + value, 0) / 3) : null;
}

export function inkProjection(color: string, protectedBackground: boolean): 'text' | 'muted' | null {
  if (protectedBackground) return null;
  const value = neutralChannel(color);
  return value === null || value > 180 ? null : value < 96 ? 'text' : 'muted';
}

function opaqueRgb(color: string): number[] | null {
  const match = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return null;
  return match.slice(1, 4).map(Number);
}

export function paperContrast(rgb: readonly number[]) {
  const luminance = (channels: readonly number[]) => channels.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const paper = luminance([37, 42, 50]);
  const ink = luminance(rgb);
  return (Math.max(paper, ink) + 0.05) / (Math.min(paper, ink) + 0.05);
}

export function readableColor(color: string, protectedBackground: boolean): string | null {
  if (protectedBackground || neutralChannel(color) !== null) return null;
  const rgb = opaqueRgb(color);
  if (!rgb || paperContrast(rgb) >= 4.5) return null;
  // Mix toward white equally: channel order and hue distinction remain intact.
  // Ceil rounds toward greater contrast, including the 8-bit boundary.
  const mix = (amount: number) => rgb.map(value => Math.ceil(value + (255 - value) * amount));
  let low = 0, high = 1;
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (paperContrast(mix(middle)) >= 4.5) high = middle;
    else low = middle;
  }
  return `rgb(${mix(high).join(', ')})`;
}

export function protectsBackground(color: string, image: string) {
  if (image && image !== 'none') return true;
  if (color === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(color)) return false;
  const neutral = neutralChannel(color);
  return neutral === null || neutral < 235;
}

/** A display-only projection. Never changes document text, source styles, or package data. */
export function installDocumentTheme(root: PreviewRoot) {
  const host = 'host' in root ? root.host : root;
  const style = root.ownerDocument.createElement('style');
  style.id = STYLE_ID;
  style.textContent = themeCss('host' in root);
  root.append(style);
  const view = root.ownerDocument.defaultView!;
  const marked = new Set<HTMLElement>();
  let frame = 0;
  let theme: Theme = 'light';
  const scan = () => {
    // Measure original colors before applying attributes, including inherited run styles.
    host.removeAttribute(ATTRIBUTE);
    const projections: Array<{ element: HTMLElement; ink: ReturnType<typeof inkProjection>; originalInk: string | null; readableInk: string | null; paper: boolean; border: boolean }> = [];
    for (const element of root.querySelectorAll<HTMLElement>('section.docx, section.docx *')) {
      if (marked.has(element) || element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || element.closest('svg, math, picture, .docx-page-background') || /^(IMG|CANVAS|VIDEO|IFRAME|OBJECT|STYLE|SCRIPT)$/.test(element.tagName)) continue;
      const computed = view.getComputedStyle(element);
      let protectedBackground = false;
      for (let parent: HTMLElement | null = element; parent && !parent.matches('section.docx'); parent = parent.parentElement) {
        const parentStyle = parent === element ? computed : view.getComputedStyle(parent);
        if (protectsBackground(parentStyle.backgroundColor, parentStyle.backgroundImage)) { protectedBackground = true; break; }
      }
      const page = element.closest('section.docx');
      if (page?.querySelector('.docx-page-background')) protectedBackground = true;
      const background = neutralChannel(computed.backgroundColor);
      const borders = ['Top', 'Right', 'Bottom', 'Left'].map(side => ({
        color: computed.getPropertyValue(`border-${side.toLowerCase()}-color`),
        width: computed.getPropertyValue(`border-${side.toLowerCase()}-width`),
      })).filter(border => parseFloat(border.width) > 0);
      projections.push({ element, ink: inkProjection(computed.color, protectedBackground), originalInk: protectedBackground ? computed.color : null, readableInk: readableColor(computed.color, protectedBackground), paper: !protectedBackground && background !== null && background >= 235,
        border: !protectedBackground && borders.length > 0 && borders.every(border => { const value = neutralChannel(border.color); return value !== null && value < 180; }) });
    }
    for (const { element, ink, originalInk, readableInk, paper, border } of projections) {
      if (ink) element.dataset.gwInk = ink;
      if (originalInk) { element.dataset.gwInk = 'protected'; element.style.setProperty('--gw-original-ink', originalInk); }
      if (readableInk) { element.dataset.gwInk = 'color'; element.style.setProperty('--gw-readable-ink', readableInk); }
      if (paper) element.dataset.gwPaper = '';
      if (border) element.dataset.gwBorder = '';
      marked.add(element);
    }
    host.setAttribute(ATTRIBUTE, theme);
  };
  const observer = new MutationObserver(() => {
    view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(scan);
  });
  observer.observe(root, { childList: true, subtree: true });
  scan();
  return {
    setTheme(next: Theme) { theme = next; host.setAttribute(ATTRIBUTE, next); },
    dispose() {
      observer.disconnect(); view.cancelAnimationFrame(frame); host.removeAttribute(ATTRIBUTE); style.remove();
      for (const element of marked) { delete element.dataset.gwInk; delete element.dataset.gwPaper; delete element.dataset.gwBorder; element.style.removeProperty('--gw-original-ink'); element.style.removeProperty('--gw-readable-ink'); }
      marked.clear();
    },
  };
}
