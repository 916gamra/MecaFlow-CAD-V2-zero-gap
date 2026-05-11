import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls, STLExporter, STLLoader } from 'three-stdlib';
import { CSG } from 'three-csg-ts';
import { ZeroGapState, WizardStep } from '../types';
import { validateTubeConfig, validatePanConfig } from '../lib/validators';
import { performanceOptimizer } from '../lib/performanceOptimizer';
import { ViewportGizmo } from './ViewportGizmo';

interface ThreeCanvasProps {
  config: ZeroGapState;
  gridVisible: boolean;
  wizardStep: WizardStep;
}

export interface ThreeCanvasRef {
  exportSTL: () => void;
}

const ThreeCanvas = forwardRef<ThreeCanvasRef, ThreeCanvasProps>(({ config, gridVisible, wizardStep }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const exportMeshRef = useRef<THREE.Mesh | null>(null);
  const hasAutoCentered = useRef<boolean>(false);
  const lastStlName = useRef<string | undefined>(config.tube.customStlName);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── STL Export ──────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportSTL: () => {
      if (!exportMeshRef.current) return;
      const exporter = new STLExporter();
      const oldMat = exportMeshRef.current.material;
      exportMeshRef.current.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const stlString = exporter.parse(exportMeshRef.current);
      exportMeshRef.current.material = oldMat;
      const blob = new Blob([stlString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zero_gap_laser_export.stl';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }));

  // ─── Scene Initialization (runs once) ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // WebGL check
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    };
    if (!checkWebGL()) {
      setWebglError('يرجى تفعيل تسريع الأجهزة (Hardware Acceleration) في المتصفح.');
      return;
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090A0C);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(200, 150, 250);
    cameraRef.current = camera;

    // Renderer (with safe-mode fallback)
    let renderer: THREE.WebGLRenderer;
    const initRenderer = (safe: boolean) => {
      const origErr = console.error;
      const origWarn = console.warn;
      console.error = () => {};
      console.warn = () => {};
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !safe,
          alpha: true,
          powerPreference: safe ? 'default' : 'high-performance',
          precision: safe ? 'mediump' : 'highp',
        });
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
        renderer.shadowMap.enabled = !safe;
        containerRef.current!.appendChild(renderer.domElement);
        return renderer;
      } finally {
        console.error = origErr;
        console.warn = origWarn;
      }
    };

    try { renderer = initRenderer(false); }
    catch { try { renderer = initRenderer(true); } catch { setWebglError('خطأ فادح في WebGL.'); return; } }
    rendererRef.current = renderer!;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer!.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(100, 200, 100);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xaaccff, 0.8);
    dirLight2.position.set(-100, -50, -100);
    scene.add(dirLight2);

    // Grid & Axes
    const grid = new THREE.GridHelper(500, 50, 0x333333, 0x1a1a1a);
    grid.position.y = -0.1;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(100));

    // Animation loop
    const clock = new THREE.Clock();
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime() * 3;

      // Pulsing glow for green penetration zone
      const glowObj = scene.getObjectByName('zerogap_intersection_zone');
      if (glowObj && glowObj instanceof THREE.Mesh) {
        const mat = glowObj.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.0 + Math.sin(time) * 1.0;
        mat.opacity = 0.3 + Math.sin(time) * 0.15;
      }

      // Subtle pulse for the pan contact ring (now a Mesh, not LineSegments)
      const ringObj = scene.getObjectByName('zerogap_pan_ring');
      if (ringObj && ringObj instanceof THREE.Mesh) {
        const mat = ringObj.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.8 + Math.sin(time * 1.5) * 0.15;
      }

      controls.update();
      renderer!.render(scene, camera);
      performanceOptimizer.measureFPS();
    };
    animate();

    // Resize observer
    const resizeObs = new ResizeObserver(entries => {
      window.requestAnimationFrame(() => {
        if (!entries.length) return;
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0 && renderer && camera) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        }
      });
    });
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
      cancelAnimationFrame(animId);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  // ─── Geometry Engine (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || webglError) return;

    // Cheap operations: apply immediately (no debounce)
    const grid = scene.children.find(c => c instanceof THREE.GridHelper);
    if (grid) grid.visible = gridVisible;

    // Debounce the expensive CSG rebuild
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const scene = sceneRef.current; // Re-read inside timeout for safety
      if (!scene) return;

      // ── Validate inputs ──────────────────────────────────────────────────────
      const needsTube = wizardStep !== 'pan-design' && wizardStep !== 'handle-design';
      const needsPan  = wizardStep === 'pan-design' || wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut' || wizardStep === 'final-inspect';
      const needsHandle = wizardStep === 'handle-design' || wizardStep === 'tube-handle-cut' || wizardStep === 'final-inspect';
      const needsCSG = wizardStep === 'pan-tube-cut' || wizardStep === 'tube-handle-cut' || wizardStep === 'final-inspect';

      try {
        if (needsTube) validateTubeConfig(config.tube);
        if (needsPan)  validatePanConfig(config.pan);
      } catch (err: any) {
        console.warn('Validation:', err.message);
        return;
      }

      // ── Dispose previous 'zerogap_' objects ─────────────────────────────────
      const disposeDeep = (obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else if (obj.material) (obj.material as THREE.Material).dispose();
        }
        obj.children.forEach(disposeDeep);
      };
      const toRemove = scene.children.filter(c => c.name.startsWith('zerogap_'));
      toRemove.forEach(obj => { scene.remove(obj); disposeDeep(obj); });
      exportMeshRef.current = null;

      try {
        // ── 1. Pan — Solid + Shell (hollow with wall thickness) ───────────
        const wt = config.pan.wallThickness || 2.0;
        const rBottom = config.pan.innerMoldMode
          ? config.pan.bottomDiameter / 2 + wt
          : config.pan.bottomDiameter / 2;
        const rTop = config.pan.innerMoldMode
          ? config.pan.topDiameter / 2 + wt
          : config.pan.topDiameter / 2;
        const panH = config.pan.height;
        const rimThick = config.pan.rimThickness || 2.0;
        const curveRad = config.pan.curveRadius ?? 100.0;
        const filletR = config.pan.bottomFilletRadius || 8.0;
        const addRim = config.pan.addRim;
        const rimH = config.pan.rimHeight || 3.0;

        const buildPanProfile = (rOff: number): THREE.Vector2[] => {
          const rb = Math.max(1, rBottom - rOff);
          const rt = Math.max(1, rTop - rOff);
          const fR = Math.max(0, filletR - rOff);
          const p: THREE.Vector2[] = [];

          if (config.pan.removeBottom) {
            // إزالة القاع = شكل إناء/وعاء بجدران مستقيمة من الأسفل
            // نبدأ من أعلى الجدار فقط — بدون قاع أو تقوس أسفل
            p.push(new THREE.Vector2(rb, rOff > 0 ? wt : 0));
          } else {
            // مع القاع: نقطة المركز + قوس الفيليه
            p.push(new THREE.Vector2(0, rOff > 0 ? wt : 0));
            if (fR > 0) {
              const segs = 16;
              for (let i = 0; i <= segs; i++) {
                const theta = (Math.PI / 2) * (1 - i / segs);
                p.push(new THREE.Vector2(rb - fR + fR * Math.cos(theta), (rOff > 0 ? wt : 0) + fR - fR * Math.sin(theta)));
              }
            } else {
              p.push(new THREE.Vector2(rb, rOff > 0 ? wt : 0));
            }
          }

          const startZ = config.pan.removeBottom ? (rOff > 0 ? wt : 0) : ((rOff > 0 ? wt : 0) + fR);
          const bulgeReduction = rOff >= wt ? rOff * 0.3 : 0;
          const bulge = Math.max(1.0, Math.min(20.0, (200.0 / curveRad) * 4.0) - bulgeReduction);
          const rM = (rb + rt) / 2.0 + bulge;
          const zM = (startZ + panH) / 2.0;
          const cpx = 2 * rM - 0.5 * rb - 0.5 * rt;
          const cpy = 2 * zM - 0.5 * startZ - 0.5 * panH;
          const c = new THREE.QuadraticBezierCurve(
            new THREE.Vector2(rb, startZ), new THREE.Vector2(cpx, cpy), new THREE.Vector2(rt, panH)
          );
          p.push(...c.getPoints(32).slice(1));
          if (addRim && rOff === 0) {
            p.push(new THREE.Vector2(rt + rimThick, panH));
            p.push(new THREE.Vector2(rt + rimThick, panH + rimH));
            p.push(new THREE.Vector2(0, panH + rimH));
          } else {
            p.push(new THREE.Vector2(rt + (rOff === 0 ? rimThick : 0), panH));
            p.push(new THREE.Vector2(0, panH));
          }
          return p.filter((pt, i) => i === 0 || !pt.equals(p[i - 1]));
        };

        // Build pan meshes only when needed
        let panGeom: THREE.LatheGeometry | null = null;
        let panMesh: THREE.Mesh | null = null;
        let panInnerGeom: THREE.LatheGeometry | null = null;
        let panInnerMesh: THREE.Mesh | null = null;

        if (needsPan) {
          const outerPts = buildPanProfile(0);
          panGeom = new THREE.LatheGeometry(outerPts, 64);
          panMesh = new THREE.Mesh(panGeom, new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
          panMesh.name = 'zerogap_pan';

          const innerPts = buildPanProfile(wt);
          panInnerGeom = new THREE.LatheGeometry(innerPts, 64);
          panInnerMesh = new THREE.Mesh(panInnerGeom, new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
          panInnerMesh.name = 'zerogap_pan_inner';
        }

        // ── HANDLE-ONLY STEP: Show handle mesh isolated ──────────────────────
        if (wizardStep === 'handle-design') {
          const hCfg = config.handle;
          let handleGeom: THREE.BufferGeometry;
          if (hCfg.shape === 'cylindrical') {
            // أسطوانة مجوّفة (أنبوب دائري)
            const outerR = hCfg.width / 2;
            const innerR = Math.max(1, outerR - hCfg.thickness);
            const outerCyl = new THREE.CylinderGeometry(outerR, outerR, hCfg.depth, 32, 1, true);
            const innerCyl = new THREE.CylinderGeometry(innerR, innerR, hCfg.depth, 32, 1, true);
            // Top and bottom caps (annular rings)
            const topRing = new THREE.RingGeometry(innerR, outerR, 32);
            topRing.rotateX(-Math.PI / 2);
            topRing.translate(0, hCfg.depth / 2, 0);
            const bottomRing = new THREE.RingGeometry(innerR, outerR, 32);
            bottomRing.rotateX(Math.PI / 2);
            bottomRing.translate(0, -hCfg.depth / 2, 0);
            try {
              handleGeom = BufferGeometryUtils.mergeGeometries([outerCyl, innerCyl, topRing, bottomRing], false);
            } catch {
              handleGeom = outerCyl;
            }
            handleGeom.rotateX(Math.PI / 2);
          } else {
            // مستطيل مجوّف
            const hw = hCfg.width, hh = hCfg.height, hd = hCfg.depth;
            const hr = Math.min(hCfg.cornerRadius, hw / 2, hh / 2);
            const hShape = new THREE.Shape();
            const hx = -hw / 2, hy = -hh / 2;
            if (hr > 0) {
              hShape.moveTo(hx + hr, hy);
              hShape.lineTo(hx + hw - hr, hy);
              hShape.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr);
              hShape.lineTo(hx + hw, hy + hh - hr);
              hShape.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh);
              hShape.lineTo(hx + hr, hy + hh);
              hShape.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr);
              hShape.lineTo(hx, hy + hr);
              hShape.quadraticCurveTo(hx, hy, hx + hr, hy);
            } else {
              hShape.moveTo(hx, hy); hShape.lineTo(hx + hw, hy);
              hShape.lineTo(hx + hw, hy + hh); hShape.lineTo(hx, hy + hh); hShape.closePath();
            }
            // تجويف (hole) — المقبض دائماً مجوّف
            const it = hCfg.thickness;
            if (it > 0 && it < hw / 2 && it < hh / 2) {
              const ir = Math.max(0, hr - it);
              const ix = hx + it, iy = hy + it;
              const iw = hw - 2 * it, ih = hh - 2 * it;
              const hole = new THREE.Path();
              if (ir > 0) {
                hole.moveTo(ix + ir, iy); hole.lineTo(ix + iw - ir, iy);
                hole.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ir);
                hole.lineTo(ix + iw, iy + ih - ir);
                hole.quadraticCurveTo(ix + iw, iy + ih, ix + iw - ir, iy + ih);
                hole.lineTo(ix + ir, iy + ih);
                hole.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ir);
                hole.lineTo(ix, iy + ir);
                hole.quadraticCurveTo(ix, iy, ix + ir, iy);
              } else {
                hole.moveTo(ix, iy); hole.lineTo(ix + iw, iy);
                hole.lineTo(ix + iw, iy + ih); hole.lineTo(ix, iy + ih); hole.closePath();
              }
              hShape.holes.push(hole);
            }
            handleGeom = new THREE.ExtrudeGeometry(hShape, { depth: hd, bevelEnabled: false, curveSegments: 16 });
          }
          handleGeom.center();
          const handleMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.3 });
          const handleMeshObj = new THREE.Mesh(handleGeom, handleMat);
          handleMeshObj.name = 'zerogap_handle_preview';
          const edges = new THREE.EdgesGeometry(handleGeom);
          handleMeshObj.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x115533, transparent: true, opacity: 0.5 })));
          scene.add(handleMeshObj);
          exportMeshRef.current = handleMeshObj;
          setIsLoading(false);

          // Auto-frame
          if (controlsRef.current && cameraRef.current) {
            const bb = new THREE.Box3().setFromObject(handleMeshObj);
            const center = new THREE.Vector3(); bb.getCenter(center);
            controlsRef.current.target.copy(center);
            const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
            const fov = cameraRef.current.fov * (Math.PI / 180);
            const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
            cameraRef.current.position.set(center.x + dist * 0.5, center.y + dist * 0.6, center.z + dist);
            controlsRef.current.update();
          }
          return; // DONE for handle-design step
        }

        // ── PAN-ONLY STEP: Show pan wireframes isolated ──────────────────────
        if (wizardStep === 'pan-design' && panGeom && panMesh) {
          const panOuterWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35 }));
          panOuterWf.name = 'zerogap_pan_outer_wf';
          scene.add(panOuterWf);
          if (config.pan.useShellPreview && panInnerGeom) {
            const panInnerWf = new THREE.Mesh(panInnerGeom, new THREE.MeshBasicMaterial({ color: 0xFFA500, wireframe: true, transparent: true, opacity: 0.25 }));
            panInnerWf.name = 'zerogap_pan_inner_wf';
            scene.add(panInnerWf);
          }
          exportMeshRef.current = panOuterWf;
          setIsLoading(false);
          if (controlsRef.current && cameraRef.current) {
            const bb = new THREE.Box3().setFromObject(panOuterWf);
            const center = new THREE.Vector3(); bb.getCenter(center);
            controlsRef.current.target.copy(center);
            const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
            const fov = cameraRef.current.fov * (Math.PI / 180);
            const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
            cameraRef.current.position.set(center.x + dist * 0.5, center.y + dist * 0.6, center.z + dist);
            controlsRef.current.update();
          }
          return; // DONE for pan-design step
        }

        // ── 2. Tube — 3-Part Logic (Head / Body / Tail) ─────────────────────
        // HEAD: fixed zone that gets cut by the pan (ensures angle stability)
        // BODY: variable-length straight section
        // TAIL: fixed zone at handle end (gets cut by handle cutter)
        const tw = config.tube.width;
        const th = config.tube.shape === 'دائري' ? tw : config.tube.height;
        const tl = config.tube.totalLength;
        const HEAD_LEN = Math.min(config.tube.partLength + 20, tl * 0.4);
        const TAIL_LEN = Math.min(30, tl * 0.2);
        const BODY_LEN = Math.max(1, tl - HEAD_LEN - TAIL_LEN);
        let tubeGeom: THREE.BufferGeometry;

        if (config.tube.shape === 'مخصص' && config.tube.customStlBuffer) {
          const loader = new STLLoader();
          tubeGeom = loader.parse(config.tube.customStlBuffer);
          tubeGeom.center();
          tubeGeom.computeVertexNormals();
        } else {
          const tt = config.tube.thickness;
          const tr = config.tube.shape === 'دائري' ? tw / 2 : config.tube.cornerRadius;
          const clearance = config.thermalClearance ? 0.1 : 0;

          // Cross-section shape (shared between all 3 parts)
          const buildSection = (): THREE.Shape => {
            const outerShape = new THREE.Shape();
            const tx = -tw / 2, ty = -th / 2;
            if (tr > 0) {
              outerShape.moveTo(tx + tr, ty);
              outerShape.lineTo(tx + tw - tr, ty);
              outerShape.quadraticCurveTo(tx + tw, ty, tx + tw, ty + tr);
              outerShape.lineTo(tx + tw, ty + th - tr);
              outerShape.quadraticCurveTo(tx + tw, ty + th, tx + tw - tr, ty + th);
              outerShape.lineTo(tx + tr, ty + th);
              outerShape.quadraticCurveTo(tx, ty + th, tx, ty + th - tr);
              outerShape.lineTo(tx, ty + tr);
              outerShape.quadraticCurveTo(tx, ty, tx + tr, ty);
            } else {
              outerShape.moveTo(tx, ty);
              outerShape.lineTo(tx + tw, ty);
              outerShape.lineTo(tx + tw, ty + th);
              outerShape.lineTo(tx, ty + th);
              outerShape.lineTo(tx, ty);
            }
            const etl = tt - clearance;
            const itr = Math.max(0, tr - etl);
            const itx = tx + etl, ity = ty + etl;
            const itw = tw - 2 * etl, ith = th - 2 * etl;
            if (itw > 0 && ith > 0) {
              const hole = new THREE.Path();
              if (itr > 0) {
                hole.moveTo(itx + itr, ity);
                hole.lineTo(itx + itw - itr, ity);
                hole.quadraticCurveTo(itx + itw, ity, itx + itw, ity + itr);
                hole.lineTo(itx + itw, ity + ith - itr);
                hole.quadraticCurveTo(itx + itw, ity + ith, itx + itw - itr, ity + ith);
                hole.lineTo(itx + itr, ity + ith);
                hole.quadraticCurveTo(itx, ity + ith, itx, ity + ith - itr);
                hole.lineTo(itx, ity + itr);
                hole.quadraticCurveTo(itx, ity, itx + itr, ity);
              } else {
                hole.moveTo(itx, ity);
                hole.lineTo(itx + itw, ity);
                hole.lineTo(itx + itw, ity + ith);
                hole.lineTo(itx, ity + ith);
                hole.lineTo(itx, ity);
              }
              outerShape.holes.push(hole);
            }
            return outerShape;
          };

          // Build 3 segments offset on Z, then merge
          const headGeom = new THREE.ExtrudeGeometry(buildSection(), { depth: HEAD_LEN, bevelEnabled: false, curveSegments: 16 });
          const bodyGeom = new THREE.ExtrudeGeometry(buildSection(), { depth: BODY_LEN, bevelEnabled: false, curveSegments: 16 });
          bodyGeom.translate(0, 0, HEAD_LEN);
          const tailGeom = new THREE.ExtrudeGeometry(buildSection(), { depth: TAIL_LEN, bevelEnabled: false, curveSegments: 16 });
          tailGeom.translate(0, 0, HEAD_LEN + BODY_LEN);

          try {
            tubeGeom = BufferGeometryUtils.mergeGeometries([headGeom, bodyGeom, tailGeom], false);
          } catch {
            // Fallback to single extrude if merge fails
            tubeGeom = new THREE.ExtrudeGeometry(buildSection(), { depth: tl, bevelEnabled: false, curveSegments: 16 });
          }
          headGeom.dispose();
          bodyGeom.dispose();
          tailGeom.dispose();
        }

        const tubeMesh = new THREE.Mesh(tubeGeom, new THREE.MeshStandardMaterial({
          color: 0xcccccc, metalness: 0.5, roughness: 0.3
        }));

        // ── TUBE-ONLY STEP ──────────────────────────────────────────────────
        if (wizardStep === 'tube-design') {
          tubeMesh.name = 'zerogap_tube_solo';
          try {
            const edges = new THREE.EdgesGeometry(tubeGeom);
            if (edges.attributes.position?.count > 0) {
              tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
            }
          } catch { /* edge gen failed */ }
          scene.add(tubeMesh);
          exportMeshRef.current = tubeMesh;
          setIsLoading(false);
          // Auto-frame
          if (controlsRef.current && cameraRef.current) {
            const bb = new THREE.Box3().setFromObject(tubeMesh);
            const center = new THREE.Vector3(); bb.getCenter(center);
            controlsRef.current.target.copy(center);
            const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
            const fov = cameraRef.current.fov * (Math.PI / 180);
            const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
            cameraRef.current.position.set(center.x + dist * 0.5, center.y + dist * 0.6, center.z + dist);
            controlsRef.current.update();
          }
          return; // DONE for tube-design step
        }

        // ── 3. Handle cutter ─────────────────────────────────────────────────
        const tiltAxis = config.assembly.tiltAxis || 'X';
        const handleAxX = (config.assembly.handleAngleX || 0) * (Math.PI / 180);
        const handleAxY = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
        const handleOff = config.assembly.handleOffset || 0;

        const hcGeom = new THREE.BoxGeometry(tw * 4, th * 4, tl);
        hcGeom.translate(0, handleOff, tl / 2);
        const hcMesh = new THREE.Mesh(hcGeom);
        hcMesh.position.set(0, 0, tl);
        hcMesh.rotation.x = -handleAxX;
        hcMesh.rotation.y = -handleAxY;
        hcMesh.updateMatrixWorld(true);

        // ── 4. Apply assembly transforms ─────────────────────────────────────
        const angleRad = (90 - config.assembly.tiltAngle) * (Math.PI / 180);

        // Pan sits at partLength on Z
        if (panMesh) {
          panMesh.position.set(0, 0, config.tube.partLength);
          panMesh.updateMatrixWorld(true);
        }
        if (panInnerMesh) {
          panInnerMesh.position.copy(panMesh?.position || new THREE.Vector3(0, 0, config.tube.partLength));
          panInnerMesh.rotation.copy(panMesh?.rotation || new THREE.Euler());
          panInnerMesh.updateMatrixWorld(true);
        }

        // Tube positioned and tilted
        tubeMesh.position.set(0, config.assembly.heightOffset, -config.assembly.insertionDistance);
        if (tiltAxis === 'X') {
          tubeMesh.rotation.x = angleRad;
        } else {
          tubeMesh.rotation.z = angleRad;
        }
        tubeMesh.updateMatrixWorld(true);

        // ── 5. Render: Preview or Boolean ────────────────────────────────────
        if (config.renderMode === 'preview') {
          tubeMesh.name = 'zerogap_tube_preview';

          // ── Pan wireframe rendering ──────────────────────────────────────
          // Outer pan: cyan wireframe (always visible)
          const panOuterWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({
            color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35
          }));
          panOuterWf.name = 'zerogap_pan_outer_wf';
          panOuterWf.position.copy(panMesh.position);
          panOuterWf.rotation.copy(panMesh.rotation);
          scene.add(panOuterWf);

          // Inner pan: orange wireframe (only in shell mode)
          if (config.pan.useShellPreview) {
            const panInnerWf = new THREE.Mesh(panInnerGeom, new THREE.MeshBasicMaterial({
              color: 0xFFA500, wireframe: true, transparent: true, opacity: 0.25
            }));
            panInnerWf.name = 'zerogap_pan_inner_wf';
            panInnerWf.position.copy(panMesh.position);
            panInnerWf.rotation.copy(panMesh.rotation);
            scene.add(panInnerWf);
          }

          // ── Zero-Gap Visual Feedback ──────────────────────────────────────
          try {
            const tubeBSP = CSG.fromMesh(tubeMesh);
            const panBSP  = CSG.fromMesh(panMesh);
            const intersectBSP = tubeBSP.intersect(panBSP);

            if (intersectBSP) {
              // 1. Penetrating tube end — colored GREEN GLOW (for future use/reference)
              if (config.showGlow) {
                const glowMesh = CSG.toMesh(intersectBSP, new THREE.Matrix4(), new THREE.MeshStandardMaterial({
                  color: 0x00ff00,
                  emissive: 0x00aa00,
                  emissiveIntensity: 1.5,
                  transparent: true,
                  opacity: 0.4,
                  side: THREE.DoubleSide,
                  depthTest: true,
                  depthWrite: false
                }));
                glowMesh.name = 'zerogap_intersection_zone';
                scene.add(glowMesh);
              }

              // 2. RED contact ring on PAN OUTER SURFACE only
              if (config.showBorders) {
                try {
                  // Create a 0.5mm outer "skin" of the pan so the ring only exists on the outer surface
                  const skinPts = buildPanProfile(0.5);
                  const skinGeom = new THREE.LatheGeometry(skinPts, 64);
                  const skinMesh = new THREE.Mesh(skinGeom);
                  skinMesh.position.copy(panMesh.position);
                  skinMesh.rotation.copy(panMesh.rotation);
                  skinMesh.updateMatrixWorld(true);
                  
                  const skinBSP = panBSP.subtract(CSG.fromMesh(skinMesh));
                  const outerRingBSP = tubeBSP.intersect(skinBSP);
                  
                  if (outerRingBSP) {
                    // Render the 0.5mm skin plug as a solid Red mesh, creating a thick 3D ring!
                    const ringMesh = CSG.toMesh(outerRingBSP, new THREE.Matrix4(), new THREE.MeshBasicMaterial({
                      color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.95
                    }));
                    ringMesh.name = 'zerogap_pan_ring';
                    ringMesh.renderOrder = 1;
                    scene.add(ringMesh);
                  }
                  skinGeom.dispose();
                } catch (e) { console.warn('Outer ring failed:', e); }

                // BLUE inner ring — only when tube pierces through full wall thickness
                if (config.pan.useShellPreview) {
                  try {
                    const panInnerBSP = CSG.fromMesh(panInnerMesh);
                    const innerIntersectBSP = tubeBSP.intersect(panInnerBSP);
                    if (innerIntersectBSP) {
                      const innerMesh = CSG.toMesh(innerIntersectBSP, new THREE.Matrix4());
                      if (innerMesh.geometry.attributes.position && innerMesh.geometry.attributes.position.count > 3) {
                        const innerEdges = new THREE.EdgesGeometry(innerMesh.geometry, 15);
                        const innerRing = new THREE.LineSegments(innerEdges, new THREE.LineBasicMaterial({
                          color: 0x00aaff, linewidth: 3, transparent: true, opacity: 1.0,
                          depthTest: true
                        }));
                        innerRing.name = 'zerogap_pan_inner_ring';
                        innerRing.renderOrder = 1;
                        (innerRing.material as THREE.LineBasicMaterial).polygonOffset = true;
                        (innerRing.material as THREE.LineBasicMaterial).polygonOffsetFactor = -5;
                        scene.add(innerRing);
                      }
                      innerMesh.geometry.dispose();
                    }
                  } catch (e) { console.warn('Inner ring failed:', e); }
                }
              }
            }
          } catch (err) {
            console.warn('Zero-Gap visual calculation error:', err);
          }

          try {
            const edges = new THREE.EdgesGeometry(tubeGeom);
            if (edges.attributes.position?.count > 0) {
              tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
            }
          } catch { /* edge gen failed, continue */ }

          scene.add(tubeMesh);
          exportMeshRef.current = tubeMesh;

          // Handle cutter: only show in tube-handle-cut or final-inspect, NOT in pan-tube-cut
          if (wizardStep !== 'pan-tube-cut') {
            hcMesh.name = 'zerogap_handle_cutter_preview';
            (hcMesh as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.1 });
            scene.add(hcMesh);
          }

          // Dispose temp geometries
          if (panMesh) (panMesh.material as THREE.Material).dispose();
          if (panInnerMesh) (panInnerMesh.material as THREE.Material).dispose();
          hcGeom.dispose();

        } else {
          // ── CSG Boolean subtraction ─────────────────────────────────────
          setIsLoading(true);
          const tubeBSP = CSG.fromMesh(tubeMesh);
          // If applyThicknessToCut: use inner pan (shell gap), else use solid
          const cutPanBSP = config.pan.applyThicknessToCut
            ? CSG.fromMesh(panInnerMesh)  // Cut using inner surface only
            : CSG.fromMesh(panMesh);      // Cut using full solid (default)
          const hcBSP   = CSG.fromMesh(hcMesh);

          let resultBSP = tubeBSP.subtract(cutPanBSP).subtract(hcBSP);

          // Optional laser orientation mark
          if (config.markOrientation) {
            const markGeom = new THREE.CylinderGeometry(1, 1, Math.max(tw, th) * 2, 8);
            markGeom.rotateX(Math.PI / 2);
            const markMesh = new THREE.Mesh(markGeom);
            markMesh.position.set(0, th / 2, tl - 15);
            markMesh.updateMatrixWorld(true);
            resultBSP = resultBSP.subtract(CSG.fromMesh(markMesh));
            markGeom.dispose();
          }

          // Twin nesting: mirror the piece tail-to-tail
          if (config.nestingMode === 'twin') {
            const singleMesh = CSG.toMesh(resultBSP, new THREE.Matrix4());
            const twinMesh = singleMesh.clone();
            twinMesh.rotateY(Math.PI);
            twinMesh.position.z = tl * 2 + (config.slugGap || 5);
            twinMesh.updateMatrix();
            twinMesh.updateMatrixWorld(true);
            resultBSP = resultBSP.union(CSG.fromMesh(twinMesh));
            singleMesh.geometry.dispose();
          }

          // Dispose temp geometries before creating final mesh
          tubeGeom.dispose();
          panGeom.dispose();
          hcGeom.dispose();

          // Build the final mesh using identity matrix → vertices in world space
          const resultMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide
          });
          const finalMesh = CSG.toMesh(resultBSP, new THREE.Matrix4(), resultMat);
          finalMesh.name = 'zerogap_result';

          // Safety: CSG may return empty geometry on degenerate inputs
          if (!finalMesh.geometry.attributes.position ||
              finalMesh.geometry.attributes.position.count === 0) {
            finalMesh.geometry = new THREE.BoxGeometry(1, 1, 1);
          }

          finalMesh.geometry.computeVertexNormals();

          // ── TRUE ABSOLUTE CENTER at (0, 0, 0) ──────────────────────────
          // Compute all 3 axes center and translate, so the mass-center of
          // the part lands exactly at world origin — not just X/Y centered.
          finalMesh.geometry.computeBoundingBox();
          const gb = finalMesh.geometry.boundingBox;
          if (gb && isFinite(gb.min.x) && !isNaN(gb.min.x)) {
            const cx = (gb.min.x + gb.max.x) / 2;
            const cy = (gb.min.y + gb.max.y) / 2;
            const cz = (gb.min.z + gb.max.z) / 2;
            finalMesh.geometry.translate(-cx, -cy, -cz);
          }

          // Edge silhouette overlay
          try {
            const edges = new THREE.EdgesGeometry(finalMesh.geometry);
            if (edges.attributes.position?.count > 0) {
              finalMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                color: config.addFillet ? 0xffffff : 0x000000,
                opacity: 0.2,
                transparent: true
              })));
            }
          } catch { /* non-critical */ }

          scene.add(finalMesh);
          exportMeshRef.current = finalMesh;
        }

        setIsLoading(false);

        // ── 6. Auto-frame camera (only on first load or STL change) ──────────
        if (controlsRef.current && cameraRef.current && exportMeshRef.current) {
          const bb = new THREE.Box3();
          if (config.renderMode === 'preview') {
            scene.children.forEach(c => { if (c.name.startsWith('zerogap_')) bb.expandByObject(c); });
          } else {
            bb.setFromObject(exportMeshRef.current);
          }

          if (isFinite(bb.min.x) && !isNaN(bb.min.x)) {
            if (!hasAutoCentered.current || lastStlName.current !== config.tube.customStlName) {
              const worldCenter = new THREE.Vector3();
              bb.getCenter(worldCenter);

              // Set orbit pivot to part center
              controlsRef.current.target.copy(worldCenter);

              const maxDim = Math.max(
                bb.max.x - bb.min.x,
                bb.max.y - bb.min.y,
                bb.max.z - bb.min.z
              ) || 100;
              const fov = cameraRef.current.fov * (Math.PI / 180);
              const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
              cameraRef.current.position.set(
                worldCenter.x + dist * 0.5,
                worldCenter.y + dist * 0.8,
                worldCenter.z + dist
              );

              hasAutoCentered.current = true;
              lastStlName.current = config.tube.customStlName;
              controlsRef.current.update();
            }
            // NOTE: we do NOT call target.copy() here on every param change —
            // that was the root cause of the sidebar-scrolling viewport shift.
          }
        }

      } catch (e: any) {
        console.error('Zero-Gap Engine Error:', e);
        const errorMessage = e?.message || 'فشل في إنشاء الشكل الهندسي';
        setEngineError(errorMessage);
        setTimeout(() => setEngineError(null), 5000);
      }
    }, wizardStep === 'tube-design' || wizardStep === 'pan-design' || wizardStep === 'handle-design' ? 80 : 300); // Faster debounce for simple steps, slower for CSG

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [config, gridVisible, webglError, wizardStep]);

  // ─── Snap View Handler ────────────────────────────────────────────────────────
  const handleSnapView = (view: string) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const bb = new THREE.Box3();
    if (exportMeshRef.current) {
      if (config.renderMode === 'preview') {
        sceneRef.current?.children.forEach(c => { if (c.name.startsWith('zerogap_')) bb.expandByObject(c); });
      } else {
        bb.setFromObject(exportMeshRef.current);
      }
    }
    if (!isFinite(bb.min.x)) return;

    const center = new THREE.Vector3();
    bb.getCenter(center);
    const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 100;
    const dist = maxDim * 1.5;

    const cam = cameraRef.current;
    switch (view) {
      case 'front':  cam.position.set(center.x, center.y, center.z + dist); break;
      case 'back':   cam.position.set(center.x, center.y, center.z - dist); break;
      case 'top':    cam.position.set(center.x, center.y + dist, center.z); break;
      case 'bottom': cam.position.set(center.x, center.y - dist, center.z); break;
      case 'left':   cam.position.set(center.x - dist, center.y, center.z); break;
      case 'right':  cam.position.set(center.x + dist, center.y, center.z); break;
      case 'iso':    cam.position.set(center.x + dist * 0.8, center.y + dist * 0.8, center.z + dist * 0.8); break;
    }
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  // ─── Re-center button handler ─────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!exportMeshRef.current || !controlsRef.current || !cameraRef.current) return;
    exportMeshRef.current.geometry.computeBoundingBox();
    const b = exportMeshRef.current.geometry.boundingBox;
    if (!b || !isFinite(b.min.x)) return;
    const center = new THREE.Vector3();
    b.getCenter(center);
    controlsRef.current.target.copy(center);
    const maxDim = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) || 100;
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const cDist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraRef.current.position.set(center.x + cDist * 0.5, center.y + cDist * 0.8, center.z + cDist);
    controlsRef.current.update();
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px] bg-neutral-900 rounded-lg overflow-hidden relative flex items-center justify-center text-center"
      id="three-container"
    >
      {/* Camera HUD */}
      {!webglError && (
        <div
          className="absolute top-6 left-6 flex flex-col items-center gap-1 z-10 glass-panel p-2 rounded-xl border-t-2 border-t-[var(--accent)]"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="text-[10px] text-[var(--text-main)] font-bold mb-2 tracking-widest text-center font-mono">كاميرا</div>

          <div className="grid grid-cols-3 gap-1 mb-1">
            <div />
            <button onClick={() => handleSnapView('top')}    className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-[var(--accent)] hover:text-black border border-[var(--border)] rounded text-[10px] font-bold transition-all">Y+</button>
            <div />
            <button onClick={() => handleSnapView('left')}   className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-[var(--accent)] hover:text-black border border-[var(--border)] rounded text-[10px] font-bold transition-all">X-</button>
            <button onClick={() => handleSnapView('front')}  className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-[var(--accent)] hover:text-black border border-[var(--accent)] rounded text-[10px] text-[var(--accent)] font-bold transition-all">Z+</button>
            <button onClick={() => handleSnapView('right')}  className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-[var(--accent)] hover:text-black border border-[var(--border)] rounded text-[10px] font-bold transition-all">X+</button>
            <div />
            <button onClick={() => handleSnapView('bottom')} className="w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-[var(--accent)] hover:text-black border border-[var(--border)] rounded text-[10px] font-bold transition-all">Y-</button>
            <div />
          </div>

          <div className="w-full flex gap-1 mt-1">
            <button onClick={() => handleSnapView('iso')} className="flex-1 py-1.5 bg-black/40 hover:bg-[var(--accent-blue)] hover:text-black border border-[var(--border)] rounded text-[9px] font-bold transition-all uppercase">ISO</button>
            <button onClick={handleRecenter} className="w-8 h-full bg-black/40 hover:bg-white hover:text-black border border-[var(--border)] rounded flex items-center justify-center transition-all" title="تمركز الكاميرا">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4 12H2M22 12h-4"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* WebGL error */}
      {webglError && (
        <div className="max-w-md bg-red-500/10 border border-red-500/20 p-6 rounded-xl backdrop-blur-sm">
          <h3 className="text-red-500 font-bold mb-2 uppercase tracking-widest text-sm">خطأ في الرسومات</h3>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">{webglError}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] font-bold text-sm uppercase tracking-widest">جاري المعالجة...</span>
          </div>
        </div>
      )}

      {/* Engine error toast */}
      {engineError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-xs font-bold z-50 animate-pulse">
          {engineError}
        </div>
      )}
      {/* Orientation Gizmo — bottom-right corner */}
      {!webglError && (
        <ViewportGizmo cameraRef={cameraRef} />
      )}
    </div>
  );
});

export default ThreeCanvas;
