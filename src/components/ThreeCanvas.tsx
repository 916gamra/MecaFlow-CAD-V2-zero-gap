import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls, STLExporter, STLLoader } from 'three-stdlib';
import { CSG } from 'three-csg-ts';
import { ZeroGapState } from '../types';
import { validateTubeConfig, validatePanConfig } from '../lib/validators';
import { performanceOptimizer } from '../lib/performanceOptimizer';

interface ThreeCanvasProps {
  config: ZeroGapState;
  gridVisible: boolean;
}

export interface ThreeCanvasRef {
  exportSTL: () => void;
}

const ThreeCanvas = forwardRef<ThreeCanvasRef, ThreeCanvasProps>(({ config, gridVisible }, ref) => {
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
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
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
      try {
        validateTubeConfig(config.tube);
        validatePanConfig(config.pan);
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
        // ── 1. Pan (virtual cutter) ──────────────────────────────────────────
        const rBottom = config.pan.bottomDiameter / 2;
        const rTop = config.pan.topDiameter / 2;
        const panH = config.pan.height;
        const rimThick = config.pan.rimThickness || 2.0;
        const curveRad = config.pan.curveRadius || 100.0;
        const filletR = config.pan.bottomFilletRadius || 8.0;
        const addRim = config.pan.addRim;
        const rimH = config.pan.rimHeight || 3.0;

        const pts: THREE.Vector2[] = [];
        pts.push(new THREE.Vector2(0, 0));

        // Bottom fillet arc
        if (filletR > 0) {
          const segs = 16;
          for (let i = 0; i <= segs; i++) {
            const theta = (Math.PI / 2) * (1 - i / segs);
            pts.push(new THREE.Vector2(
              rBottom - filletR + filletR * Math.cos(theta),
              filletR - filletR * Math.sin(theta)
            ));
          }
        } else {
          pts.push(new THREE.Vector2(rBottom, 0));
        }

        // Quadratic bezier side wall
        const bulge = Math.max(2.0, Math.min(20.0, (200.0 / curveRad) * 4.0));
        const rMid = (rBottom + rTop) / 2.0 + bulge;
        const zMid = panH / 2.0;
        const cx = 2 * rMid - 0.5 * rBottom - 0.5 * rTop;
        const cy = 2 * zMid - 0.5 * filletR - 0.5 * panH;
        const curve = new THREE.QuadraticBezierCurve(
          new THREE.Vector2(rBottom, filletR),
          new THREE.Vector2(cx, cy),
          new THREE.Vector2(rTop, panH)
        );
        pts.push(...curve.getPoints(32).slice(1));

        // Rim / top close
        if (addRim) {
          pts.push(new THREE.Vector2(rTop + rimThick, panH));
          pts.push(new THREE.Vector2(rTop + rimThick, panH + rimH));
          pts.push(new THREE.Vector2(0, panH + rimH));
        } else {
          pts.push(new THREE.Vector2(rTop + rimThick, panH));
          pts.push(new THREE.Vector2(rTop + rimThick, panH + rimThick));
          pts.push(new THREE.Vector2(0, panH + rimThick));
        }

        // Deduplicate consecutive identical points
        const finalPts = pts.filter((p, i) => i === 0 || !p.equals(pts[i - 1]));

        const panGeom = new THREE.LatheGeometry(finalPts, 64);
        const panMesh = new THREE.Mesh(panGeom, new THREE.MeshStandardMaterial({
          color: 0xff3333,
          side: THREE.DoubleSide
        }));
        panMesh.name = 'zerogap_pan';

        // Wireframe overlay — visible ONLY in preview mode as engineering reference.
        // In boolean (Zero-Gap) mode the user sees only the final subtracted result.
        const panWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({
          color: 0x00E5FF,
          wireframe: true,
          transparent: true,
          opacity: 0.35
        }));
        panWf.name = 'zerogap_pan_wireframe';
        if (config.renderMode === 'preview') {
          scene.add(panWf);
        }

        // ── 2. Tube (main body) ──────────────────────────────────────────────
        const tw = config.tube.width;
        const th = config.tube.shape === 'دائري' ? tw : config.tube.height;
        const tl = config.tube.totalLength;
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
          tubeGeom = new THREE.ExtrudeGeometry(outerShape, { depth: tl, bevelEnabled: false, curveSegments: 16 });
        }

        const tubeMesh = new THREE.Mesh(tubeGeom, new THREE.MeshStandardMaterial({
          color: 0xcccccc, metalness: 0.5, roughness: 0.3
        }));

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
        panMesh.position.set(0, 0, config.tube.partLength);
        panMesh.updateMatrixWorld(true);
        panWf.position.copy(panMesh.position);
        panWf.rotation.copy(panMesh.rotation);
        panWf.updateMatrixWorld(true);

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
          try {
            const edges = new THREE.EdgesGeometry(tubeGeom);
            if (edges.attributes.position?.count > 0) {
              tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
            }
          } catch { /* edge gen failed, continue */ }

          hcMesh.name = 'zerogap_handle_cutter_preview';
          (hcMesh as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.1 });
          scene.add(tubeMesh);
          scene.add(hcMesh);
          exportMeshRef.current = tubeMesh;

        } else {
          // ── CSG Boolean subtraction ─────────────────────────────────────
          setIsLoading(true);
          const tubeBSP = CSG.fromMesh(tubeMesh);
          const panBSP  = CSG.fromMesh(panMesh);
          const hcBSP   = CSG.fromMesh(hcMesh);

          let resultBSP = tubeBSP.subtract(panBSP).subtract(hcBSP);

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
    }, 100); // 100ms debounce

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [config, gridVisible, webglError]);

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
    </div>
  );
});

export default ThreeCanvas;
