# Engineering & Mathematical Logic 🧠 (الهندسة والمنطق الرياضي)

هذا المستند يشرح المبادئ الهندسية والرياضية التي يعتمد عليها محرك **Zero-Gap Laser CAD Pro**.

## 1. نمذجة سطح المقلاة (The Virtual Pan Cutter)

تتم نمذجة المقلاة كسطح دوراني (Surface of Revolution / Lathe) يعتمد على محاور محددة:

### الجدار الجانبي (Quadratic Bezier Curve)
لإنشاء شكل قريب من المقالي الحقيقية، لا نستخدم المخروط البسيط المعتمد على الخطوط المستقيمة (Linear Cone)، بل نستخدم **منحنى بيزيه من الدرجة الثانية (Quadratic Bezier Curve)**:
- **P0**: بداية قوس القاع (Bottom Fillet Tip) الإحداثيات: `(r_bottom - fillet_r + fillet_r, fillet_r)`
- **P1**: نقطة التحكم المركزية (Control Point) وتعتمد على الـ `curveRadius` وتأثير "الانتفاخ" (Bulge Offset).
- **P2**: نقطة الفوهة العلوية للمقلاة `(r_top, height)`.

محصلة الانحناء:
```typescript
const bulge_offset = Math.max(2.0, Math.min(20.0, (200.0 / curve_radius) * 4.0));
const r_mid = (r_bottom + r_top) / 2.0 + bulge_offset;
```
هذا يضمن أن تناقص الـ `curveRadius` سيزيد من تحدب الجدار بشكل يحاكي انتفاخ البدن الفعلي للمقلاة.

### قوس القاع (Bottom Fillet)
انتقال تدريجي ناعم من المركز السطحي بـ `(0,0)` إلى الجدار الجانبي باستخدام قوس يعتمد على `bottomFilletRadius`. هذا القوس يمنع وجود "زاوية ميتة" حادة في قاع المقلاة، وهو السبب الرئيسي في الحصول على تطابق فعلي (Zero-Gap) للـ "الأذنين" (الجانبين الطويلين للقطعة عند ميل المقبض).

---

## 2. المنطق البولياني للتطابق (Zero-Gap Boolean Operation)

النواة الأساسية للنظام تعمل بمنطقية القطع الطرحي للمجسمات (Constructive Solid Geometry - CSG):
$$ Result = Tube - (Pan \cup HandleCutter) $$

### مصفوفة الإحداثيات (Coordinate Alignment)
1. يُموضع **الأنبوب (Tube)** بناءً على Z-axis ويمتد من النقطة `(0,0)`.
2. يتم إزاحة **المقلاة الافتراضية (Pan)** على المحور Z بمسافة `partLength` (طول القطعة الناتجة).
3. يتم إمالة الأنبوب بزاوية `tiltAngle` حول المحور المختار (Y للميل العمودي الطولي، و X للميل العرضي).

---

## 3. منطق التعشيش المزدوج (Twin Nesting Logic / Common Line)

عند تفعيل وضع القطعتين (Nesting Mode = Twin)، يقوم النظام بتطبيق التحويل المعقد (Complex Transformations) التالي:
1. **القطعة الأولى (Part A)**: يتم حسابها كالمعتاد.
2. **الواجهة المائلة**: يتم قطع الطرف الخلفي بزاوية `handleAngle`.
3. **التحويل الخاص (Mirror & Transform)**:
   - استنساخ القطعة الأولى.
   - دوران المحور Y بزاوية 180° `twinMesh.rotateY(Math.PI)`.
   - نقل القطعة بمسافة إجمالية `(totalLength * 2) + slugGap`.
4. **الاتحاد (Union)**: يتم لحام المجسمين لإنتاج قطعة نهائية واحدة تقرأها ماكينات الليزر كمسار مشترك (Common Line). 

---

## 4. قيود الأداء ونقاط الصفر للماكينة (Performance & Machining Limits)

### التمركز للـ Laser Head
عُولجت مشكلة الـ (Offset) بتمركز القطع النهائية بعد القطع:
```typescript
finalMesh.geometry.translate(-centerX, -centerY, -bbox.min.z);
```
تضمن هذه المعادلة أن ماكينة **NcStudio** ستعتبر الـ origin point `(0,0)` في مركز الأنبوب בדיق, بدلاً من اصطدام رأس الليزر بالهيكل المعدني.

### متانة المجسمات للزوايا الصغيرة (CSG Manifold Safety)
لتجنب "الأخطاء الشجرية" (BSP Tree Coplanar edge matching) التي تظهر كفجوات أو اختفاء للمجسم:
- القواطع مثل (Handle Cutter) أكبر 4 مرات تقريباً من الأنبوب.
- الأقسام الداخلية تُزاح بمقدار صغير `Math.max(0.1, ...)` لتجنب نقاط السماكة المنعدمة (Zero-thickness walls).
