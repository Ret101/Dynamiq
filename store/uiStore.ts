/**
 * UI store: active panels, selected hardpoints, viewer state, animation.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type AppMode = 'suspension' | 'cvt';

export type Panel =
  | 'project'
  | 'hardpoints'
  | 'kinematics'
  | 'plots'
  | 'tire'
  | 'spring_damper'
  | 'load_transfer'
  | 'optimization'
  | 'steering'
  | 'export';

export type ViewerMode = '3d' | 'front' | 'side' | 'top';
export type AnimationMode = 'none' | 'bump' | 'roll' | 'pitch' | 'steer' | 'combined';
export type SelectedCorner = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight' | 'all';

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface UIStore {
  // App mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Panel state
  activePanel: Panel;
  openPanels: Set<Panel>;

  // Viewer
  viewerMode: ViewerMode;
  showChassisPickups: boolean;
  showArmLines: boolean;
  showInstantCenters: boolean;
  showRollCenter: boolean;
  showContactPatches: boolean;
  showWheels: boolean;
  showGround: boolean;
  showChassis: boolean;
  transparency: number;   // 0-1 chassis opacity

  // Selection
  selectedHardpointId: string | null;
  selectedCorner: SelectedCorner;
  hoveredHardpointId: string | null;

  // Animation
  animationMode: AnimationMode;
  animationPlaying: boolean;
  animationTime: number;   // 0-1 normalized
  animationSpeed: number;  // multiplier

  // Live scrubber
  heave: number;    // mm
  roll: number;     // deg
  pitch: number;    // deg
  steerAngle: number; // deg

  // Camera
  camera: CameraState;

  // Theme
  darkMode: boolean;

  // Hardpoint keyboard editing
  hardpointMoveStep: number;   // mm per arrow-key press
  setHardpointMoveStep: (v: number) => void;

  // Actions
  setActivePanel: (panel: Panel) => void;
  togglePanel: (panel: Panel) => void;
  setViewerMode: (mode: ViewerMode) => void;
  toggleVisibility: (key: VisibilityKey) => void;
  setTransparency: (v: number) => void;
  selectHardpoint: (id: string | null) => void;
  hoverHardpoint: (id: string | null) => void;
  setSelectedCorner: (corner: SelectedCorner) => void;
  setAnimation: (mode: AnimationMode) => void;
  setAnimationPlaying: (playing: boolean) => void;
  setAnimationTime: (t: number) => void;
  setAnimationSpeed: (s: number) => void;
  setHeave: (v: number) => void;
  setRoll: (v: number) => void;
  setPitch: (v: number) => void;
  setSteerAngle: (v: number) => void;
  setCamera: (camera: Partial<CameraState>) => void;
  toggleDarkMode: () => void;
}

type VisibilityKey =
  | 'showChassisPickups'
  | 'showArmLines'
  | 'showInstantCenters'
  | 'showRollCenter'
  | 'showContactPatches'
  | 'showWheels'
  | 'showGround'
  | 'showChassis';

export const useUIStore = create<UIStore>()(
  immer((set) => ({
    appMode: 'suspension',
    setAppMode: (mode) => set((state) => { state.appMode = mode; }),

    activePanel: 'hardpoints',
    openPanels: new Set(['hardpoints', 'kinematics']),

    viewerMode: '3d',
    showChassisPickups: true,
    showArmLines: true,
    showInstantCenters: true,
    showRollCenter: true,
    showContactPatches: true,
    showWheels: true,
    showGround: true,
    showChassis: true,
    transparency: 0.3,

    hardpointMoveStep: 1,

    selectedHardpointId: null,
    selectedCorner: 'all',
    hoveredHardpointId: null,

    animationMode: 'none',
    animationPlaying: false,
    animationTime: 0,
    animationSpeed: 1,

    heave: 0,
    roll: 0,
    pitch: 0,
    steerAngle: 0,

    camera: {
      position: [2000, -3000, 1500],
      target: [762, 0, 300],
      fov: 45,
    },

    darkMode: true,

    setHardpointMoveStep: (v) =>
      set((state) => { state.hardpointMoveStep = v; }),

    setActivePanel: (panel) =>
      set((state) => { state.activePanel = panel; }),

    togglePanel: (panel) =>
      set((state) => {
        if (state.openPanels.has(panel)) {
          state.openPanels.delete(panel);
        } else {
          state.openPanels.add(panel);
        }
      }),

    setViewerMode: (mode) =>
      set((state) => { state.viewerMode = mode; }),

    toggleVisibility: (key) =>
      set((state) => { (state as unknown as Record<string, boolean>)[key] = !(state as unknown as Record<string, boolean>)[key]; }),

    setTransparency: (v) =>
      set((state) => { state.transparency = v; }),

    selectHardpoint: (id) =>
      set((state) => { state.selectedHardpointId = id; }),

    hoverHardpoint: (id) =>
      set((state) => { state.hoveredHardpointId = id; }),

    setSelectedCorner: (corner) =>
      set((state) => { state.selectedCorner = corner; }),

    setAnimation: (mode) =>
      set((state) => { state.animationMode = mode; state.animationPlaying = false; state.animationTime = 0; }),

    setAnimationPlaying: (playing) =>
      set((state) => { state.animationPlaying = playing; }),

    setAnimationTime: (t) =>
      set((state) => { state.animationTime = t; }),

    setAnimationSpeed: (s) =>
      set((state) => { state.animationSpeed = s; }),

    setHeave: (v) => set((state) => { state.heave = v; }),
    setRoll:  (v) => set((state) => { state.roll  = v; }),
    setPitch: (v) => set((state) => { state.pitch = v; }),
    setSteerAngle: (v) => set((state) => { state.steerAngle = v; }),

    setCamera: (camera) =>
      set((state) => { Object.assign(state.camera, camera); }),

    toggleDarkMode: () =>
      set((state) => { state.darkMode = !state.darkMode; }),
  }))
);
