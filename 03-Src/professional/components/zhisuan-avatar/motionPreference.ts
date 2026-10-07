/** Explicit Astra preference: all visible animated avatars play. */
export type AvatarMotionMode = 'on' | 'system' | 'off';
export function normalizeAvatarMotionMode(_value:unknown):AvatarMotionMode{return 'on';}
export function setAvatarMotionMode(_value:unknown){}
export function useAvatarMotionMode():AvatarMotionMode{return 'on';}
