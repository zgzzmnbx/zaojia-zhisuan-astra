import { geometry, math, tables, poses, eyes } from './grok-study.js';
import type { ZhisuanAvatarState } from '../ZhisuanAvatar';

const MOODS: Record<ZhisuanAvatarState, string> = {
  idle: 'idle', listening: 'listening', thinking: 'thinking', processing: 'thinking',
  warning: 'suspicious', error: 'sad', success: 'happy',
};
const ns = 'http://www.w3.org/2000/svg';
const clamp = math.clamp;
const isBusy = (state: ZhisuanAvatarState) => state === 'thinking' || state === 'processing';

/** Original Grok blob/eyes renderer, with a bounded, business-driven lifecycle. */
export class AvatarMotion {
  private state: ZhisuanAvatarState;
  private active = false;
  private reduced = false;
  private frame = 0;
  private frameFallback = 0;
  private elapsed = 0;
  private last = 0;
  private stateAt = 0;
  private busyAt = 0;
  private greeted = false;
  private greetingAt = -Infinity;
  private guideToEntry = false;
  private entryGaze = { x: 0, y: 6 };
  private dots = [0, 1, 2].map(() => document.createElementNS(ns, 'circle'));
  private dotGroup = document.createElementNS(ns, 'g');
  private blinkAt = 5000;
  private eyeAt = 3000;
  private gazeAt = 1000;
  private eyeIndex = 0;
  private pointer: { x: number; y: number } | null = null;
  private context: Record<string, number | boolean> = {};
  private group = document.createElementNS(ns, 'g');
  private eyeGroup = document.createElementNS(ns, 'g');
  private eyeEls = [document.createElementNS(ns, 'path'), document.createElementNS(ns, 'path')];
  private currentEyes = geometry.eyes[0].map(poly => poly.map(p => [...p] as [number, number]));
  private fromEyes = this.currentEyes;
  private targetEyes = this.currentEyes;
  private springs = {
    spin: math.spring(0), x: math.spring(0), y: math.spring(0), squash: math.spring(1),
    blink: math.spring(1), gazeX: math.spring(0), gazeY: math.spring(0), morph: math.spring(1),
  };

  constructor(private svg: SVGSVGElement, state: ZhisuanAvatarState, private welcome = false) {
    this.state = state;
    svg.replaceChildren();
    const body = document.createElementNS(ns, 'path');
    body.setAttribute('d', geometry.shapes.blob.path);
    body.setAttribute('fill', 'var(--za-character-body)');
    this.group.append(body);
    for (const eye of this.eyeEls) {
      eye.setAttribute('fill', 'var(--za-character-eye)');
      this.eyeGroup.append(eye);
    }
    this.group.append(this.eyeGroup);
    this.dotGroup.setAttribute('class', 'zhisuan-avatar__thinking-dots');
    this.dotGroup.setAttribute('fill', 'var(--za-character-dot)');
    this.dots.forEach((dot, index) => {
      dot.setAttribute('cx', String(geometry.Re + (index - 1) * 32));
      dot.setAttribute('cy', String(geometry.Re));
      this.dotGroup.append(dot);
    });
    this.group.append(this.dotGroup);
    svg.append(this.group);
    this.setState(state, true);
  }

  setState(state: ZhisuanAvatarState, initial = false) {
    if (!initial && state === this.state) return;
    const wasBusy = isBusy(this.state);
    this.state = state;
    // Thinking and execution share one uninterrupted visual cycle.
    if (!initial && wasBusy && isBusy(state)) return;
    if (isBusy(state)) this.busyAt = this.elapsed;
    this.dotGroup.setAttribute('display', isBusy(state) ? 'inline' : 'none');
    this.stateAt = this.elapsed;
    this.context = { nodUntil: this.elapsed + 1800, nodEnd: 0, stAt: Infinity, impulseAt: Infinity };
    this.pointer = null;
    this.eyeIndex = 0;
    this.eyeAt = this.elapsed + 2800;
    this.blinkAt = this.elapsed + (this.state === 'idle' ? (this.welcome ? math.rand(2000, 4000) : math.rand(1800, 3200)) : math.rand(4000, 7000));
    this.gazeAt = this.elapsed;
    this.changeEyes(state === 'idle' || isBusy(state) ? 0 : tables.EYE_PLAYLIST[MOODS[state]][0]);
    // A hidden/reduced instance must show the latest state without replaying it later.
    if (!this.active || this.reduced || initial) this.renderStatic();
    else this.paint();
  }

  private changeEyes(index: number) {
    this.fromEyes = this.currentEyes;
    this.targetEyes = geometry.eyes[index];
    Object.assign(this.springs.morph, { x: 0, v: 0, t: 1 });
  }

  greet() {
    if (!this.welcome || !this.active || this.reduced) return;
    this.greetingAt = this.elapsed;
  }

