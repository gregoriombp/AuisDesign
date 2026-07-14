"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uScale;
  uniform float uComplexity;
  uniform float uDistortion;
  uniform float uGlowIntensity;
  uniform float uFlowFrequency;
  uniform float uContrast;
  uniform float uHueShift;

  mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
  }

  vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    float minRes = min(uResolution.x, uResolution.y);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / minRes;

    vec2 p = uv * uScale;
    float t = uTime;

    for(float i = 1.0; i < 20.0; i++) {
        if(i >= uComplexity) break;
        p *= rot(t * 0.08 + i * 0.15);
        p += vec2(
            sin(p.x * i + t),
            cos(p.x * i - t)
        ) * (uDistortion / i);
    }

    float flow1 = 0.5 + 0.5 * sin(p.x * (uFlowFrequency * 0.8) + t);
    float flow2 = 0.5 + 0.5 * sin(p.y * uFlowFrequency + t * 1.1);

    vec3 color = mix(uColor1, uColor2, flow1);
    color = mix(color, uColor3, flow2);

    float dist = length(uv);
    float glow = exp(-dist * 1.5);
    color += uColor3 * glow * uGlowIntensity;

    color = smoothstep(0.0, uContrast, color);

    if (uHueShift != 0.0) {
        vec3 hsv = rgb2hsv(color);
        hsv.x = fract(hsv.x + uHueShift);
        color = hsv2rgb(hsv);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface AuCopilotSynthesisProps {
  className?: string;
  style?: React.CSSProperties;
  speed?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  scale?: number;
  complexity?: number;
  distortion?: number;
  glowIntensity?: number;
  flowFrequency?: number;
  contrast?: number;
  /** Hue rotation speed (cycles of raw time). 0 = off (the standard). >0 = rainbow sweep. */
  hueSpeed?: number;
  backgroundColor?: string;
}

const Effect = ({
  speed,
  color1,
  color2,
  color3,
  scale,
  complexity,
  distortion,
  glowIntensity,
  flowFrequency,
  contrast,
  hueSpeed,
}: Required<Omit<AuCopilotSynthesisProps, "className" | "style" | "backgroundColor">>) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Uniforms are created ONCE, then mutated by ref (useEffect on prop change +
  // useFrame per frame) — the ShaderMaterial binds to these stable cells. Empty
  // deps are intentional; recreating would detach the binding and reset time.
  const uniforms = useMemo(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uColor3: { value: new THREE.Color(color3) },
      uScale: { value: scale },
      uComplexity: { value: complexity },
      uDistortion: { value: distortion },
      uGlowIntensity: { value: glowIntensity },
      uFlowFrequency: { value: flowFrequency },
      uContrast: { value: contrast },
      uHueShift: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uColor1.value.set(color1);
    materialRef.current.uniforms.uColor2.value.set(color2);
    materialRef.current.uniforms.uColor3.value.set(color3);
    materialRef.current.uniforms.uScale.value = scale;
    materialRef.current.uniforms.uComplexity.value = complexity;
    materialRef.current.uniforms.uDistortion.value = distortion;
    materialRef.current.uniforms.uGlowIntensity.value = glowIntensity;
    materialRef.current.uniforms.uFlowFrequency.value = flowFrequency;
    materialRef.current.uniforms.uContrast.value = contrast;
  }, [
    color1,
    color2,
    color3,
    scale,
    complexity,
    distortion,
    glowIntensity,
    flowFrequency,
    contrast,
  ]);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value =
      state.clock.getElapsedTime() * speed;
    // Hue rotation runs off raw time so it's independent of flow `speed`.
    materialRef.current.uniforms.uHueShift.value =
      state.clock.getElapsedTime() * hueSpeed;
    materialRef.current.uniforms.uResolution.value.set(
      state.size.width,
      state.size.height,
    );
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export function AuCopilotSynthesis({
  className,
  style,
  speed = 0.1,
  color1 = "#ffffff",
  color2 = "#ffffff",
  color3 = "#4f4f4f",
  scale = 2.8,
  complexity = 8,
  distortion = 1.6,
  glowIntensity = 0,
  flowFrequency = 2,
  contrast = 1.0,
  hueSpeed = 0,
  backgroundColor = "#000000",
}: AuCopilotSynthesisProps) {
  // Every Canvas is a WebGL context, and the browser only keeps ~16 alive. On
  // pages with many orbs (styleguide, lists) the oldest ones were dropped and
  // the preview went black (looked "broken"). Fix: only mount the Canvas when
  // the orb is near the viewport — outside it, just the background renders and
  // no context is held. Keeps the live context count under control.
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-none overflow-hidden",
        className,
      )}
      style={{ backgroundColor, ...style }}
    >
      {inView && (
        <Canvas
          camera={{ position: [0, 0, 1] }}
          dpr={1}
          gl={{ antialias: false, powerPreference: "high-performance" }}
        >
          <Effect
            speed={speed}
            color1={color1}
            color2={color2}
            color3={color3}
            scale={scale}
            complexity={complexity}
            distortion={distortion}
            glowIntensity={glowIntensity}
            flowFrequency={flowFrequency}
            contrast={contrast}
            hueSpeed={hueSpeed}
          />
        </Canvas>
      )}
    </div>
  );
}
