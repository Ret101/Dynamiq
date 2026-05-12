'use client';

/**
 * CameraController — smooth camera transitions between 3D / Front / Side / Top views.
 *
 * Key design: the lerp STOPS once the transition completes. After that, OrbitControls
 * has full control so the user can freely orbit, zoom, and pan in 3D mode.
 *
 * Coordinate mapping (SAE → Three.js):
 *   ThX = SAE_X  (forward)
 *   ThY = SAE_Z  (up)
 *   ThZ = -SAE_Y (lateral)
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ViewerMode } from '@/store/uiStore';

const TARGET = new THREE.Vector3(0.762, 0.25, 0); // vehicle center

const CAMERA_POSES: Record<ViewerMode, { position: THREE.Vector3; fov: number }> = {
  '3d':    { position: new THREE.Vector3(-0.4, 1.4,  3.2), fov: 42 },
  'front': { position: new THREE.Vector3(-3.5, 0.28, 0  ), fov: 10 },
  'side':  { position: new THREE.Vector3(0.762, 0.35, 4 ), fov: 8  },
  'top':   { position: new THREE.Vector3(0.762, 5,   0  ), fov: 14 },
};

interface CameraControllerProps {
  viewerMode: ViewerMode;
  orbitRef: React.RefObject<OrbitControlsImpl>;
}

export function CameraController({ viewerMode, orbitRef }: CameraControllerProps) {
  const { camera } = useThree();
  const transitioning = useRef(false);
  const targetPos     = useRef(CAMERA_POSES['3d'].position.clone());
  const targetFov     = useRef(42);

  useEffect(() => {
    const pose = CAMERA_POSES[viewerMode];
    targetPos.current = pose.position.clone();
    targetFov.current = pose.fov;
    transitioning.current = true;

    const oc = orbitRef.current;
    if (!oc) return;

    // All view modes: snap to the preset pose, then release full orbit control
    oc.enableRotate    = true;
    oc.enableZoom      = true;
    oc.enablePan       = true;
    oc.minPolarAngle   = 0;
    oc.maxPolarAngle   = Math.PI * 0.85;
    oc.minAzimuthAngle = -Infinity;
    oc.maxAzimuthAngle =  Infinity;
    oc.minDistance     = 0.3;
    oc.maxDistance     = 25;
  }, [viewerMode, orbitRef]);

  useFrame(() => {
    // Only lerp during the transition window — do NOT override user input after done
    if (!transitioning.current) return;

    const cam = camera as THREE.PerspectiveCamera;
    const speed = 0.12;

    cam.position.lerp(targetPos.current, speed);
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov.current, speed);
    cam.updateProjectionMatrix();

    if (orbitRef.current) {
      orbitRef.current.target.lerp(TARGET, speed);
      orbitRef.current.update();
    }

    // Snap & stop when close enough
    const distOk = cam.position.distanceTo(targetPos.current) < 0.008;
    const fovOk  = Math.abs(cam.fov - targetFov.current) < 0.2;
    if (distOk && fovOk) {
      cam.position.copy(targetPos.current);
      cam.fov = targetFov.current;
      cam.updateProjectionMatrix();
      if (orbitRef.current) {
        orbitRef.current.target.copy(TARGET);
        orbitRef.current.update();
      }
      transitioning.current = false;
    }
  });

  return null;
}
