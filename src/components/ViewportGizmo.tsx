/**
 * ViewportGizmo – small orientation cube in the corner of the 3D viewport.
 * Syncs rotation with the main scene camera so the user always knows
 * which axis is which (Front = Pan side, Back = Handle side).
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ViewportGizmoProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
}

const SIZE = 100; // px

const FACES = [
  { dir: new THREE.Vector3( 0,  0,  1), label: 'الأمام',  color: '#00e5ff', textColor: '#000' },
  { dir: new THREE.Vector3( 0,  0, -1), label: 'الخلف',  color: '#ff6b35', textColor: '#fff' },
  { dir: new THREE.Vector3( 0,  1,  0), label: 'فوق',    color: '#39ff14', textColor: '#000' },
  { dir: new THREE.Vector3( 0, -1,  0), label: 'تحت',    color: '#666',    textColor: '#fff' },
  { dir: new THREE.Vector3( 1,  0,  0), label: '+X',     color: '#ff3366', textColor: '#fff' },
  { dir: new THREE.Vector3(-1,  0,  0), label: '-X',     color: '#aa1133', textColor: '#fff' },
];

export const ViewportGizmo: React.FC<ViewportGizmoProps> = ({ cameraRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gizmoSceneRef = useRef<THREE.Scene | null>(null);
  const gizmoCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mini renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // Mini scene
    const scene = new THREE.Scene();
    gizmoSceneRef.current = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // Mini camera
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 0, 3);
    gizmoCameraRef.current = cam;

    // Axis lines
    const axesMat = (color: number) => new THREE.LineBasicMaterial({ color });
    const addAxis = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      scene.add(new THREE.Line(g, axesMat(color)));
    };
    addAxis(new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0), 0xff3366);
    addAxis(new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0), 0x39ff14);
    addAxis(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1), 0x00e5ff);

    // Face markers (small spheres)
    FACES.forEach(({ dir, color }) => {
      const geom = new THREE.SphereGeometry(0.18, 12, 12);
      geom.translate(dir.x * 0.9, dir.y * 0.9, dir.z * 0.9);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
      scene.add(new THREE.Mesh(geom, mat));
    });

    // Animate: sync rotation with main camera
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const mainCam = cameraRef.current;
      if (mainCam && gizmoCameraRef.current) {
        // Extract only the rotation quaternion from the main camera
        const q = mainCam.quaternion.clone();
        gizmoCameraRef.current.position.set(0, 0, 3).applyQuaternion(q);
        gizmoCameraRef.current.lookAt(0, 0, 0);
      }
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [cameraRef]);

  return (
    <div
      className="absolute bottom-16 right-4 z-20 select-none"
      style={{ width: SIZE, height: SIZE }}
      title="مكعب التوجيه — Front = المقلات، Back = المقبض"
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ borderRadius: 8, opacity: 0.9 }}
      />
      {/* Labels overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-0.5">
        <div className="flex gap-2 text-[7px] font-mono">
          <span className="text-cyan-400">Z=مقلات</span>
          <span className="text-orange-400">-Z=مقبض</span>
        </div>
      </div>
    </div>
  );
};

export default ViewportGizmo;
