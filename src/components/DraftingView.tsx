import React from 'react';
import { ZeroGapState } from '../types';

interface DraftingViewProps {
  config: ZeroGapState;
}

const DraftingView: React.FC<DraftingViewProps> = ({ config }) => {
  return (
    <div className="w-full h-full bg-(--bg-deep) p-8 rounded overflow-auto flex flex-col items-center justify-center p-8" id="drafting-view">
      <div className="w-full max-w-4xl bg-(--bg-panel) border border-(--border) rounded flex flex-col p-8 shadow-2xl">
         <div className="w-full p-4 border border-(--border) bg-[#0c0d10] text-(--accent) rounded mb-8 text-center flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase tracking-widest text-left">
              ZERO-GAP ENGINEERING SHEET<br/>
              <span className="text-[9px] text-(--text-dim)">المخطط الهندسي للمقبض</span>
            </h4>
            <div className="text-right">
              <p className="text-[10px] text-(--text-dim)">SYSTEM_AUTO</p>
              <p className="text-[10px] text-(--text-main) font-mono">{new Date().toLocaleDateString()}</p>
            </div>
         </div>

         <div className="w-full grid grid-cols-2 gap-8 mb-8">
            <div className="border border-(--border) bg-[#0c0d10] p-6 text-center text-(--text-dim) font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px]">
               <div className="relative w-40 h-40 border-2 border-dashed border-(--accent) rounded-full flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-(--accent)/50"></div>
                  <div className="absolute left-0 right-0 h-px bg-(--accent)/50"></div>
                  <span className="bg-[#0c0d10] px-2 text-(--accent)">Ø TOP {config.pan.topDiameter}mm</span>
               </div>
               [ مسقط رأسي للمقلاة - قطر: {config.pan.topDiameter}mm ]
            </div>
            <div className="border border-(--border) bg-[#0c0d10] p-6 text-center text-(--text-dim) font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px]">
               <div className="relative w-20 h-40 border-2 border-(--accent) rounded-sm flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-(--accent)/50"></div>
                  <span className="bg-[#0c0d10] px-2 text-(--accent) absolute -right-6 origin-left -rotate-90 whitespace-nowrap">TUBE L: {config.tube.totalLength}mm</span>
               </div>
               [ مسقط جانبي للأنبوب - أبعاد: {config.tube.width}x{config.tube.shape === 'دائري' ? config.tube.width : config.tube.height}mm ]
            </div>
         </div>

         <div className="space-y-4 w-full text-left font-mono text-[10px] mb-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#0c0d10] p-3 border border-(--border) flex justify-between">
                 <span className="text-(--text-dim)">BOOLEAN ALGORITHM:</span>
                 <span className="text-(--text-main) font-bold">EXACT CSG</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-(--border) flex justify-between">
                 <span className="text-(--text-dim)">SURFACE QUALITY:</span>
                 <span className="text-(--text-main) font-bold text-green-500">ZERO SCAR / ZERO GAP</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-(--border) flex justify-between">
                 <span className="text-(--text-dim)">SCALE:</span>
                 <span className="text-(--text-main) font-bold">1:1 (True Scale)</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-(--border) flex justify-between">
                 <span className="text-(--text-dim)">EXPORT:</span>
                 <span className="text-(--text-main) font-bold">STEP / STL Solid</span>
               </div>
            </div>
         </div>

         <button className="w-full py-4 bg-(--accent) text-white text-[11px] font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
             تصدير المخطط (PDF ISO A3)
         </button>
      </div>
    </div>
  );
};

export default DraftingView;
