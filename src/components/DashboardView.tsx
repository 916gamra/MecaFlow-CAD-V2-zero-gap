import React from 'react';

interface DashboardViewProps {
  onNewPart: () => void;
  onLoadSTL: (buffer: ArrayBuffer, name: string) => void;
  onLoadConfig: () => void;
  hasSavedConfig: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  onNewPart,
  onLoadSTL,
  onLoadConfig,
  hasSavedConfig,
}) => {
  return (
    <div className="dashboard-view" id="dashboard-view">
      {/* Glow backdrop */}
      <div className="dashboard-glow" />

      {/* Logo */}
      <div className="dashboard-logo-section">
        <div className="dashboard-cube">
          <div className="dashboard-cube-inner" />
        </div>
        <h1 className="dashboard-title">MecaFlow-CAD</h1>
        <p className="dashboard-subtitle">نظام القطع بالليزر بتطابق صفري</p>
        <p className="dashboard-version">ZERO-GAP LASER SYSTEM v2.0</p>
      </div>

      {/* Cards */}
      <div className="dashboard-cards">
        {/* New Part */}
        <button className="dashboard-card card-new" onClick={onNewPart}>
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h3 className="card-title">قطعة جديدة</h3>
          <p className="card-desc">تصميم أنبوب ومقلاة ومقبض من الصفر</p>
        </button>

        {/* Upload STL */}
        <label className="dashboard-card card-upload">
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="card-title">رفع ملف STL</h3>
          <p className="card-desc">استيراد شكل مخصص للأنبوب أو القطعة</p>
          <input
            type="file"
            accept=".stl"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                const buffer = await file.arrayBuffer();
                onLoadSTL(buffer, file.name);
              }
            }}
          />
        </label>

        {/* Load Saved */}
        <button
          className={`dashboard-card card-saved ${!hasSavedConfig ? 'disabled' : ''}`}
          onClick={onLoadConfig}
          disabled={!hasSavedConfig}
        >
          <div className="card-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="card-title">القطع المحفوظة</h3>
          <p className="card-desc">
            {hasSavedConfig
              ? 'تحميل آخر إعدادات تم حفظها'
              : 'لا توجد إعدادات محفوظة بعد'}
          </p>
        </button>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <span>CIOB Engineering</span>
        <span>·</span>
        <span>MecaFlow-CAD v2.0</span>
        <span>·</span>
        <span>Zero-Gap Laser Technology</span>
      </div>
    </div>
  );
};

export default DashboardView;
