# توثيق API - MecaFlow CAD

## مقدمة
هذا المستند يوضح أبرز المكتبات والإعدادات التي تمت إضافتها لضمان استقرار وتوثيق أداء التطبيق.

### 1. Error Logger (`src/lib/errorLogger.ts`)
نظام متكامل لتتبع الأخطاء في بيئة المتصفح:
- يسجل `uncaught exceptions` و `unhandled promise rejections`.
- يحفظ سجلات الأخطاء داخلياً مع مستويات خطورة مختلفة (LOW, MEDIUM, HIGH, CRITICAL).

### 2. Validators (`src/lib/validators.ts`)
يتيح التحقق الاستباقي للبارامترات المُدخلة قبل إرسالها إلى محرك CSG أو Three.js. يتضمن:
- `validateTubeConfig`: التحقق من أبعاد وسماكة الأنبوب.
- `validatePanConfig`: التحقق من أبعاد وعمق المقلاة (القاطع).
- `checkWebGLSupport`: للتحقق من دعم المتصفح لتصيير الـ 3D.

### 3. Error Boundary (`src/components/ErrorBoundary.tsx`)
مكون React يغلف التطبيق لضمان أنه في حال حدوث أي خطأ في تصيير (Render) مجسمات الـ 3D أو واجهة المستخدم، يتم استبدال الشاشة برسالة خطأ آمنة وأنيقة تُمكن المستخدم من إعادة المحاولة، بدلاً من توقف الواجهة بالكامل (White Screen of Death).

### 4. Performance Optimizer (`src/lib/performanceOptimizer.ts`)
يستخدم لقياس عدد الإطارات في الثانية (FPS)، وقياس استهلاك الذاكرة (Memory Usage).
به تقنيات Debounce و Caching لضمان أن إعادة حساب عمليات الطرح البوليانية (CSG) لا تُهلك المعالج أو تؤدي إلى تجميد المتصفح باستمرار عند سحب مؤشرات التعديل بسرعة.
