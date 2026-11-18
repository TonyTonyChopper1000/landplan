// Aerial (orbit), Arrival (cinematic drive), Plan (top-down ortho) and Walk (first person).
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import type { SceneCtx } from './kit/ctx';
import { reducedMotion, useRender } from './store';

/** Joystick / keyboard input shared with the DOM overlay. */
export const walkInput = { x: 0, y: 0, yaw: 0, pitch: 0 };

const v = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

export function arrivalCurve(ctx: SceneCtx): THREE.CatmullRomCurve3 {
  const pts = ctx.arrival.map((p, i) => v(p.x, p.y, i < 3 ? 2.4 : 2.2));
  const g = ctx.gardens.find((x) => !/club|hall|commons/i.test(x.name)) ?? ctx.gardens[0];
  const last = ctx.arrival[ctx.arrival.length - 1] ?? ctx.gate.p;
  const goal = g?.p ?? ctx.centre;
  const mid = { x: (last.x + goal.x) / 2, y: (last.y + goal.y) / 2 };
  pts.push(v(mid.x, mid.y, 6), v(goal.x - ctx.gate.inward.x * 25, goal.y - ctx.gate.inward.y * 25, 18));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);
}

export function aerialPose(ctx: SceneCtx): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const s = ctx.size;
  const out = { x: -ctx.gate.inward.x, y: -ctx.gate.inward.y };
  // From the entrance side, slightly off-axis, like a brochure hero shot.
  const dir = new THREE.Vector3(out.x * 0.85 + ctx.gate.tangent.x * 0.5, 0, -(out.y * 0.85 + ctx.gate.tangent.y * 0.5)).normalize();
  const target = v(ctx.centre.x, ctx.centre.y, 0);
  return { pos: target.clone().addScaledVector(dir, s * 0.62).add(new THREE.Vector3(0, s * 0.42, 0)), target };
}

