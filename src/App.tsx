import React, { useState, useRef, useEffect } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import DraftingView from './components/DraftingView';
import CNCView from './components/CNCView';
import ZeroGapControlPanel from './components/ZeroGapControlPanel';
import { CADState } from './types';
import { loadConfigFromStorage, saveConfigToStorage } from './lib/storageUtils';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const defaultZeroGap: CADState['zeroGap'] = {
    pan: { bottomDiameter: 120, topDiameter: 280, height: 50, curveRadius: 100, rimThickness: 2, bottomFilletRadius: 8, addRim: true, rimHeight: 3 },
    tube: { width: 38, height: 25, thickness: 1.2, totalLength: 120, partLength: 70, cornerRadius: 5.75, shape: 'بيضاوي' },
    assembly: { tiltAngle: 15, handleAngleX: 0, handleAngleY: 10, handleOffset: 0, insertionDistance: 50, heightOffset: 25, tiltAxis: 'X' },
    renderMode: 'boolean',
    addFillet: true,
    thermalClearance: false,
    nestingMode: 'twin',
    slugGap: 5,
    markOrientation: false
  };

  const [state, setState] = useState<CADState>(() => {
    const savedConfig = loadConfigFromStorage();
    return {
      parts: [],
      selectedPartId: null,
      viewMode: '3d',
      gridVisible: true,
      units: 'mm',
      zeroGap: savedConfig || defaultZeroGap
    };
  });

  useEffect(() => {
    saveConfigToStorage(state.zeroGap);
  }, [state.zeroGap]);

  const canvasRef = useRef<{ exportSTL: () => void }>(null);

  return (
    <>
      {showSplash && (
        <div className="splash-screen">
          <div className="splash-logo-container">
            <div className="splash-logo-cube"></div>
          </div>
          <div className="neon-text-lux">MecaFlow-CAD</div>
          <div className="neon-sub-lux">ZERO-GAP LASER SYSTEM</div>
        </div>
      )}
      <div className={`h-screen overflow-hidden flex flex-col font-sans selection:bg-[var(--accent)] selection:text-white ${showSplash ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
        {/* Header */}
      <header className="h-[48px] px-4 bg-[var(--bg-header)] border-b border-[var(--border)] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <h1 className="text-sm font-bold tracking-wider uppercase text-[var(--accent)]">MecaFlow-CAD (Zero-Gap)</h1>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex gap-5">
            {['محاكاة هندسية', 'مخططات 2D', 'تحضير CNC', 'عارض الملفات'].map((item, idx) => (
              <button 
                key={item} 
                onClick={() => {
                  if (idx === 0) setState(prev => ({ ...prev, viewMode: '3d' }));
                  if (idx === 1) setState(prev => ({ ...prev, viewMode: 'drafting' }));
                  if (idx === 2) setState(prev => ({ ...prev, viewMode: 'cnc' }));
                  if (idx === 3) setState(prev => ({ ...prev, viewMode: 'viewer' }));
                }}
                className={`text-[13px] transition-colors ${
                  (idx === 0 && state.viewMode === '3d') || 
                  (idx === 1 && state.viewMode === 'drafting') || 
                  (idx === 2 && state.viewMode === 'cnc') ||
                  (idx === 3 && state.viewMode === 'viewer')
                  ? 'text-[var(--text-main)] font-semibold border-b-2 border-[var(--accent)] pb-1' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="w-px h-4 bg-[var(--border)]" />
          <div className="text-[12px] opacity-80 text-[var(--text-dim)]">المستخدم: مبرمج ليزر (Admin_Mech)</div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden relative">

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Container */}
          <div className="flex-1 relative group overflow-hidden bg-[#1a1d23]" style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            {state.viewMode === '3d' && (
              <ThreeCanvas 
                ref={canvasRef}
                config={state.zeroGap}
                gridVisible={state.gridVisible}
              />
            )}
            {state.viewMode === 'drafting' && (
              <DraftingView />
            )}
            {state.viewMode === 'cnc' && (
              <CNCView config={state.zeroGap} />
            )}
            {state.viewMode === 'viewer' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                <div className="bg-[#111] p-8 border border-[var(--border)] rounded-xl text-center max-w-md w-full shadow-2xl">
                  <svg className="w-16 h-16 mx-auto mb-4 text-[var(--accent-blue)] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <h2 className="text-xl font-bold text-white mb-2 tracking-wide">عارض ملفات STEP / STL</h2>
                  <p className="text-[12px] text-[var(--text-dim)] mb-6">قم بسحب وإفلات ملف هنا أو اضغط لاختيار ملف لمعاينته بشكل ثلاثي الأبعاد.</p>
                  
                  <label className="block w-full py-3 bg-[var(--accent)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)] rounded cursor-pointer hover:bg-[var(--accent)]/20 transition-colors">
                    <span className="font-bold text-sm tracking-widest">اختر ملف STL</span>
                    <input type="file" accept=".stl,.step,.stp" className="hidden" onChange={async (e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        const name = file.name.toLowerCase();
                        if (name.endsWith('.stl')) {
                          const buffer = await file.arrayBuffer();
                          setState(prev => ({
                            ...prev,
                            viewMode: '3d',
                            zeroGap: {
                              ...prev.zeroGap,
                              renderMode: 'preview',
                              tube: {
                                ...prev.zeroGap.tube,
                                shape: 'مخصص',
                                customStlBuffer: buffer,
                                customStlName: file.name
                              }
                            }
                          }));
                        } else {
                          alert("معالجة ملفات STEP الكاملة تتم عبر السكريبت (Python). يرجى رفع ملف بصيغة STL لتعديله وقطعه مباشراً داخل المتصفح.");
                        }
                      }
                    }} />
                  </label>
                </div>
              </div>
            )}

            {/* View HUD */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 scale-75 origin-top-right">
              <div className="text-right font-mono text-[11px] text-[var(--text-dim)]">
                محرك التوليد الصناعي<br />التطابق: 100%
              </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-[var(--bg-panel)]/80 backdrop-blur px-3 py-1 border border-[var(--border)] flex gap-4 text-[10px] text-[var(--text-dim)] font-mono">
              <span>UNITS: {state.units.toUpperCase()}</span>
              <span>ENGINE: CADQUERY / THREE-CSG</span>
            </div>
          </div>

          {/* Bottom Bar / Status */}
          <div className="h-[24px] bg-[var(--bg-header)] border-t border-[var(--border)] font-[10px] flex items-center px-4 gap-5 text-[var(--text-dim)] uppercase tracking-tight">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              تم التفعيل (ZERO-GAP)
            </span>
            <span>السمك الداخلي: {state.zeroGap.tube.thickness}mm</span>
            <span>زاوية الإسقاط: {state.zeroGap.assembly.tiltAngle}°</span>
            <div className="ml-auto flex gap-4">
              <span>حساس القطع (Capacitive): جاهز</span>
            </div>
          </div>
        </div>

        <ZeroGapControlPanel 
          config={state.zeroGap}
          onUpdate={(newConfig) => setState(prev => ({ ...prev, zeroGap: newConfig }))}
          onExport={() => canvasRef.current?.exportSTL()}
        />
      </main>
    </div>
    </>
  );
}
