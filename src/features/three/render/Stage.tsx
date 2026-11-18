// Sun, sky (day + blue hour), fog, environment lighting and post-processing.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { istDate, sunPosition } from '../sun';
import { shared } from './kit/materials';
import type { Built } from './build';
import { useRender } from './store';

export function nightFactor(elev: number) {
  return Math.min(1, Math.max(0, (3 - elev) / 9));
}

export function useSun(lat: number, lon: number) {
  const day = useRender((s) => s.day);
  const minutes = useRender((s) => s.minutes);
  return useMemo(() => {
    const s = sunPosition(istDate(day, minutes), lat, lon);
    return { ...s, night: nightFactor(s.elevation) };
  }, [day, minutes, lat, lon]);
}

const lerpC = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

const NIGHT_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const NIGHT_FS = `
uniform float uNight; uniform vec3 uSun; varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 top = vec3(0.035, 0.07, 0.17);
  vec3 mid = vec3(0.12, 0.2, 0.38);
  vec3 hor = vec3(0.34, 0.36, 0.5);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
  col = mix(col, top, smoothstep(0.18, 0.75, h));
  // Afterglow on the sunset side, fading as night deepens.
  vec2 sd = normalize(uSun.xz + 1e-4); vec2 dd = normalize(d.xz + 1e-4);
  float side = max(0.0, dot(sd, dd));
  float glow = pow(side, 3.0) * (1.0 - smoothstep(0.0, 0.25, h)) * (1.0 - smoothstep(0.55, 1.0, uNight));
  col += vec3(0.85, 0.42, 0.22) * glow * 0.8;
  // Sparse stars once it's properly dark.
  vec3 q = floor(d * 380.0);
  float st = step(0.9975, hash(q)) * smoothstep(0.7, 1.0, uNight) * smoothstep(0.1, 0.4, h);
  col += vec3(st);
  gl_FragColor = vec4(col, uNight);
  #include <colorspace_fragment>
}`;

function NightDome({ night, sunDir }: { night: number; sunDir: THREE.Vector3 }) {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: NIGHT_VS, fragmentShader: NIGHT_FS, uniforms: { uNight: { value: 0 }, uSun: { value: new THREE.Vector3() } }, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: true, fog: false }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  mat.uniforms.uNight.value = night;
  mat.uniforms.uSun.value.copy(sunDir);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  if (night <= 0.01) return null;
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[100, 32, 16]} />
    </mesh>
  );
}

export function Stage({ built, lat, lon }: { built: Built; lat: number; lon: number }) {
  const sun = useSun(lat, lon);
  const quality = useRender((s) => s.quality);
  const plan = useRender((s) => s.camera === 'plan');
  const { scene, invalidate } = useThree();
  const { ctx } = built;
  const size = ctx.size;
  const c = ctx.centre;
  const el = (Math.max(sun.elevation, -4) * Math.PI) / 180;
  const az = (sun.azimuth * Math.PI) / 180;
  const sunDir = useMemo(() => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize(), [az, el]);
  const nf = sun.night;
  // Moonlight from the north-east once the sun is down, so night shadows still read.
  const moonDir = useMemo(() => new THREE.Vector3(0.55, 0.62, -0.55).normalize(), []);
  const lightDir = nf > 0.6 ? moonDir : sunDir;
  const low = 1 - Math.min(1, Math.max(0, sun.elevation / 25));
  const sunCol = lerpC('#fff4e2', '#ffb070', low * (1 - nf));
  const lightCol = nf > 0.6 ? new THREE.Color('#9db4ff') : sunCol;
  const lightI = nf > 0.6 ? 0.32 : Math.max(0, Math.min(1, (sun.elevation + 1) / 6)) * 3.1;
  const hemiSky = nf > 0.5 ? lerpC('#8fa6dc', '#4a64a8', nf) : lerpC('#cfe2f5', '#f2c79a', low * 0.6);
  const hemiGround = nf > 0.5 ? '#1a2238' : '#5d5440';
  const hemiI = 0.9 - nf * 0.62;
  const fogCol = nf > 0.5 ? lerpC('#3c4d74', '#16213d', (nf - 0.5) * 2) : lerpC('#cbd9e6', '#e9c49c', low);
  const pos = useMemo(() => new THREE.Vector3(c.x, 0, -c.y).addScaledVector(lightDir, size * 1.6), [c, lightDir, size]);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = lightRef.current;
    if (!l) return;
    l.target.position.set(c.x, 0, -c.y);
    l.target.updateMatrixWorld();
    const s = size * 0.62;
    const cam = l.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = size * 4;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
  }, [c, size, pos, invalidate]);

  useEffect(() => {
    scene.fog = plan ? null : new THREE.Fog(fogCol, size * 1.4, size * 7);
    shared.night.value = nf;
    built.glowMats.forEach((m) => {
      (m as THREE.Material & { opacity: number }).opacity = nf * 0.95;
    });
    invalidate();
  }, [scene, fogCol, nf, size, built, invalidate, plan]);

  useFrame((_, dt) => {
    if (quality !== 'mobile') shared.time.value += dt;
  });

  const shadowSize = quality === 'mobile' ? 2048 : 4096;
  return (
    <>
      {nf < 0.98 && <Sky distance={450000} sunPosition={[sunDir.x, Math.max(sunDir.y, -0.05), sunDir.z]} turbidity={7} rayleigh={1.4 + low * 1.2} mieCoefficient={0.006} mieDirectionalG={0.82} />}
      <NightDome night={nf} sunDir={sunDir} />
      <hemisphereLight args={[hemiSky, hemiGround, hemiI]} />
      <directionalLight
        ref={lightRef}
        position={pos}
        color={lightCol}
        intensity={lightI}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.05}
        shadow-radius={4}
      />
      <Environment frames={1} resolution={128} environmentIntensity={0.55 - nf * 0.4}>
        <Lightformer form="rect" intensity={2} position={[0, 6, -8]} scale={[16, 4, 1]} color="#eef4ff" />
        <Lightformer form="rect" intensity={1.2} position={[-10, 3, 4]} rotation-y={Math.PI / 2} scale={[12, 3, 1]} color="#fff1dd" />
        <Lightformer form="ring" intensity={1.5} position={[8, 10, 6]} scale={4} color="#ffffff" />
        <mesh scale={100}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#9fb4c8" side={THREE.BackSide} />
        </mesh>
      </Environment>
    </>
  );
}

export function Effects({ night, dof }: { night: number; dof: boolean }) {
  const quality = useRender((s) => s.quality);
  const mobile = quality === 'mobile';
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes={mobile} quality={mobile ? 'performance' : 'high'} aoRadius={3} distanceFalloff={1} intensity={2.4} />
      {dof ? <DepthOfField focusDistance={0.02} focalLength={0.06} bokehScale={3} /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.25 + night * 1.15} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette eskil={false} offset={0.28} darkness={0.42} />
    </EffectComposer>
  );
}
