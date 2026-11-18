import {Color} from 'three';

// In the GLB, _BLUEINK is 0 for neutral surfaces, 1 for enamel, 2 for
// glazing/fabric/foliage, and 3 for pale glass. All colors here are sRGB.
const themes = [
  {id:'cobalt', label:'钴蓝', accent:'#284fc0', middle:'#6287de', light:'#a3bfef'},
  {id:'glacier', label:'冰川蓝', accent:'#70abc3', middle:'#9ccbdc', light:'#cee7ef'},
  {id:'sky', label:'晴空蓝', accent:'#167bce', middle:'#55aaeb', light:'#a7d8f8'},
  {id:'lagoon', label:'湖蓝', accent:'#087d96', middle:'#46aaaf', light:'#9ddddc'},
  {id:'ultramarine', label:'群青蓝', accent:'#4435a9', middle:'#8171d7', light:'#c0b9ed'},
  {id:'steel', label:'钢蓝', accent:'#526b85', middle:'#8396aa', light:'#b7c7d4'},
  {id:'navy', label:'海军蓝', accent:'#193352', middle:'#405d80', light:'#8caac5'},
];
const storageKey = 'astra.office.porcelain.blue.v1';
const bands = ['accent','middle','light'];
const original = bands.map(band => new Color(themes[0][band]));

export function mountPorcelainPalette(select, listen, requestFrame) {
  const scales = [0,1,2,3].map(() => new Color(1,1,1));
  const lampTint = new Color(1,1,1);
  const haloTint = new Color();
  let current;
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    const swatch = document.createElement('span');
    swatch.className = 'porcelain-blue-swatch';
    swatch.setAttribute('aria-hidden','true');
    swatch.style.setProperty('--chip',theme.accent);
    option.append(swatch, document.createTextNode(theme.label));
    select.append(option);
  }

  function apply(id) {
    current = themes.find(theme => theme.id === id) ?? themes[0];
    select.value = current.id;
    bands.forEach((band,i) => {
      const ink = new Color(current[band]), base = original[i];
      scales[i+1].setRGB(ink.r/base.r, ink.g/base.g, ink.b/base.b);
    });
    // The windows emit light after dark. A softer change than the daylight
    // pigment keeps the original brightness hierarchy and warm room lighting.
    const glass = scales[2];
    lampTint.setRGB(Math.sqrt(glass.r), Math.sqrt(glass.g), Math.sqrt(glass.b));
    haloTint.setRGB(.055,.36,1).multiply(lampTint);
    requestFrame();
  }

  let saved;
  try { saved = window.localStorage.getItem(storageKey); } catch { /* Session-only preview. */ }
  apply(saved);
  listen(select,'change',() => {
    apply(select.value);
    try { window.localStorage.setItem(storageKey,current.id); } catch { /* The current view still works. */ }
  });
  listen(window,'storage',event => {
    if (event.key === storageKey || event.key === null) apply(event.newValue);
  });
  select.parentElement.hidden = false;
  return {get id() { return current.id; }, inks:{value:scales}, lamp:{value:lampTint}, haloTint};
}
