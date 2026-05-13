import React from 'react';
import { ZeroGapState, WizardStep, WIZARD_LABELS } from '../types';
import { generateCadQueryScript } from '../lib/exportUtils';
import { generateGcode } from '../lib/gcodeGenerator';

interface ControlPanelProps {
  config: ZeroGapState;
  onUpdate: (config: ZeroGapState) => void;
  onExport: () => void;
  wizardStep: WizardStep;
  onNext: () => void;
  onPrev: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  onOpenDrafting: () => void;
  onOpenCNC: () => void;
}

const PrecisionControl = ({
  label, val, onChange, min, max, step
}: {
  label: string, val: number, onChange: (v: number) => void, min: number, max: number, step: number
}) => {
  const handleUpdate = (newVal: number) => {
    let bounded = Math.max(min, Math.min(max, newVal));
    const decimals = step < 1 ? 1 : 0;
    onChange(parseFloat(bounded.toFixed(decimals)));
  };

  return (
    <div className="flex flex-col gap-2 mb-4 bg-white/5 p-2 rounded border border-[var(--border)]">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleUpdate(val - step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >-</button>
        <div className="flex-1 relative input-wrapper">
          <input
            type="number"
            min={min} max={max} step={step} value={val}
            onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
            className="w-full bg-black/40 border border-[var(--border)] rounded h-8 text-center text-[12px] font-mono text-white focus:outline-none focus:border-[var(--accent-blue)] transition-colors appearance-none"
          />
        </div>
        <button
          onClick={() => handleUpdate(val + step)}
          className="w-8 h-8 flex items-center justify-center bg-black/40 border border-[var(--border)] rounded text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
        >+</button>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
        className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-blue)]"
      />
    </div>
  );
};

