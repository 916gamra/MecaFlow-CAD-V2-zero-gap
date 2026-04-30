import React from 'react';

const DraftingView: React.FC = () => {
  return (
    <div className="w-full h-full bg-[var(--bg-deep)] p-8 rounded overflow-auto flex flex-col items-center justify-center p-8" id="drafting-view">
      <div className="w-full max-w-4xl bg-[var(--bg-panel)] border border-[var(--border)] rounded flex flex-col p-8 shadow-2xl">
         <div className="w-full p-4 border border-[var(--border)] bg-[#0c0d10] text-[var(--accent)] rounded mb-8 text-center flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase tracking-widest text-left">
              ZERO-GAP ENGINEERING SHEET<br/>
              <span className="text-[9px] text-[var(--text-dim)]">المخطط الهندسي للمقبض</span>
            </h4>
            <div className="text-right">
              <p className="text-[10px] text-[var(--text-dim)]">SYSTEM_AUTO</p>
              <p className="text-[10px] text-[var(--text-main)] font-mono">{new Date().toLocaleDateString()}</p>
            </div>
         </div>
         
         <div className="w-full grid grid-cols-2 gap-8 mb-8">
            <div className="border border-[var(--border)] bg-[#0c0d10] p-6 text-center text-[var(--text-dim)] font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px]">
               <div className="relative w-40 h-40 border-2 border-dashed border-[var(--accent)] rounded-full flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--accent)]/50"></div>
                  <div className="absolute left-0 right-0 h-px bg-[var(--accent)]/50"></div>
                  <span className="bg-[#0c0d10] px-2 text-[var(--accent)]">Ø TOP</span>
               </div>
               [ مسقط رأسي للمقلاة ]
            </div>
            <div className="border border-[var(--border)] bg-[#0c0d10] p-6 text-center text-[var(--text-dim)] font-mono text-[10px] flex flex-col items-center justify-center min-h-[250px]">
               <div className="relative w-20 h-40 border-2 border-[var(--accent)] rounded-sm flex items-center justify-center mb-4">
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--accent)]/50"></div>
                  <span className="bg-[#0c0d10] px-2 text-[var(--accent)] absolute -right-6 origin-left -rotate-90 whitespace-nowrap">TUBE LENGTH</span>
               </div>
               [ مسقط جانبي للأنبوب مع زاوية القص ]
            </div>
         </div>

         <div className="space-y-4 w-full text-left font-mono text-[10px] mb-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#0c0d10] p-3 border border-[var(--border)] flex justify-between">
                 <span className="text-[var(--text-dim)]">BOOLEAN ALGORITHM:</span>
                 <span className="text-[var(--text-main)] font-bold">EXACT CSG</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-[var(--border)] flex justify-between">
                 <span className="text-[var(--text-dim)]">SURFACE QUALITY:</span>
                 <span className="text-[var(--text-main)] font-bold text-green-500">ZERO SCAR / ZERO GAP</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-[var(--border)] flex justify-between">
                 <span className="text-[var(--text-dim)]">SCALE:</span>
                 <span className="text-[var(--text-main)] font-bold">1:1 (True Scale)</span>
               </div>
               <div className="bg-[#0c0d10] p-3 border border-[var(--border)] flex justify-between">
                 <span className="text-[var(--text-dim)]">EXPORT:</span>
                 <span className="text-[var(--text-main)] font-bold">STEP / STL Solid</span>
               </div>
            </div>
         </div>
         
         <button className="w-full py-4 bg-[var(--accent)] text-white text-[11px] font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
             تصدير المخطط (PDF ISO A3)
         </button>
      </div>
    </div>
  );
};

export default DraftingView;
