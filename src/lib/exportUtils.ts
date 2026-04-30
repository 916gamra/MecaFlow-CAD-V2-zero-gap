export const generateCadQueryScript = (config: any) => {
  return `"""
Zero-Gap Laser CAD - Auto-Generated Script
هذا السكربت تم توليده تلقائياً من التطبيق.

# ==========================================
# 📄 تقرير الإنتاج (Production Metadata)
# ==========================================
# التاريخ: ${new Date().toLocaleString('ar-EG')}
# قياسات الأنبوب: ${config.tube.width}x${config.tube.height} mm (سماكة: ${config.tube.thickness} mm)
# المقلاة: ⌀ الفوهة ${config.pan.topDiameter} / ⌀ القاعدة ${config.pan.bottomDiameter} 
# زاوية التركيب: ${config.assembly.tiltAngle}°
# التعشيش: ${config.nestingMode === 'twin' ? 'مزدوج (توفير في الخامات)' : 'مفرد'}
"""

import cadquery as cq
import os

# ==========================================
# 1. المعاملات المستوردة من الواجهة
# ==========================================
# أبعاد الأنبوب
tube_shape = "${config.tube.shape}"
tube_major = ${config.tube.width}
tube_minor = ${config.tube.shape === 'دائري' ? config.tube.width : config.tube.height}
wall_thickness = ${config.tube.thickness}
total_tube_length = ${config.tube.totalLength}
part_length = ${config.tube.partLength}
tube_corner_radius = ${config.tube.shape === 'دائري' ? config.tube.width / 2.0 : config.tube.cornerRadius}

# شكل المقلاة
pan_top_dia = ${config.pan.topDiameter}
pan_bottom_dia = ${config.pan.bottomDiameter}
pan_height = ${config.pan.height}
bottom_fillet = ${config.pan.bottomFilletRadius}
pan_add_rim = ${config.pan.addRim ? 'True' : 'False'}
pan_rim_height = ${config.pan.rimHeight || 3.0}
pan_rim_thickness = ${config.pan.rimThickness || 2.0}

# زوايا الإمالة والتركيب
tilt_angle = ${config.assembly.tiltAngle}
tilt_axis = "${config.assembly.tiltAxis}"
handle_angle_x = ${config.assembly.handleAngleX || 0}
handle_angle_y = ${config.assembly.handleAngleY || 0}
handle_offset = ${config.assembly.handleOffset || 0}
insertion_distance = ${config.assembly.insertionDistance || 0}
height_offset = ${config.assembly.heightOffset || 0}

# التعشيش واللمسات
nesting_mode = "${config.nestingMode}"
slug_gap = ${config.slugGap}
apply_fillet = ${config.addFillet ? 'True' : 'False'}
thermal_clearance = ${config.thermalClearance ? 'True' : 'False'}
mark_orientation = ${config.markOrientation ? 'True' : 'False'}

# ==========================================
# 2. دوال النمذجة المتطورة (Zero-Gap Engine)
# ==========================================
def ensure_solid(part):
    part = part.clean()
    if not part.val().isValid():
        print("تحذير: الجسم الناتج غير صالح هندسياً")
    return part

def create_pan(top_dia, bottom_dia, height, fillet_r, add_rim, rim_height, rim_thick):
    # إنشاء المقلاة كجسم قاطع (Cutter)
    r_top, r_bottom = top_dia/2.0, bottom_dia/2.0
    # بناء المخروط
    pan = (cq.Workplane("XY")
        .circle(r_bottom)
        .workplane(offset=height)
        .circle(r_top)
        .loft())
    # إضافة التنعيم في القاع من الجذور لضمان التطابق
    if fillet_r > 0:
        pan = pan.edges("<Z").fillet(fillet_r)
        
    if add_rim:
        rim = cq.Workplane("XY").circle(r_top + rim_thick).circle(r_top).extrude(rim_height)
        rim = rim.translate((0,0,height - rim_height))
        pan = pan.union(rim)
    return pan

def create_tube(shape, major, minor, length, thickness, radius, clearance=False):
    delta = 0.1 if clearance else 0.0
    
    if shape == "مخصص":
        print("ملاحظة: تم استخدام STL مخصص في المتصفح. هذا السكريبت سيستخدم أنبوباً بيضاوياً كبديل مؤقت. لنتائج مطابقة، استبدل هذه الدالة بكود استيراد STEP أو STL الخاص بك في CadQuery.")
        shape = "بيضاوي"

    if shape == "دائري":
        outer = cq.Workplane("XY").circle(major/2.0).extrude(length)
        inner_dia = max(0.1, major - 2*thickness + delta)
        inner = cq.Workplane("XY").circle(inner_dia/2.0).extrude(length)
        return outer.cut(inner)
    else:
        outer = cq.Workplane("XY").rect(major, minor).extrude(length)
        if radius > 0:
            outer = outer.edges("|Z").fillet(radius)
            
        inner_major = max(0.1, major - 2*thickness + delta)
        inner_minor = max(0.1, minor - 2*thickness + delta)
        inner_radius = max(0.1, radius - thickness + delta)
        
        if inner_major > 0 and inner_minor > 0:
            inner = cq.Workplane("XY").rect(inner_major, inner_minor).extrude(length)
            if inner_radius > 0:
                inner = inner.edges("|Z").fillet(inner_radius)
            return outer.cut(inner)
        return outer

def cut_with_pan(tube, pan, tilt_angle, tilt_axis, pan_z_position, ins_dist=0, h_offset=0):
    panned = pan.translate((0,0, pan_z_position))
    axis_vec = (1,0,0) if tilt_axis == "X" else (0,1,0)
    rotated_tube = tube.rotate((0,0,0), axis_vec, tilt_angle)
    positioned_tube = rotated_tube.translate((0, h_offset, -ins_dist))
    return positioned_tube.cut(panned)

def cut_handle_end(tube, angle_x, angle_y, offset_y, length):
    # الحل الجذري: استخدام صندوق قاطع صلب במيلان مركب
    cutting_box = (
        cq.Workplane("XY")
        .rect(500, 500)
        .extrude(500)
        .rotate((0,0,0), (1,0,0), -angle_x)
        .rotate((0,0,0), (0,1,0), -angle_y)
        .translate((0, offset_y, length))
    )
    return tube.cut(cutting_box)

def finalize_part(part, nesting_mode, slug_gap, length):
    final_obj = part
    
    if nesting_mode == "twin":
        # إنشاء القطعة الثانية المعكوسة وتدويرها للحفاظ على التماثل
        part2 = part.rotate((0,0,0), (0,1,0), 180).translate((0, 0, (length * 2) + slug_gap))
        final_obj = part.union(part2)
    
    # --- معالجة التمركز من الجذور ---
    bbox = final_obj.val().BoundingBox()
    center_x = (bbox.xmin + bbox.xmax) / 2.0
    center_y = (bbox.ymin + bbox.ymax) / 2.0
    center_z = (bbox.zmin + bbox.zmax) / 2.0
    
    # إزاحة الجسم بالكامل ليكون في المنتصف تماماً عند (0,0,0)
    centered_part = final_obj.translate((-center_x, -center_y, -center_z))
    
    return centered_part

def add_laser_mark(part, minor, length):
    # الفكرة: الأنبوب ممتد على المحور Z، وعرضه major وارتفاعه minor.
    # يتم الحفر على السطح العلوي (Y = minor/2) بمسافة قريبة من الطرف الخلفي (طول القطعة)
    # الثقب بقطر 1mm (نصف قطره 0.5) 
    mark_tool = cq.Workplane("XZ").center(0, length - 15).circle(0.5).extrude(minor, both=True)
    return part.cut(mark_tool)

# ==========================================
# 3. التنفيذ وإنشاء الملف (Execution)
# ==========================================
print("جاري إنشاء المقلاة والأنبوب...")
pan = create_pan(pan_top_dia, pan_bottom_dia, pan_height, bottom_fillet, pan_add_rim, pan_rim_height, pan_rim_thickness)
tube = create_tube(tube_shape, tube_major, tube_minor, total_tube_length, wall_thickness, tube_corner_radius, thermal_clearance)

print("جاري القطع لتطابق الصفر...")
part = cut_with_pan(tube, pan, tilt_angle, tilt_axis, part_length, insertion_distance, height_offset)
part = ensure_solid(part)
part = cut_handle_end(part, handle_angle_x, handle_angle_y, handle_offset, total_tube_length)
part = ensure_solid(part)

if mark_orientation:
    print("جاري حفر العلامة المرجعية للتركيب...")
    part = add_laser_mark(part, tube_minor, total_tube_length)

# إنهاء ووضع القطع في المركز
part = finalize_part(part, nesting_mode, slug_gap, total_tube_length)

if apply_fillet:
    print("جاري إضافة التنعيم لحواف الليزر...")
    try:
        part = part.fillet(0.2)
    except:
        pass

# ==========================================
# 4. التصدير النهائي للماكينة
# ==========================================
output_filename = "ZeroGap_Final_Machine.step"
cq.exporters.export(part, output_filename, tolerance=0.01, angularTolerance=0.1)
print(f"✅ تم تصدير التصميم بنجاح وصيغة STEP: {os.path.abspath(output_filename)}")
print("النظام الآن مبرمج لنقاط الصفر 0,0,0 ومستعد لبرامج CAM مباشرة.")
`;
};

