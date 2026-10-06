import { useSyncExternalStore } from 'react';

export type AvatarMotionMode = 'on' | 'system' | 'off';
let mode: AvatarMotionMode = 'on';
const listeners = new Set<() => void>();
export function normalizeAvatarMotionMode(value: unknown): AvatarMotionMode {
  return value === 'off' || value === 'system' ? value : 'on';
}
export function setAvatarMotionMode(value: unknown) {
  const next = normalizeAvatarMotionMode(value);
  if (next === mode) return;
  mode = next;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useAvatarMotionMode() {
  return useSyncExternalStore(subscribe, () => mode, () => 'on' as AvatarMotionMode);
}
