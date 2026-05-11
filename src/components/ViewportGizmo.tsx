/**
 * ViewportGizmo – orientation cube in the corner of the 3D viewport.
 * Shows A-end (Pan/مقلاة) and B-end (Handle/مقبض) clearly.
 * Syncs rotation with the main scene camera.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ViewportGizmoProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
}

const SIZE = 120; // px

// Face definitions for orientation cube
const FACES: { dir: THREE.Vector3; label: string; color: string; labelColor: string }[] = [
  { dir: new THREE.Vector3( 0,  0,  1), label: 'A مقلاة', color: '#00e5ff', labelColor: '#000' },
  { dir: new THREE.Vector3( 0,  0, -1), label: 'B مقبض', color: '#ff6b35', labelColor: '#fff' },
  { dir: new THREE.Vector3( 0,  1,  0), label: 'فوق',    color: '#39ff14', labelColor: '#000' },
  { dir: new THREE.Vector3( 0, -1,  0), label: 'تحت',    color: '#444',    labelColor: '#888' },
  { dir: new THREE.Vector3( 1,  0,  0), label: '+X',     color: '#ff3366', labelColor: '#fff' },
  { dir: new THREE.Vector3(-1,  0,  0), label: '-X',     color: '#aa1133', labelColor: '#fff' },
];

// Create a canvas texture with text for a cube face
function makeTextTexture(text: string, bgColor: string, textColor: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const ViewportGizmo: React.FC<ViewportGizmoProps> = ({ cameraRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
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
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirL = new THREE.DirectionalLight(0xffffff, 0.5);
    dirL.position.set(2, 3, 2);
    scene.add(dirL);

    // Mini camera
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.set(0, 0, 3.5);
    gizmoCameraRef.current = cam;

    // Build cube with textured faces
    // THREE.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    const faceMap = [
      FACES[4], // +X
      FACES[5], // -X
      FACES[2], // +Y (فوق)
      FACES[3], // -Y (تحت)
      FACES[0], // +Z (A - مقلاة)
      FACES[1], // -Z (B - مقبض)
    ];

    const materials = faceMap.map(f =>
      new THREE.MeshStandardMaterial({
        map: makeTextTexture(f.label, f.color, f.labelColor),
        roughness: 0.5,
        metalness: 0.1,
      })
    );

    const cubeGeom = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const cubeMesh = new THREE.Mesh(cubeGeom, materials);
    scene.add(cubeMesh);

    // Edge wireframe for clarity
    const edges = new THREE.EdgesGeometry(cubeGeom);
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
    cubeMesh.add(edgeLine);

    // Animate: sync rotation with main camera
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const mainCam = cameraRef.current;
      if (mainCam && gizmoCameraRef.current) {
        const q = mainCam.quaternion.clone();
        gizmoCameraRef.current.position.set(0, 0, 3.5).applyQuaternion(q);
        gizmoCameraRef.current.lookAt(0, 0, 0);
      }
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      materials.forEach(m => { m.map?.dispose(); m.dispose(); });
      cubeGeom.dispose();
      edges.dispose();
    };
  }, [cameraRef]);

  return (
    <div
      className="absolute bottom-16 right-4 z-20 select-none"
      style={{ width: SIZE, height: SIZE }}
      title="مكعب التوجيه — A = المقلاة (أمام)، B = المقبض (خلف)"
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ borderRadius: 10, opacity: 0.95 }}
      />
      {/* Labels overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-1">
        <div className="flex gap-3 text-[8px] font-bold font-mono">
          <span className="text-cyan-400 bg-black/60 px-1 rounded">A=مقلاة</span>
          <span className="text-orange-400 bg-black/60 px-1 rounded">B=مقبض</span>
        </div>
      </div>
    </div>
  );
};

export default ViewportGizmo;
