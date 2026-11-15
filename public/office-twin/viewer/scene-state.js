/** Model contract, deliberately independent of the DOM and rendering engine. */
export const VIEW_MODES = Object.freeze(['building', 'exploded', 'office']);
export const DETAILED_FLOOR = 9;
export const FLOOR_COUNT = 20;
export const PROTOCOL = 'astra-office-twin:v1';

export function floorElevation(number) {
  if (!Number.isInteger(number) || number < 1 || number > FLOOR_COUNT) throw new RangeError('Invalid floor');
  return number === 1 ? 0 : number === 2 ? 5.4 : 9 + (number - 3) * 3.6;
}

export function floorPresentation(number, view) {
  if (!VIEW_MODES.includes(view)) throw new TypeError('Unknown view');
  floorElevation(number);
  return {
    visible: view !== 'office' || number === DETAILED_FLOOR,
    offsetY: ['exploded','office'].includes(view) ? (number > DETAILED_FLOOR ? 18 : number === DETAILED_FLOOR ? 3 : 0) : 0,
    offsetZ: ['exploded','office'].includes(view) && number === DETAILED_FLOOR ? 32 : 0,
    showFacade: number !== DETAILED_FLOOR || !['office', 'exploded'].includes(view),
  };
}

export function isTrustedHostMessage(event, parentWindow, ownOrigin) {
  return event.source === parentWindow && event.origin === ownOrigin && event.data &&
    typeof event.data === 'object' && event.data.namespace === PROTOCOL;
}

export const VIEW_COPY = Object.freeze({
  building: { label: 'H1 · 20 层', description: '20 层建筑示意；9 楼采用已描摹的办公室平面。' },
  exploded: { label: '展开 · 9F', description: '9 楼前移 32 米、抬高 3 米；上方楼层抬高 18 米。展开距离仅用于展示。' },
  office: { label: '9F · 办公室白模', description: '拖动旋转，滚轮缩放，右键平移。点击人物查看任务；示例任务均标注“演示”。' },
});
