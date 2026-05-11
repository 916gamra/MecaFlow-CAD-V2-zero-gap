import React, { useMemo } from 'react';
import { ZeroGapState } from '../types';
import { generateGcode } from '../lib/gcodeGenerator';

interface CNCViewProps {
  config: ZeroGapState;
}

const CNCView: React.FC<CNCViewProps> = ({ config }) => {
  const gcodeResult = useMemo(() => generateGcode(config), [config]);
  const hasError = !!gcodeResult.error;
  const gcodeLines = hasError ? [] : gcodeResult.gcode.split('\n');
  const estimatedTime = useMemo(() => {
    const points = gcodeLines.length;
    const seconds = Math.ceil(points * 0.5);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:00`;
  }, [gcodeLines.length]);

  const handleExport = () => {
    if (hasError) {
      alert(gcodeResult.error);
      return;
    }
    const blob = new Blob([gcodeResult.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MecaFlow_CNC_${Date.now()}.nc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full bg-(--bg-deep) text-(--accent) font-mono p-8 rounded overflow-hidden flex flex-col" id="cnc-view">
      <div className="bg-(--bg-header) p-4 border border-(--border) rounded-t flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full animate-pulse ${hasError ? 'bg-red-500' : 'bg-(--accent)'}`} />
          <span className="text-[11px] font-bold text-(--text-main) uppercase tracking-widest">NCCSTUDIO V15 G-CODE GEN</span>
        </div>
        <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-[#0c0d10] text-[10px] rounded border border-(--border) text-(--text-dim)">Laser PWR: 1500W</span>
            <span className="px-2 py-0.5 bg-[#0c0d10] text-[10px] rounded border border-(--border) text-(--text-dim)">Gas: O2</span>
        </div>
      </div>

      {config.tube.shape === 'مخصص' && (
        <div className="mx-4 mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded flex items-start gap-2">
          <span className="text-yellow-500 mt-0.5">⚠️</span>
          <div className="text-[10px] text-yellow-200/80 leading-relaxed">
            <strong className="block text-yellow-500 mb-1">تنبيه: دقة مسار القص للملفات المخصصة</strong>
            محرك الـ CNC الرياضي الحالي يعتمد نموذج القص المخروطي البيضاوي. بالنسبة لملفات STL المخصصة والأشكال المعقدة، قد يكون مسار القطع المُوَلّد تقريبياً.
          </div>
        </div>
      )}

      {hasError ? (
        <div className="flex-1 overflow-y-auto p-4 bg-[#0c0d10] border-x border-(--border)">
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
            <h3 className="text-red-500 font-bold text-sm mb-2">خطأ في توليد G-Code</h3>
            <p className="text-(--text-dim) text-xs">{gcodeResult.error}</p>
            <p className="text-(--text-dim) text-xs mt-2">تحقق من زاوية الميل ومسافة الاختراق</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 bg-[#0c0d10] border-x border-(--border) space-y-1 text-[12px]">
          {gcodeLines.map((line, idx) => {
            const isComment = line.startsWith('(') || line.startsWith(';');
            const isMCode = line.startsWith('M');
            const isGCode = line.startsWith('G');
            return (
              <p
                key={idx}
                className={
                  isComment ? 'text-(--text-dim) opacity-50' :
                  isMCode ? 'text-(--text-main)' :
                  isGCode ? 'text-(--accent) font-bold' :
                  'text-(--text-dim)'
                }
              >
                {line}
              </p>
            );
          })}
          <p className="animate-pulse">_</p>
        </div>
      )}

      <div className="p-4 bg-(--bg-header) border border-(--border) rounded-b flex justify-between items-center">
        <div className="text-[10px] text-(--text-dim) uppercase tracking-widest font-bold">
          EST TUBE CUT TIME: {hasError ? '--:--:--' : estimatedTime}
        </div>
        <button
          onClick={handleExport}
          className="px-6 py-2 bg-(--accent) text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity uppercase tracking-widest shadow-[0_0_15px_rgba(242,125,38,0.2)]"
        >
           تصدير مسار الليزر
        </button>
      </div>
    </div>
  );
};

export default CNCView;