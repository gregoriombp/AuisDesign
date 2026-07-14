export type CopilotState =
  | "idle"
  | "listening"
  | "thinking"
  | "responding"
  | "error";

export type CopilotPreset = {
  speed: number;
  color1: string;
  color2: string;
  color3: string;
  scale: number;
  complexity: number;
  distortion: number;
  glowIntensity: number;
  flowFrequency: number;
  contrast: number;
  bg: string;
  /** Hue rotation (color sweep). Only `thinking` uses it — the texture shifts
   *  hue while the Copilot thinks. 0 = off. */
  hueSpeed?: number;
};

export const COPILOT_STATE_PRESETS: Record<CopilotState, CopilotPreset> = {
  idle: {
    speed: 0.1,
    color1: "#ffffff",
    color2: "#ffffff",
    color3: "#4f4f4f",
    scale: 2.8,
    complexity: 8,
    distortion: 1.6,
    glowIntensity: 0,
    flowFrequency: 2,
    contrast: 1.0,
    bg: "#000000",
  },
  listening: {
    speed: 0.16,
    color1: "#ffffff",
    color2: "#ffffff",
    color3: "#3a4a66",
    scale: 2.8,
    complexity: 8,
    distortion: 1.4,
    glowIntensity: 0,
    flowFrequency: 2,
    contrast: 1.0,
    bg: "#05080f",
  },
  // Thinking keeps the SAME controls as listening; what changes is the shape
  // (it morphs between geometric forms, via .au-copilot-think) and the hue
  // variation in the texture (hueSpeed).
  thinking: {
    speed: 0.16,
    color1: "#ffffff",
    color2: "#ffffff",
    color3: "#3a4a66",
    scale: 2.8,
    complexity: 8,
    distortion: 1.4,
    glowIntensity: 0,
    flowFrequency: 2,
    contrast: 1.0,
    bg: "#05080f",
    hueSpeed: 0.12,
  },
  responding: {
    speed: 0.2,
    color1: "#ffffff",
    color2: "#fff3df",
    color3: "#6b5230",
    scale: 2.8,
    complexity: 8,
    distortion: 1.6,
    glowIntensity: 0.06,
    flowFrequency: 2,
    contrast: 1.0,
    bg: "#0d0904",
  },
  error: {
    speed: 0.05,
    color1: "#f0d8d8",
    color2: "#b86060",
    color3: "#5a1010",
    scale: 2.8,
    complexity: 6,
    distortion: 1.2,
    glowIntensity: 0.2,
    flowFrequency: 2,
    contrast: 1.0,
    bg: "#160808",
  },
};