  setEntryGuide(enabled: boolean, x = 0, y = 1) { this.guideToEntry = enabled; this.entryGaze = { x: clamp(x, -1, 1) * 24, y: clamp(y, -1, 1) * 18 }; }

  setPointer(x: number | null, y = 0) {
    this.pointer = this.active && !this.reduced && (this.state === 'idle' || this.state === 'listening') && x !== null
      ? { x: clamp(x, -1, 1) * (this.welcome ? 24 : 8), y: clamp(y, -1, 1) * (this.welcome ? 18 : 6) } : null;
    if (x === null) {
      this.springs.gazeX.t = 0;
      this.springs.gazeY.t = 0;
    }
  }

  setActivity(visible: boolean, reduced: boolean) {
    const active = visible && !reduced;
    const changed = active !== this.active || reduced !== this.reduced;
    this.reduced = reduced;
    if (!changed) return;
    this.active = active;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.frameFallback);
    this.frame = 0;
    this.pointer = null;
    this.greetingAt = -Infinity;
    this.renderStatic();
    // Resuming does not replay entry gestures or a backlog of blink/eye timers.
    this.stateAt = this.elapsed - 5000;
    this.blinkAt = this.elapsed + (this.state === 'idle' ? (this.welcome ? math.rand(2000, 4000) : math.rand(1800, 3200)) : math.rand(4000, 7000));
    this.eyeAt = this.elapsed + 2800;
    this.gazeAt = this.elapsed + 1000;
    if (active) {
      if (this.welcome && !this.greeted) {
        this.greeted = true;
        this.greet();
      }
      this.last = performance.now();
      this.scheduleFrame();
    }
  }

  private renderStatic() {
    for (const [key, spring] of Object.entries(this.springs)) {
      const value = ['squash', 'blink', 'morph'].includes(key) ? 1 : 0;
      Object.assign(spring, { x: value, v: 0, t: value });
    }
    if (this.state === 'idle') {
      Object.assign(this.springs.gazeX, { x: 6, t: 6 });
      Object.assign(this.springs.gazeY, { x: -4, t: -4 });
    }
    if (isBusy(this.state)) {
      Object.assign(this.springs.gazeY, { x: -6, t: -6 });
      Object.assign(this.springs.spin, { x: -2, t: -2 });
    }
    this.currentEyes = this.targetEyes;
    this.paint();
  }

  private scheduleFrame() {
    this.frame = requestAnimationFrame(this.tick);
    // Embedded browsers can suspend RAF while still reporting the page visible.
    // Race a bounded fallback; either callback cancels the other, never two loops.
    this.frameFallback = window.setTimeout(() => this.tick(performance.now()), 100);
  }

  private tick = (now: number) => {
    if (!this.active) return;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.frameFallback);
    const elapsedMs = Math.max(0, now - this.last);
    const dt = clamp(elapsedMs / 1000, 0, 0.05);
    this.last = now;
    // Only spring integration is clamped; expression timing follows real time.
    this.elapsed += elapsedMs;
    const age = (this.elapsed - this.stateAt) / 1000;
    const mood = MOODS[this.state];
    const pose = poses.applyPose(mood, this.elapsed / 1000, age, this.elapsed, this.context);
    const s = this.springs;
    s.spin.t = clamp(pose.spin, -4, 4);
    s.x.t = clamp(pose.tx, -4, 4);
    s.y.t = clamp(pose.ty, -4, 4);
    s.squash.t = clamp(pose.squash, 0.98, 1.02);
    if (['success', 'warning', 'error'].includes(this.state)) {
      const pulse = age < 0.8 ? Math.sin(age / 0.8 * Math.PI) : 0;
      s.spin.t = this.state === 'error' ? Math.sin(age * 24) * pulse * 4 : this.state === 'warning' ? -4 * pulse : 0;
      s.x.t = 0;
      s.y.t = this.state === 'success' ? pulse * 5 : 0;
      s.squash.t = 1;
    }
    if (this.elapsed >= this.eyeAt && !isBusy(this.state) && this.state !== 'idle' && !['success', 'warning', 'error'].includes(this.state)) {
      const playlist = tables.EYE_PLAYLIST[mood];
      this.eyeIndex = (this.eyeIndex + 1) % playlist.length;
      this.changeEyes(playlist[this.eyeIndex]);
      this.eyeAt = this.elapsed + math.rand(...tables.EYE_HOLD_MS[mood]);
    }
    const blinkAge = this.elapsed - this.blinkAt;
    s.blink.t = blinkAge >= 0 && blinkAge < 100 ? 0.05 : 1;
    if (blinkAge >= 300) this.blinkAt = this.elapsed + (this.state === 'idle' ? (this.welcome ? math.rand(2000, 4000) : math.rand(1800, 3200)) : math.rand(4000, 7000));
    if (this.elapsed >= this.gazeAt) {
      const gaze = this.state === 'idle'
        ? (math.rand(0, 1) < 0.8
          ? { x: math.rand(3, 7), y: math.rand(-6, -2), hold: [2500, 4500] }
          : { x: -8, y: 6, hold: [800, 1200] })
        : poses.nextGaze(mood);
      s.gazeX.t = clamp(gaze.x, -8, 8);
      s.gazeY.t = clamp(gaze.y, -6, 6);
      this.gazeAt = this.elapsed + math.rand(gaze.hold[0], gaze.hold[1]);
    }
    if (isBusy(this.state)) {
      s.spin.t = -1 + Math.sin((this.elapsed - this.busyAt) / 1000 * Math.PI / 2) * 3;
      s.x.t = 0;
      s.y.t = 0;
      s.gazeX.t = 0;
      s.gazeY.t = -6;
    }
    if (this.pointer) {
      s.gazeX.t = this.pointer.x;
      s.gazeY.t = this.pointer.y;
    }
    if (this.welcome) {
      if (this.pointer || this.guideToEntry) s.spin.t = clamp(s.gazeX.t / 6, -4, 4);
      const greetingAge = this.elapsed - this.greetingAt;
      if (greetingAge < 800) {
        s.spin.t = Math.sin(greetingAge / 800 * Math.PI) * -4;
        s.y.t = -Math.sin(greetingAge / 800 * Math.PI) * 4;
        s.blink.t = (greetingAge > 100 && greetingAge < 190) || (greetingAge > 340 && greetingAge < 430) ? 0.05 : 1;
      }
      if (this.guideToEntry) {
        s.gazeX.t = this.entryGaze.x;
        s.gazeY.t = this.entryGaze.y;
      }
    }
    const count = math.springSteps(dt);
    for (let i = 0; i < count; i++) {
      for (const [key, spring] of Object.entries(s)) {
        math.stepSpring(spring, key === 'blink' ? 40 : key === 'morph' ? 10 : 12, key === 'spin' ? 0.85 : 1, dt / count);
      }
    }
    this.currentEyes = this.fromEyes.map((poly, i) => math.lerpPoly(poly, this.targetEyes[i], clamp(s.morph.x, 0, 1)));
    this.paint();
    this.scheduleFrame();
  };

  private paint() {
    const s = this.springs;
    const R = geometry.Re;
    this.group.setAttribute('transform', `translate(${R + clamp(s.x.x, -5, 5)} ${R + clamp(s.y.x, -5, 5)}) rotate(${clamp(s.spin.x, -4, 4)}) scale(1 ${clamp(s.squash.x, 0.98, 1.02)}) translate(${-R} ${-R})`);
    const busy = isBusy(this.state);
    const animated = this.active && !this.reduced;
    const busyAge = this.elapsed - this.busyAt;
    this.dotGroup.setAttribute('display', busy ? 'inline' : 'none');
    // Busy entry immediately shows central dots, then alternates with eyes.
    const cycle = busyAge % 5200;
    const ease = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    const dotsBlend = !busy ? 0 : !animated ? 1
      : cycle < 2200 ? 1 : cycle < 2800 ? 1 - ease((cycle - 2200) / 600)
      : cycle < 4600 ? 0 : ease((cycle - 4600) / 600);
    this.dotGroup.setAttribute('opacity', String(dotsBlend));
    this.eyeGroup.setAttribute('opacity', String(1 - dotsBlend));
    this.dots.forEach((dot, index) => {
      const phase = ((busyAge / 1200 - index / 3) % 1 + 1) % 1;
      const pulse = busy && animated ? Math.pow((Math.cos(phase * Math.PI * 2) + 1) / 2, 3) : 0.6;
      dot.setAttribute('r', String(11 + pulse * 3));
      dot.setAttribute('opacity', String(0.6 + pulse * 0.4));
    });
    this.eyeGroup.setAttribute('transform', busy ? 'translate(0 -6)' : 'translate(0 0)');
    eyes.paintEyes({
      now: this.elapsed, polys: this.currentEyes, morphT: clamp(s.morph.x, 0, 1),
      shape: geometry.shapes.blob, face: geometry.shapes.blob.face,
      faceTune: tables.FACE_TUNE, uniformEyes: true, eyeScaleProp: 1,
      blinkX: s.blink.x, eyeBoostX: 1, gazeX: s.gazeX.x, gazeY: s.gazeY.x,
      winkAt: -Infinity, winkEye: 0, turn: null, cr: math.relRot(tables.POSE, tables.POSE_HOME),
      pointer: null, notifyX: 0, overlayX: 0, eyeEls: this.eyeEls, badgeEl: null,
      Re: R, G9e: geometry.G9e, VJt: geometry.VJt, extras: {}, emphasisBlend: 0,
    });
  }

  destroy() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.frameFallback);
    this.frame = 0;
    this.svg.replaceChildren();
  }
}
