import React, { useState, useRef, useEffect } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import DraftingView from './components/DraftingView';
import CNCView from './components/CNCView';
import ZeroGapControlPanel from './components/ZeroGapControlPanel';
import WizardStepper from './components/WizardStepper';
import DashboardView from './components/DashboardView';
import { CADState, WizardStep, WIZARD_STEPS } from './types';
import { loadConfigFromStorage, saveConfigToStorage } from './lib/storageUtils';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const defaultZeroGap: CADState['zeroGap'] = {
    pan: {
      bottomDiameter: 120, topDiameter: 280, height: 50, curveRadius: 100,
      rimThickness: 2, bottomFilletRadius: 8, removeBottom: false, addRim: true,
      rimHeight: 3, wallThickness: 2.0, useShellPreview: true,
      innerMoldMode: false, applyThicknessToCut: false,
    },
    tube: {
      width: 38, height: 25, thickness: 1.2, totalLength: 120, partLength: 70,
      cornerRadius: 5.75, shape: 'بيضاوي',
    },
    handle: {
      shape: 'rectangular', width: 30, height: 20, depth: 80, thickness: 1.5,
      cornerRadius: 3, angleX: 0, angleY: 0, offsetZ: 0, insertionDepth: 15,
    },
    assembly: {
      tiltAngle: 15, handleAngleX: 0, handleAngleY: 10, handleOffset: 0,
      insertionDistance: 50, heightOffset: 25, tiltAxis: 'X',
    },
    renderMode: 'boolean',
    addFillet: true,
    thermalClearance: false,
    nestingMode: 'twin',
    slugGap: 5,
    markOrientation: false,
    showGlow: true,
    showBorders: true,
  };

  const [state, setState] = useState<CADState>(() => {
    const savedConfig = loadConfigFromStorage();
    // Migrate old configs that lack handle
    const zeroGap = savedConfig
      ? { ...defaultZeroGap, ...savedConfig, handle: savedConfig.handle || defaultZeroGap.handle }
      : defaultZeroGap;
    return {
      parts: [],
      selectedPartId: null,
      viewMode: '3d',
      gridVisible: true,
      units: 'mm',
      zeroGap,
      wizardStep: 'dashboard',
    };
  });

  useEffect(() => {
    saveConfigToStorage(state.zeroGap);
  }, [state.zeroGap]);

  const canvasRef = useRef<{ exportSTL: () => void }>(null);

  // ── Wizard navigation ─────────────────────────────────────────────────────
  const setWizardStep = (step: WizardStep) => {
    setState(prev => ({ ...prev, wizardStep: step }));
  };

  const currentStepIdx = WIZARD_STEPS.indexOf(state.wizardStep);
  const canGoNext = currentStepIdx < WIZARD_STEPS.length - 1;
  const canGoPrev = currentStepIdx > 0;
  const goNext = () => { if (canGoNext) setWizardStep(WIZARD_STEPS[currentStepIdx + 1]); };
  const goPrev = () => { if (canGoPrev) setWizardStep(WIZARD_STEPS[currentStepIdx - 1]); };

  const isDashboard = state.wizardStep === 'dashboard';
  const showCanvas = !isDashboard;
  const showSidebar = !isDashboard;

  // ── Overlay views (Drafting / CNC) triggered from final-inspect ────────
  const [overlayView, setOverlayView] = useState<'drafting' | 'cnc' | null>(null);

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

      <div className={`h-screen overflow-hidden flex flex-col font-sans ${showSplash ? 'opacity-0' : 'opacity-100 transition-opacity duration-1000'}`}>
        {/* ── Header with Wizard Stepper ────────────────────────────────── */}
        <header className="h-[56px] px-4 bg-[var(--bg-header)] border-b border-[var(--border)] flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <h1 className="text-sm font-bold tracking-wider uppercase text-[var(--accent)]">MecaFlow</h1>
          </div>

          <WizardStepper currentStep={state.wizardStep} onStepClick={setWizardStep} />

          <div className="text-[10px] opacity-70 text-[var(--text-dim)] font-mono whitespace-nowrap">
            v2.0
          </div>
        </header>

        {/* ── Main Layout ──────────────────────────────────────────────── */}
        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* View Container */}
            <div className="flex-1 relative group overflow-hidden bg-[#1a1d23]" style={{ backgroundImage: isDashboard ? 'none' : 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
              {isDashboard && (
                <DashboardView
                  onNewPart={() => setWizardStep('tube-design')}
                  onLoadSTL={(buffer, name) => {
                    setState(prev => ({
                      ...prev,
                      wizardStep: 'tube-design',
                      zeroGap: {
                        ...prev.zeroGap,
                        tube: { ...prev.zeroGap.tube, shape: 'مخصص', customStlBuffer: buffer, customStlName: name },
                      },
                    }));
                  }}
                  onLoadConfig={() => setWizardStep('tube-design')}
                  hasSavedConfig={!!loadConfigFromStorage()}
                />
              )}

              {showCanvas && (
                <ThreeCanvas
                  ref={canvasRef}
                  config={state.zeroGap}
                  gridVisible={state.gridVisible}
                  wizardStep={state.wizardStep}
                />
              )}

              {/* Overlay: DraftingView / CNCView */}
              {overlayView === 'drafting' && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-auto">
                  <button
                    className="absolute top-4 left-4 z-60 px-3 py-1 bg-red-600 text-white rounded text-xs font-bold"
                    onClick={() => setOverlayView(null)}
                  >✕ إغلاق</button>
                  <DraftingView config={state.zeroGap} />
                </div>
              )}
              {overlayView === 'cnc' && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-auto">
                  <button
                    className="absolute top-4 left-4 z-60 px-3 py-1 bg-red-600 text-white rounded text-xs font-bold"
                    onClick={() => setOverlayView(null)}
                  >✕ إغلاق</button>
                  <CNCView config={state.zeroGap} />
                </div>
              )}

              {/* View HUD (only in non-dashboard) */}
              {showCanvas && (
                <>
                  <div className="absolute top-4 right-4 flex flex-col gap-2 scale-75 origin-top-right">
                    <div className="text-right font-mono text-[11px] text-[var(--text-dim)]">
                      محرك التوليد الصناعي<br />التطابق: 100%
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-[var(--bg-panel)]/80 backdrop-blur px-3 py-1 border border-[var(--border)] flex gap-4 text-[10px] text-[var(--text-dim)] font-mono">
                    <span>UNITS: {state.units.toUpperCase()}</span>
                    <span>ENGINE: CADQUERY / THREE-CSG</span>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="h-[24px] bg-[var(--bg-header)] border-t border-[var(--border)] font-[10px] flex items-center px-4 gap-5 text-[var(--text-dim)] uppercase tracking-tight">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {isDashboard ? 'جاهز' : `المرحلة ${currentStepIdx} / 6`}
              </span>
              {!isDashboard && (
                <>
                  <span>السمك: {state.zeroGap.tube.thickness}mm</span>
                  <span>الزاوية: {state.zeroGap.assembly.tiltAngle}°</span>
                </>
              )}
              <div className="ml-auto flex gap-4">
                <span>ZERO-GAP ACTIVE</span>
              </div>
            </div>
          </div>

          {/* ── Sidebar (hidden on dashboard) ──────────────────────────── */}
          {showSidebar && (
            <ZeroGapControlPanel
              config={state.zeroGap}
              onUpdate={(newConfig) => setState(prev => ({ ...prev, zeroGap: newConfig }))}
              onExport={() => canvasRef.current?.exportSTL()}
              wizardStep={state.wizardStep}
              onNext={goNext}
              onPrev={goPrev}
              canGoNext={canGoNext}
              canGoPrev={canGoPrev}
              onOpenDrafting={() => setOverlayView('drafting')}
              onOpenCNC={() => setOverlayView('cnc')}
            />
          )}
        </main>
      </div>
    </>
  );
}