export function Cameras({ ctx, onFilmEnd }: { ctx: SceneCtx; onFilmEnd?: () => void }) {
  const mode = useRender((s) => s.camera);
  const filming = useRender((s) => s.filming);
  const focus = useRender((s) => s.focus);
  const set = useRender((s) => s.set);
  const { invalidate, size: vp, get } = useThree();
  const orbit = useRef<OrbitImpl>(null);
  const curve = useMemo(() => arrivalCurve(ctx), [ctx]);
  const pose = useMemo(() => aerialPose(ctx), [ctx]);
  const anim = useRef<{ t0: number; from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; dur: number } | null>(null);
  const clock = useRef(0);
  const s = ctx.size;

  const recenter = useRender((s) => s.recenter);
  // Initial aerial pose (and Recenter).
  useEffect(() => {
    const camera = get().camera;
    if (mode !== 'aerial') return;
    if (!anim.current || recenter) {
      anim.current = null;
      camera.position.copy(pose.pos);
      orbit.current?.target.copy(pose.target);
      orbit.current?.update();
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pose, recenter]);

  // Fly to a plot (Find a plot / deep link / click).
  useEffect(() => {
    if (!focus) return;
    const camera = get().camera;
    const p = ctx.layout.plots.find((q) => q.no === focus.no);
    if (!p) return;
    if (mode !== 'aerial' && mode !== 'plan') set({ camera: 'aerial' });
    const tt = v(p.centroid.x, p.centroid.y, 0);
    const back = new THREE.Vector3(-ctx.gate.inward.x, 0, ctx.gate.inward.y).normalize();
    const to = tt.clone().addScaledVector(back, 42).add(new THREE.Vector3(0, 46, 0));
    const tf = orbit.current?.target.clone() ?? pose.target.clone();
    if (reducedMotion()) {
      camera.position.copy(to);
      orbit.current?.target.copy(tt);
      orbit.current?.update();
    } else anim.current = { t0: clock.current, from: camera.position.clone(), to, tf, tt, dur: 1.4 };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Arrival + film playback.
  const play = useRef<{ t0: number; phase: 'drive' | 'orbit' } | null>(null);
  useEffect(() => {
    const camera = get().camera;
    if (mode === 'arrival' || filming) {
      if (reducedMotion() && !filming) {
        const end = curve.getPointAt(1);
        camera.position.copy(end);
        camera.lookAt(v(ctx.centre.x, ctx.centre.y, 0));
        set({ camera: 'aerial' });
        return;
      }
      play.current = { t0: clock.current, phase: 'drive' };
    } else play.current = null;
    if (mode === 'walk') {
      const g = ctx.gate;
      const p = { x: g.p.x + g.inward.x * 8, y: g.p.y + g.inward.y * 8 };
      camera.position.set(p.x, 1.6, -p.y);
      walkInput.yaw = Math.atan2(-g.inward.x, g.inward.y);
      walkInput.pitch = 0;
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filming]);

  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      keys.current.add(e.key.toLowerCase());
      invalidate();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [invalidate]);

  useFrame(({ camera }, dt) => {
    clock.current += Math.min(dt, 0.1);
    const t = clock.current;
    const a = anim.current;
    if (a) {
      const k = Math.min(1, (t - a.t0) / a.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(a.from, a.to, e);
      camera.position.y += Math.sin(k * Math.PI) * s * 0.08;
      const tg = a.tf.clone().lerp(a.tt, e);
      orbit.current?.target.copy(tg);
      camera.lookAt(tg);
      if (k >= 1) anim.current = null;
      invalidate();
    }
    const pl = play.current;
    if (pl) {
      const dur = 16;
      if (pl.phase === 'drive') {
        const k = Math.min(1, (t - pl.t0) / dur);
        const e = k * k * (3 - 2 * k) * 0.7 + k * 0.3;
        const p = curve.getPointAt(e);
        const look = curve.getPointAt(Math.min(1, e + 0.06));
        look.y = Math.max(0.5, look.y - 1.2 - e * 8);
        camera.position.copy(p);
        camera.lookAt(look);
        if (k >= 1) {
          if (filming) {
            pl.phase = 'orbit';
            pl.t0 = t;
          } else {
            play.current = null;
            orbit.current?.target.set(ctx.centre.x, 0, -ctx.centre.y);
            set({ camera: 'aerial' });
          }
        }
      } else {
        const k = Math.min(1, (t - pl.t0) / 12);
        const ang = k * Math.PI * 1.2 + Math.atan2(pose.pos.z - pose.target.z, pose.pos.x - pose.target.x);
        const r = s * (0.55 + 0.1 * Math.sin(k * Math.PI));
        camera.position.set(pose.target.x + Math.cos(ang) * r, s * (0.3 + 0.12 * k), pose.target.z + Math.sin(ang) * r);
        camera.lookAt(pose.target);
        if (k >= 1) {
          play.current = null;
          set({ filming: false, camera: 'aerial' });
          onFilmEnd?.();
        }
      }
      invalidate();
    }
    if (mode === 'walk') {
      const k = keys.current;
      let f = walkInput.y;
      let r = walkInput.x;
      if (k.has('w') || k.has('arrowup')) f += 1;
      if (k.has('s') || k.has('arrowdown')) f -= 1;
      if (k.has('d')) r += 1;
      if (k.has('a')) r -= 1;
      if (k.has('arrowleft')) walkInput.yaw += dt * 1.6;
      if (k.has('arrowright')) walkInput.yaw -= dt * 1.6;
      const speed = (k.has('shift') ? 9 : 4.2) * dt;
      const yaw = walkInput.yaw;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      camera.position.addScaledVector(fwd, f * speed).addScaledVector(right, r * speed);
      camera.position.y = 1.6;
      camera.rotation.set(walkInput.pitch, yaw, 0, 'YXZ');
      if (f || r || k.size) invalidate();
    }
  });

  const plan = mode === 'plan';
  const b = ctx.layout.bounds;
  const zoom = Math.min(vp.width / (b.x1 - b.x0 + 60), vp.height / (b.y1 - b.y0 + 60));
  return (
    <>
      <PerspectiveCamera makeDefault={!plan} fov={mode === 'walk' ? 62 : 38} near={0.5} far={s * 30 + 4000} position={pose.pos} />
      {plan && (
        <>
          <OrthographicCamera makeDefault position={[ctx.centre.x, 800, -ctx.centre.y]} zoom={zoom} near={1} far={3000} up={[0, 0, -1]} onUpdate={(c) => c.lookAt(ctx.centre.x, 0, -ctx.centre.y)} />
          <MapControls makeDefault target={[ctx.centre.x, 0, -ctx.centre.y]} enableRotate={false} screenSpacePanning />
        </>
      )}
      {mode === 'aerial' && !filming && <OrbitControls ref={orbit} makeDefault target={pose.target} maxPolarAngle={Math.PI / 2.08} minDistance={8} maxDistance={s * 3} enableDamping dampingFactor={0.12} />}
    </>
  );
}