const ZeroGapControlPanel: React.FC<ControlPanelProps> = ({
  config, onUpdate, onExport, wizardStep, onNext, onPrev, canGoNext, canGoPrev,
  onOpenDrafting, onOpenCNC,
}) => {
  const updatePan = (key: keyof ZeroGapState['pan'], val: string | number) => {
    const numericVal = typeof val === 'string' ? parseFloat(val) || 0 : val;
    onUpdate({ ...config, pan: { ...config.pan, [key]: numericVal } });
  };
  const updateTube = (key: keyof ZeroGapState['tube'], val: string | number) => {
    const newVal = (key === 'shape') ? val : (typeof val === 'string' ? parseFloat(val) || 0 : val);
    onUpdate({ ...config, tube: { ...config.tube, [key]: newVal } });
  };
  const updateHandle = (key: keyof ZeroGapState['handle'], val: string | number) => {
    const newVal = (key === 'shape') ? val : (typeof val === 'string' ? parseFloat(val) || 0 : val);
    onUpdate({ ...config, handle: { ...config.handle, [key]: newVal } });
  };
  const updateAssembly = (key: keyof ZeroGapState['assembly'], val: string | number) => {
    const newVal = (key === 'tiltAxis') ? val : (typeof val === 'string' ? parseFloat(val) || 0 : val);
    onUpdate({ ...config, assembly: { ...config.assembly, [key]: newVal } });
  };

  const renderSlider = (
    label: string,
    val: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number = 1
  ) => <PrecisionControl label={label} val={val} onChange={onChange} min={min} max={max} step={step} />;

  // ── Toggle button helper ──────────────────────────────────────────────
  const renderToggle = (
    label: string,
    active: boolean,
    onClick: () => void,
    color: string = 'var(--accent)',
  ) => (
    <button
      onClick={onClick}
      className={`w-full py-2 mb-2 text-[10px] font-bold uppercase border rounded flex items-center justify-between px-3 transition-colors ${!active ? 'border-(--border) text-(--text-dim) hover:border-(--text-main)' : ''}`}
      style={active ? { backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color: color, borderColor: color } : undefined}
    >
      <span>{label}</span>
      <div
        className={`w-3 h-3 rounded-full shrink-0 transition-colors ${!active ? 'bg-(--border)' : ''}`}
        style={active ? { backgroundColor: color } : undefined}
      />
    </button>
  );

  // ── Step label ────────────────────────────────────────────────────────
  const stepTitle = WIZARD_LABELS[wizardStep];

  return (
    <aside className="w-[340px] h-full glass-panel border-l border-[var(--border)] flex flex-col" id="zero-gap-panel">
      {/* Panel Header */}
      <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-white/5">
        <div>
          <h3 className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-widest">{stepTitle}</h3>
          <p className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5">MecaFlow CAD / {wizardStep}</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-[var(--text-main)] hover:border-[var(--accent-blue)] transition-colors">
            تحميل
            <input type="file" accept=".json" className="hidden" onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const r = new FileReader();
                r.onload = ev => {
                  try { onUpdate(JSON.parse(ev.target?.result as string)); } catch { alert('ملف غير صالح'); }
                };
                r.readAsText(e.target.files[0]);
              }
            }}/>
          </label>
          <button
            onClick={() => {
              const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
              const a = document.createElement('a');
              a.href = data; a.download = 'mecaflow_config.json';
              document.body.appendChild(a); a.click(); a.remove();
            }}
            className="px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          >حفظ</button>
        </div>
      </div>

      {/* ── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">

        {/* ════════════════════════════════════════════════════════════════
           STEP 1: TUBE DESIGN
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'tube-design' && (
          <>
            <section className="mb-6 border-b border-[var(--border)] pb-2">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">شكل مقطع الأنبوب</label>
              <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'بيضاوي' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => updateTube('shape', 'بيضاوي')}
                >بيضاوي</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'دائري' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => updateTube('shape', 'دائري')}
                >دائري</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.tube.shape === 'مخصص' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => updateTube('shape', 'مخصص')}
                >STL مخصص</button>
              </div>

              {config.tube.shape === 'مخصص' && (
                <div className="mb-4 bg-white/5 p-3 rounded border border-[var(--accent)]/50 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer inline-block px-3 py-1 bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white rounded text-[10px] uppercase font-bold transition-colors">
                      {config.tube.customStlName ? `تغيير: ${config.tube.customStlName}` : 'اختيار ملف STL'}
                      <input type="file" accept=".stl" className="hidden" onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          const buffer = await file.arrayBuffer();
                          onUpdate({ ...config, tube: { ...config.tube, shape: 'مخصص', customStlBuffer: buffer, customStlName: file.name } });
                        }
                      }}/>
                    </label>
                    {config.tube.customStlName && (
                      <button
                        onClick={() => onUpdate({ ...config, tube: { ...config.tube, customStlBuffer: null as any, customStlName: undefined } })}
                        className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 rounded text-[10px] uppercase font-bold transition-colors border border-red-800"
                      >مسح (Clear STL)</button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between text-[11px] mb-3 text-[var(--text-dim)]">
                <span>عرض: <b className="text-[var(--text-main)] font-mono">{config.tube.width}</b></span>
                <span>ارتفاع: <b className="text-[var(--text-main)] font-mono">{config.tube.shape === 'دائري' ? config.tube.width : config.tube.height}</b></span>
              </div>

              {renderSlider(config.tube.shape === 'دائري' ? 'قطر الأنبوب' : 'عرض الأنبوب', config.tube.width, v => updateTube('width', v), 10, 80)}
              {config.tube.shape !== 'دائري' && renderSlider('ارتفاع الأنبوب', config.tube.height, v => updateTube('height', v), 5, 50)}
              {renderSlider('سماكة المعدن', config.tube.thickness, v => updateTube('thickness', v), 0.5, 5.0, 0.1)}
              {config.tube.shape !== 'دائري' && renderSlider('تنعيم الحواف (R)', config.tube.cornerRadius, v => updateTube('cornerRadius', v), 0, Math.min(config.tube.width/2, config.tube.height/2), 0.1)}
              {renderSlider('الطول الكلي للأنبوب', config.tube.totalLength, v => updateTube('totalLength', v), 50, 300)}
              {renderSlider('طول القطعة الناتجة', config.tube.partLength, v => updateTube('partLength', v), 10, config.tube.totalLength)}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           STEP 2: PAN DESIGN
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'pan-design' && (
          <>
            <section className="mb-6 border-b border-[var(--border)] pb-2">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">أبعاد المقلاة</label>
              {renderSlider('القطر السفلي (القاع)', config.pan.bottomDiameter, v => updatePan('bottomDiameter', v), 50, 400)}
              {renderSlider('القطر العلوي', config.pan.topDiameter, v => updatePan('topDiameter', v), 100, 500)}
              {renderSlider('الارتفاع الكلي', config.pan.height, v => updatePan('height', v), 20, 200)}
              {renderSlider('نصف قطر تقوس الجدار', config.pan.curveRadius, v => updatePan('curveRadius', v), 0, 250, 5)}
              {renderSlider('قوس القاع (Fillet)', config.pan.bottomFilletRadius, v => updatePan('bottomFilletRadius', v), 0, 30, 0.5)}

              {renderToggle('إزالة قاع المقلاة (Remove Bottom)', !!config.pan.removeBottom, () => onUpdate({ ...config, pan: { ...config.pan, removeBottom: !config.pan.removeBottom } }))}
              {renderToggle('إضافة حافة علوية (Rim)', config.pan.addRim, () => onUpdate({ ...config, pan: { ...config.pan, addRim: !config.pan.addRim } }))}

              {config.pan.addRim && renderSlider('ارتفاع الحافة', config.pan.rimHeight, v => updatePan('rimHeight', v), 1, 20, 0.5)}
              {config.pan.addRim && renderSlider('سماكة الحافة', config.pan.rimThickness, v => updatePan('rimThickness', v), 0, 10, 0.5)}
            </section>

            <section className="mb-6 border-b border-[var(--border)] pb-2">
              <label className="block text-[10px] font-bold text-amber-400 uppercase mb-3 text-right">فيزياء المقلاة (Shell)</label>
              {renderSlider('سمك المعدن (mm)', config.pan.wallThickness, v => updatePan('wallThickness', v), 0.5, 10, 0.1)}
              {renderToggle('عرض مجوّف (Shell)', config.pan.useShellPreview, () => onUpdate({ ...config, pan: { ...config.pan, useShellPreview: !config.pan.useShellPreview } }), '#f59e0b')}
              {renderToggle('قياسات القالب الداخلي', config.pan.innerMoldMode, () => onUpdate({ ...config, pan: { ...config.pan, innerMoldMode: !config.pan.innerMoldMode } }), '#22d3ee')}
              {renderToggle('تطبيق السمك على القطع', config.pan.applyThicknessToCut, () => onUpdate({ ...config, pan: { ...config.pan, applyThicknessToCut: !config.pan.applyThicknessToCut } }), '#ef4444')}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           STEP 3: HANDLE DESIGN
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'handle-design' && (
          <>
            <section className="mb-4 border-b border-[var(--border)] pb-2">
              <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-3 text-right">شكل المقبض</label>
              <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.handle.shape === 'rectangular' ? 'bg-emerald-500 text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => updateHandle('shape', 'rectangular')}
                >مستطيل</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.handle.shape === 'cylindrical' ? 'bg-emerald-500 text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => updateHandle('shape', 'cylindrical')}
                >أسطواني</button>
              </div>
              {renderToggle('جسم صلب (بدون تجويف)', !!config.handle.solid,
                () => onUpdate({ ...config, handle: { ...config.handle, solid: !config.handle.solid } }),
                '#22c55e')}
              {renderSlider(config.handle.shape === 'cylindrical' ? 'قطر المقبض' : 'عرض المقبض', config.handle.width, v => updateHandle('width', v), 10, 60)}
              {config.handle.shape === 'rectangular' && renderSlider('ارتفاع المقبض', config.handle.height, v => updateHandle('height', v), 5, 40)}
              {renderSlider('طول المقبض', config.handle.depth, v => updateHandle('depth', v), 30, 200)}
              {!config.handle.solid && renderSlider('سماكة المعدن', config.handle.thickness, v => updateHandle('thickness', v), 0.5, 5, 0.1)}
              {config.handle.shape === 'rectangular' && renderSlider('تنعيم الحواف (R)', config.handle.cornerRadius, v => updateHandle('cornerRadius', v), 0, Math.min(config.handle.width/2, config.handle.height/2), 0.1)}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           STEP 4: PAN-TUBE INTERSECTION
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'pan-tube-cut' && (
          <>
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3">وضع العرض</label>
              <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded">
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, renderMode: 'preview' })}
                >معاينة التلامس</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'boolean' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, renderMode: 'boolean' })}
                >قطع صفري (A)</button>
              </div>
            </section>

            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">ضبط تركيب طرف A (المقلاة)</label>
              {renderSlider('زاوية الميل', config.assembly.tiltAngle, v => updateAssembly('tiltAngle', v), -90, 90)}
              {renderSlider('دوران Twist', config.assembly.handleAngleY, v => updateAssembly('handleAngleY', v), -45, 45)}
              {renderSlider('الارتفاع من القاع', config.assembly.heightOffset, v => updateAssembly('heightOffset', v), 0, 150)}
              {renderSlider('عمق الاختراق', config.assembly.insertionDistance, v => updateAssembly('insertionDistance', v), 0, 150)}
            </section>

            <section className="mb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المعايير البصرية</label>
              {renderToggle('عرض خط التماس (سرج الحصان)', config.showBorders,
                () => onUpdate({ ...config, showBorders: !config.showBorders }),
                '#a855f7')}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           STEP 5: TUBE-HANDLE INTERSECTION
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'tube-handle-cut' && (
          <>
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3">وضع العرض</label>
              <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded">
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, renderMode: 'preview' })}
                >معاينة التلامس</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'boolean' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, renderMode: 'boolean' })}
                >قطع صفري (B)</button>
              </div>
            </section>

            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-emerald-400 uppercase mb-3 text-right">ضبط تركيب طرف B (المقبض)</label>
              {renderSlider('زاوية الميل', config.handle.angleX, v => updateHandle('angleX', v), -45, 45)}
              {renderSlider('دوران Twist', config.handle.angleY, v => updateHandle('angleY', v), -45, 45)}
              {renderSlider('إزاحة جانبية', config.handle.offsetZ, v => updateHandle('offsetZ', v), -50, 50)}
              {renderSlider('عمق الاختراق', config.handle.insertionDepth, v => updateHandle('insertionDepth', v), 0, 50)}
            </section>

            <section className="mb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المعايير البصرية</label>
              {renderToggle('عرض خط التماس', config.showBorders,
                () => onUpdate({ ...config, showBorders: !config.showBorders }),
                '#22c55e')}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
           STEP 6: FINAL INSPECTION
           ════════════════════════════════════════════════════════════════ */}
        {wizardStep === 'final-inspect' && (
          <>
            {/* Nesting */}
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">وضع التعشيش (Nesting)</label>
              <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.nestingMode === 'single' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, nestingMode: 'single' })}
                >قطعة واحدة</button>
                <button
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.nestingMode === 'twin' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                  onClick={() => onUpdate({ ...config, nestingMode: 'twin' })}
                >قطعتان متعاكستان</button>
              </div>
              {config.nestingMode === 'twin' && renderSlider('خلوص الفاصل (Slug Gap)', config.slugGap, v => onUpdate({ ...config, slugGap: v }), 0, 20, 0.5)}
            </section>

            {/* Final Touches */}
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">اللمسات النهائية</label>
              {renderToggle('تنعيم حافة القطع (0.2mm)', config.addFillet, () => onUpdate({ ...config, addFillet: !config.addFillet }))}
              {renderToggle('إضافة تخليص حراري (+0.1mm)', config.thermalClearance, () => onUpdate({ ...config, thermalClearance: !config.thermalClearance }))}
              {renderToggle('التعليم المرجعي (Laser Mark)', config.markOrientation, () => onUpdate({ ...config, markOrientation: !config.markOrientation }))}
            </section>

            {/* DraftingView / CNCView buttons */}
            <section className="mb-6 border-b border-[var(--border)] pb-4">
              <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">مشاهد إضافية</label>
              <div className="flex gap-2">
                <button onClick={onOpenDrafting} className="flex-1 py-2 text-[10px] font-bold uppercase border border-blue-500/50 text-blue-400 rounded hover:bg-blue-500/10 transition-colors">مخططات 2D</button>
                <button onClick={onOpenCNC} className="flex-1 py-2 text-[10px] font-bold uppercase border border-green-500/50 text-green-400 rounded hover:bg-green-500/10 transition-colors">تحضير CNC</button>
              </div>
            </section>

            {/* Export */}
            <section>
              <button
                onClick={() => { try { onExport(); } catch (err) { alert('فشل تصدير STL: ' + (err instanceof Error ? err.message : 'خطأ')); } }}
                className="w-full py-2 mb-2 bg-[var(--accent)] hover:opacity-90 transition-opacity text-white font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_0_15px_rgba(242,125,38,0.3)]"
              >تصدير 3D مباشر (STL)</button>
              <button
                onClick={() => {
                  try {
                    const s = generateCadQueryScript(config);
                    const blob = new Blob([s], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `ZeroGap_Pipeline_${Date.now()}.py`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (err) { alert('فشل: ' + (err instanceof Error ? err.message : '')); }
                }}
                className="w-full py-2 mb-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold text-[11px] uppercase tracking-widest rounded border border-blue-500"
              >تنزيل سكريبت المصنع (STEP)</button>
              <button
                onClick={() => {
                  try {
                    const r = generateGcode(config);
                    if (r.error) { alert(r.error); return; }
                    const blob = new Blob([r.gcode], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `MecaFlow_Cut_${Date.now()}.nc`;
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                  } catch (err) { alert('فشل: ' + (err instanceof Error ? err.message : '')); }
                }}
                className="w-full py-2 bg-green-600 hover:bg-green-500 transition-colors text-white font-bold text-[11px] uppercase tracking-widest rounded border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              >تحميل كود الماكينة (G-CODE)</button>
            </section>
          </>
        )}
      </div>

      {/* ── Wizard Navigation (bottom) ─────────────────────────────────── */}
      <div className="wizard-nav">
        <button className="wizard-nav-btn" onClick={onPrev} disabled={!canGoPrev}>
          ← السابق
        </button>
        <button className="wizard-nav-btn primary" onClick={onNext} disabled={!canGoNext}>
          {wizardStep === 'tube-handle-cut' ? 'المعاينة النهائية →' : 'التالي →'}
        </button>
      </div>
    </aside>
  );
};

export default ZeroGapControlPanel;
