import { useLayoutEffect, useRef } from 'react';
import { AvatarMotion } from './zhisuan-avatar/AvatarMotion';
import { useAvatarMotionMode } from './zhisuan-avatar/motionPreference';
import './ZhisuanAvatar.css';

export type ZhisuanAvatarState = 'idle' | 'listening' | 'thinking' | 'processing' | 'warning' | 'error' | 'success';
export type ZhisuanAvatarSize = 'compact' | 'normal' | 'large';
export interface ZhisuanAvatarProps {
  state?: ZhisuanAvatarState;
  animationEnabled?: boolean;
  welcome?: boolean;
  size?: ZhisuanAvatarSize;
  label?: string;
  className?: string;
}
const STATE_LABELS: Record<ZhisuanAvatarState, string> = {
  idle: '智算待命中', listening: '智算正在听取输入', thinking: '智算正在思考',
  processing: '智算正在处理', warning: '智算发现需复核项', error: '智算处理异常', success: '智算已完成',
};

export function ZhisuanAvatar({ state = 'idle', size = 'normal', label, className, animationEnabled = true, welcome = false }: ZhisuanAvatarProps) {
  const root = useRef<HTMLSpanElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const motion = useRef<AvatarMotion | null>(null);
  const mode = useAvatarMotionMode();
  const businessBusy = state === 'thinking' || state === 'processing';
  const canAnimate = false; // Astra owns the one visible Gork in the conversation.
  useLayoutEffect(() => {
    const element = root.current!;
    const controller = new AvatarMotion(svg.current!, welcome ? 'idle' : state, welcome);
    motion.current = controller;
    const welcomeScreen = welcome ? element.closest('.welcome-screen') : null;
    const follow = (event: Event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== 'mouse') return;
      const rect = element.getBoundingClientRect();
      controller.setPointer((pointer.clientX - rect.left - rect.width / 2) / 240, (pointer.clientY - rect.top - rect.height / 2) / 200);
    };
    const resetGaze = () => controller.setPointer(null);
    welcomeScreen?.addEventListener('pointermove', follow);
    welcomeScreen?.addEventListener('pointerleave', resetGaze);
    const entry = welcome ? element.closest('.welcome-screen')?.querySelector('.welcome-primary') : null;
    let hovered = false;
    let focused = false;
    const guide = () => {
      if ((hovered || focused) && entry) {
        const target = entry.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        controller.setEntryGuide(true, (target.left + target.width / 2 - rect.left - rect.width / 2) / 240, (target.top + target.height / 2 - rect.top - rect.height / 2) / 200);
      } else controller.setEntryGuide(false);
    };
    const enter = () => { hovered = true; guide(); };
    const leave = () => { hovered = false; guide(); };
    const focus = () => { focused = true; guide(); };
    const blur = () => { focused = false; guide(); };
    entry?.addEventListener('pointerenter', enter);
    entry?.addEventListener('pointerleave', leave);
    entry?.addEventListener('focus', focus);
    entry?.addEventListener('blur', blur);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intersects = false;
    const update = () => {
      const visible = intersects && !document.hidden && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      controller.setActivity(visible, !canAnimate || mode === 'off' || (mode === 'system' && media.matches));
    };
    const intersection = new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting;
      update();
    });
    intersection.observe(element);
    const resize = new ResizeObserver(update);
    resize.observe(element);
    // CSS-hidden ancestors can remain mounted; observe only visibility attributes.
    const visibility = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      visibility.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    return () => {
      welcomeScreen?.removeEventListener('pointermove', follow);
      welcomeScreen?.removeEventListener('pointerleave', resetGaze);
      entry?.removeEventListener('pointerenter', enter);
      entry?.removeEventListener('pointerleave', leave);
      entry?.removeEventListener('focus', focus);
      entry?.removeEventListener('blur', blur);
      intersection.disconnect();
      resize.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
      controller.destroy();
      motion.current = null;
    };
  // Recreate the controller when its implementation changes during Vite hot updates.
  }, [mode, canAnimate, welcome, AvatarMotion]);
  useLayoutEffect(() => { motion.current?.setState(welcome ? 'idle' : state); }, [state, welcome]);

  const stateLabel = label ?? STATE_LABELS[state];
  return (
    <span ref={root} className={['zhisuan-avatar', `zhisuan-avatar--${size}`, className].filter(Boolean).join(' ')}
      data-state={state} data-motion={mode} role={welcome ? 'button' : 'img'} aria-label={welcome ? '和智算打个招呼' : stateLabel} title={welcome ? '点一下，和智算打个招呼' : stateLabel}
      tabIndex={welcome ? 0 : undefined}
      onClick={welcome ? () => motion.current?.greet() : undefined}
      onKeyDown={welcome ? event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) motion.current?.greet(); }
      } : undefined}
      onPointerMove={event => {
        if (event.pointerType !== 'mouse') return;
        const rect = event.currentTarget.getBoundingClientRect();
        motion.current?.setPointer((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
      }}
      onPointerLeave={() => motion.current?.setPointer(null)}
      onPointerCancel={() => motion.current?.setPointer(null)}>
      <svg ref={svg} className="zhisuan-avatar__svg" viewBox="-15 -15 259 259" fill="none" aria-hidden="true" />
      {['warning', 'error', 'success'].includes(state) && (
        <svg className="zhisuan-avatar__badge" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" />
          <path d={state === 'success' ? 'M4 8l2.5 2.5L12 5' : state === 'error' ? 'M5 5l6 6M11 5l-6 6' : 'M8 3.5v5M8 11v.5'} />
        </svg>
      )}
    </span>
  );
}
export default ZhisuanAvatar;
