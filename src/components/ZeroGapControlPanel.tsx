import React from 'react';
import { ZeroGapState } from '../types';
import { generateCadQueryScript } from '../lib/exportUtils';
import { generateGcode } from '../lib/gcodeGenerator';
import { STLExporter } from 'three-stdlib';
import * as THREE from 'three';

interface ControlPanelProps {
  config: ZeroGapState;
  onUpdate: (config: ZeroGapState) => void;
  onExport: () => void;
}

const PrecisionControl = ({ 
  label, val, onChange, min, max, step 
}: { 
  label: string, val: number, onChange: (v: number) => void, min: number, max: number, step: number 
}) => {
  const handleUpdate = (newVal: number) => {
    let bounded = Math.max(min, Math.min(max, newVal));
    // round to correct decimal places based on step
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
            min={min}
            max={max}
            step={step}
            value={val}
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
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={val}
        onChange={(e) => handleUpdate(parseFloat(e.target.value) || 0)}
        className="w-full h-1 mt-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-blue)]"
      />
    </div>
  );
};

const ZeroGapControlPanel: React.FC<ControlPanelProps> = ({ config, onUpdate, onExport }) => {
  const updatePan = (key: keyof ZeroGapState['pan'], val: string | number) => {
    const numericVal = typeof val === 'string' ? parseFloat(val) || 0 : val;
    onUpdate({ ...config, pan: { ...config.pan, [key]: numericVal } });
  };
  const updateTube = (key: keyof ZeroGapState['tube'], val: string | number) => {
    const newVal = (key === 'shape') ? val : (typeof val === 'string' ? parseFloat(val) || 0 : val);
    onUpdate({ ...config, tube: { ...config.tube, [key]: newVal } });
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

  return (
    <aside className="w-[340px] h-full glass-panel border-l border-[var(--border)] flex flex-col" id="zero-gap-panel">
      <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-white/5">
        <div>
          <h3 className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-widest">لوحة التحكم</h3>
          <p className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5">MecaFlow CAD / Config</p>
        </div>
        <div className="flex gap-2">
           <label className="cursor-pointer px-2 py-1 bg-black/40 border border-[var(--border)] rounded text-[9px] text-[var(--text-main)] hover:border-[var(--accent-blue)] transition-colors">
             تحميل
             <input type="file" accept=".json" className="hidden" onChange={(e) => {
               if (e.target.files && e.target.files[0]) {
                 const r = new FileReader();
                 r.onload = ev => {
                   try { onUpdate(JSON.parse(ev.target?.result as string)); } catch(e) { alert('ملف غير صالح'); }
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
      
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        
        {/* Render Mode */}
        <div className="mb-6 mb-8 border-b border-[var(--border)] pb-4">
           <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3">حالة العرض والفيزياء (Simulation)</label>
           <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded">
             <button 
               className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'preview' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
               onClick={() => onUpdate({ ...config, renderMode: 'preview' })}
             >تقاطع التحضير</button>
             <button 
               className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.renderMode === 'boolean' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
               onClick={() => onUpdate({ ...config, renderMode: 'boolean' })}
             >التطابق الصفري</button>
           </div>
        </div>

        {/* Pan Parameters */}
        <section className="mb-6 border-b border-[var(--border)] pb-2">
          <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">أبعاد المقلاة (أداة القطع)</label>
          {renderSlider('القطر السفلي القاع', config.pan.bottomDiameter, v => updatePan('bottomDiameter', v), 50, 400)}
          {renderSlider('القطر العلوي', config.pan.topDiameter, v => updatePan('topDiameter', v), 100, 500)}
          {renderSlider('الارتفاع الكلي', config.pan.height, v => updatePan('height', v), 20, 200)}
          {renderSlider('نصف قطر تقوس الجدار', config.pan.curveRadius, v => updatePan('curveRadius', v), 50, 250, 5)}
          {renderSlider('قوس القاع (Fillet)', config.pan.bottomFilletRadius, v => updatePan('bottomFilletRadius', v), 0, 30, 0.5)}
          
          <button 
            onClick={() => onUpdate({ ...config, pan: { ...config.pan, addRim: !config.pan.addRim } })}
            className={`w-full py-2 mb-2 text-[10px] font-bold uppercase border border-[var(--border)] rounded flex items-center justify-between px-3 ${config.pan.addRim ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-dim)] hover:border-[var(--text-main)]'}`}
          >
            <span>إضافة حافة علوية (Rim)</span>
            <div className={`w-3 h-3 rounded-full ${config.pan.addRim ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
          </button>
          
          {config.pan.addRim && renderSlider('ارتفاع الحافة العلوية', config.pan.rimHeight, v => updatePan('rimHeight', v), 1, 20, 0.5)}
          {config.pan.addRim && renderSlider('سماكة الحافة العلوية', config.pan.rimThickness, v => updatePan('rimThickness', v), 0, 10, 0.5)}
        </section>

        {/* Tube Parameters */}
        <section className="mb-6 border-b border-[var(--border)] pb-2">
          <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">المقبض / الأنبوب (الخامة الأساسية)</label>
          
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
               title="استيراد ملف STL مخصص ليكون الأنبوب أو القطعة المقطوعة"
             >STL مخصص</button>
          </div>

          {config.tube.shape === 'مخصص' && (
            <div className="mb-4 bg-white/5 p-3 rounded border border-[var(--accent)]/50 text-center">
              <label className="cursor-pointer inline-block px-3 py-1 bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white rounded text-[10px] uppercase font-bold transition-colors">
                {config.tube.customStlName ? `تم تحميل: ${config.tube.customStlName}` : 'اختيار ملف STL'}
                <input type="file" accept=".stl" className="hidden" onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const buffer = await file.arrayBuffer();
                    onUpdate({ ...config, tube: { ...config.tube, shape: 'مخصص', customStlBuffer: buffer, customStlName: file.name } });
                  }
                }}/>
              </label>
              <p className="text-[9px] text-[var(--accent)] mt-2">ملاحظة: سيتم توسيط ودمج هندسة الـ STL لمحاكاتها وقطعها</p>
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

        {/* Nesting Parameters */}
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
           {config.nestingMode === 'twin' && renderSlider('خلوص الفاصل (Slug Gap)', config.slugGap, v => onUpdate({ ...config, slugGap: parseFloat(v) || 0 }), 0, 20, 0.5)}
           {config.nestingMode === 'twin' && (
             <div className="mt-3 bg-[#13151a] border border-green-500/30 rounded p-3 flex flex-col items-center">
               <span className="text-[10px] text-[var(--text-dim)] mb-1">حجم الوفر في الخامات (Estimated Scrap Saved)</span>
               <span className="text-lg font-bold text-green-400">
                 ~ {(0.5 * config.tube.width * (config.tube.shape === 'دائري' ? config.tube.width : config.tube.height) * Math.tan((config.assembly.handleAngleY || 0) * Math.PI / 180)).toFixed(1)} mm²
               </span>
               <span className="text-[9px] text-[var(--text-dim)]">لكل دورتي إنتاج بفضل التطابق المائل</span>
             </div>
           )}
        </section>

        {/* Assembly Parameters */}
        <section className="mb-2 border-b border-[var(--border)] pb-4">
          <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">زاوية التركيب والتموضع</label>
          <div className="flex bg-[#0c0d10] p-1 border border-[var(--border)] rounded mb-4">
             <button 
               className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.assembly.tiltAxis === 'X' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
               onClick={() => updateAssembly('tiltAxis', 'X')}
             >محور X</button>
             <button 
               className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors rounded ${config.assembly.tiltAxis === 'Y' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
               onClick={() => updateAssembly('tiltAxis', 'Y')}
             >محور Y</button>
           </div>
          {renderSlider('زاوية ميلان المقلاة', config.assembly.tiltAngle, v => updateAssembly('tiltAngle', v), -90, 90)}
          {renderSlider('زاوية المقبض X', config.assembly.handleAngleX, v => updateAssembly('handleAngleX', v), -45, 45)}
          {renderSlider('زاوية المقبض Y', config.assembly.handleAngleY, v => updateAssembly('handleAngleY', v), -45, 45)}
          {renderSlider('تشفيت القطع (Z-Offset)', config.assembly.handleOffset, v => updateAssembly('handleOffset', v), -50, 50)}
          {renderSlider('الارتفاع من القاع', config.assembly.heightOffset, v => updateAssembly('heightOffset', v), 0, 150)}
          {renderSlider('مسافة الاختراق', config.assembly.insertionDistance, v => updateAssembly('insertionDistance', v), 0, 150)}
        </section>

        {/* Final Touches */}
        <section className="mt-4 pb-4">
          <label className="block text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 text-right">اللمسات النهائية</label>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => onUpdate({ ...config, addFillet: !config.addFillet })}
              className={`w-full py-2 text-[10px] font-bold uppercase border border-[var(--border)] rounded flex items-center justify-between px-3 ${config.addFillet ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-dim)] hover:border-[var(--text-main)]'}`}
            >
              <span>تنعيم حافة القطع (0.2mm)</span>
              <div className={`w-3 h-3 rounded-full ${config.addFillet ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
            </button>
            <button 
              onClick={() => onUpdate({ ...config, thermalClearance: !config.thermalClearance })}
              className={`w-full py-2 text-[10px] font-bold uppercase border border-[var(--border)] rounded flex items-center justify-between px-3 ${config.thermalClearance ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-dim)] hover:border-[var(--text-main)]'}`}
            >
              <span>إضافة تخليص حراري (+0.1mm)</span>
              <div className={`w-3 h-3 rounded-full ${config.thermalClearance ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
            </button>
            <button 
              onClick={() => onUpdate({ ...config, markOrientation: !config.markOrientation })}
              className={`w-full py-2 text-[10px] font-bold uppercase border border-[var(--border)] rounded flex items-center justify-between px-3 ${config.markOrientation ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-dim)] hover:border-[var(--text-main)]'}`}
            >
              <span>التعليم المرجعي (Laser Mark)</span>
              <div className={`w-3 h-3 rounded-full ${config.markOrientation ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
            </button>
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-[var(--border)] bg-[#090a0c]">
        <button 
          onClick={() => {
            try {
              onExport();
            } catch (err) {
              alert('فشل تصدير STL: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
            }
          }}
          className="w-full py-2 mb-2 bg-[var(--accent)] hover:opacity-90 transition-opacity text-white font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_0_15px_rgba(242,125,38,0.3)]"
        >
          تصدير 3D مباشر (STL)
        </button>
        <button 
          onClick={() => {
            try {
              const scriptContent = generateCadQueryScript(config);
              const blob = new Blob([scriptContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ZeroGap_Pipeline_${new Date().getTime()}.py`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              alert('فشل تصدير Python: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
            }
          }}
          className="w-full py-2 mb-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold text-[11px] uppercase tracking-widest rounded border border-blue-500"
        >
          تنزيل سكريبت المصنع (STEP)
        </button>
        <button 
          onClick={() => {
            try {
              const result = generateGcode(config);
              if (result.error) {
                alert(result.error);
                return;
              }
              const blob = new Blob([result.gcode], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `MecaFlow_Cut_${new Date().getTime()}.nc`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              alert('فشل تصدير G-Code: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
            }
          }}
          className="w-full py-2 bg-green-600 hover:bg-green-500 transition-colors text-white font-bold text-[11px] uppercase tracking-widest rounded border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
        >
          تحميل كود الماكينة (G-CODE)
        </button>
        <p className="text-[9px] text-[var(--text-dim)] mt-3 text-center leading-relaxed">
          جاهز للتوجيه لمنظومة الليزر (Scrap-free Guarantee)
        </p>
      </div>
    </aside>
  );
};

export default ZeroGapControlPanel;
