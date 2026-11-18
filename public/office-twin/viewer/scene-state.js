/** Model contract, deliberately independent of the DOM and rendering engine. */
export const VIEW_MODES = Object.freeze(['building', 'exploded']);
export const DETAILED_FLOOR = 9;
export const FLOOR_COUNT = 20;
export const PROTOCOL = 'astra-office-twin:v1';

export function floorElevation(number) {
  if (!Number.isInteger(number) || number < 1 || number > FLOOR_COUNT) throw new RangeError('Invalid floor');
  return number === 1 ? 0 : number === 2 ? 5.4 : 9 + (number - 3) * 3.6;
}

export function resolveView(value) {
  if (value === 'office') return 'exploded'; // Pre-v0.3 deep links and host messages.
  return VIEW_MODES.includes(value) ? value : null;
}

export function floorPresentation(number, view) {
  const mode = resolveView(view);
  if (!mode) throw new TypeError('Unknown view');
  floorElevation(number);
  const expanded = mode === 'exploded';
  return {
    visible: true,
    offsetY: expanded ? (number > DETAILED_FLOOR ? 18 : number === DETAILED_FLOOR ? 3 : 0) : 0,
    offsetZ: expanded && number === DETAILED_FLOOR ? 32 : 0,
    showFacade: number !== DETAILED_FLOOR || !expanded,
  };
}

export function isTrustedHostMessage(event, parentWindow, ownOrigin) {
  return event.source === parentWindow && event.origin === ownOrigin && event.data &&
    typeof event.data === 'object' && event.data.namespace === PROTOCOL;
}

export const VIEW_COPY = Object.freeze({
  building: { label: 'H1 / H3 · 各 20 层', description: '天津运营中心 H1 与 H3 各 20 层，造价中心位于 H1 九楼。' },
  exploded: { label: '展开9楼', description: '拖动旋转，滚轮缩放。选择房间或人物可以聚焦。' },
});
