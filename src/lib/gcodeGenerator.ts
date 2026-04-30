import { ZeroGapState } from '../types';

export const generateGcode = (config: ZeroGapState): { gcode: string, error?: string } => {
  const points: { x: number, a: number }[] = [];
  const numPoints = 360;
  
  const tw = config.tube.width;
  const th = config.tube.shape === 'دائري' ? tw : config.tube.height;
  const tl = config.tube.totalLength;
  const rTop = config.pan.topDiameter / 2.0;
  const rBottom = config.pan.bottomDiameter / 2.0;
  const H = config.pan.height;
  const k = (rTop - rBottom) / H;

  const tiltAxis = config.assembly.tiltAxis || 'X';
  const tiltAngle = config.assembly.tiltAngle;
  // In Three.js: angleRad = (90 - tiltAngle) * (Math.PI / 180)
  const angleRad = (90 - tiltAngle) * (Math.PI / 180);
  const heightOffset = config.assembly.heightOffset || 0;
  const insertionDistance = config.assembly.insertionDistance || 0;
  const partLength = config.tube.partLength || 0;

  for (let i = 0; i <= numPoints; i++) {
    // phi from -pi to pi
    const phi = -Math.PI + (i / numPoints) * 2 * Math.PI;
    const x_local = (tw / 2) * Math.cos(phi);
    const y_local = (th / 2) * Math.sin(phi);

    let a_quad = 0, b_quad = 0, c_quad = 0;

    if (tiltAxis === 'X') {
      const X_w = x_local;
      const A = y_local * Math.cos(angleRad) + heightOffset;
      const B = Math.sin(angleRad);
      const C = rBottom + k * (y_local * Math.sin(angleRad) - insertionDistance - partLength);
      const D = k * Math.cos(angleRad);

      a_quad = B * B - D * D;
      b_quad = -2 * (A * B + C * D);
      c_quad = X_w * X_w + A * A - C * C;
    } else { // 'Y'
      const Y_w = y_local + heightOffset;
      const E = x_local * Math.cos(angleRad);
      const F = Math.sin(angleRad);
      const C = rBottom + k * (-x_local * Math.sin(angleRad) - insertionDistance - partLength);
      const D = k * Math.cos(angleRad);

      a_quad = F * F - D * D;
      b_quad = 2 * (E * F - C * D);
      c_quad = E * E + Y_w * Y_w - C * C;
    }

    // Solve a_quad * z_t^2 + b_quad * z_t + c_quad = 0
    let z_sol = -1;
    if (Math.abs(a_quad) > 1e-7) {
      const delta = b_quad * b_quad - 4 * a_quad * c_quad;
      if (delta >= 0) {
        const sq = Math.sqrt(delta);
        const z1 = (-b_quad + sq) / (2 * a_quad);
        const z2 = (-b_quad - sq) / (2 * a_quad);
        // We want the valid intersection closest to base or top depending on orientation.
        // For a subtract operation, we trace the boundary. We take the max z_t (closest to tube end)
        // or min depending on laser focus. We will take Math.max for now.
        z_sol = Math.max(z1, z2);
      }
    } else if (Math.abs(b_quad) > 1e-7) {
      z_sol = -c_quad / b_quad;
    }

    if (z_sol >= 0 && z_sol <= tl) {
      // Valid intersection.
      // Convert phi to degrees for A-axis
      // Map domain [-pi, pi] -> [0, 360]
      let a_deg = phi * (180 / Math.PI);
      if (a_deg < 0) a_deg += 360;

      // In Three.js, z_t is the length along the tube. X in CNC refers to the tube length axis.
      // Let's use z_sol as the X coordinate.
      points.push({ x: z_sol, a: a_deg });
    }
  }

  if (points.length < 3) {
    return { gcode: "", error: "فشل في توليد المسار. لا يوجد تقاطع كافٍ بين الأنبوب والمقلاة بالزوايا الحالية." };
  }

  // Sort by angle A to create a continuous toolpath
  points.sort((p1, p2) => p1.a - p2.a);

  const feedrate = 1500;
  const lines: string[] = [];
  lines.push("%");
  lines.push("O1000 (MecaFlow Cut)");
  lines.push("G90 G17 G40 G49 G80");
  lines.push("G21");
  lines.push(`F${feedrate}`);
  lines.push(`G00 X${points[0].x.toFixed(3)} A${points[0].a.toFixed(3)}`);
  
  for (const pt of points) {
    lines.push(`G01 X${pt.x.toFixed(3)} A${pt.a.toFixed(3)}`);
  }
  
  // Return to start
  lines.push(`G01 X${points[0].x.toFixed(3)} A${points[0].a.toFixed(3)}`);
  
  lines.push("G00 Z5");
  lines.push("M30");
  lines.push("%");

  return { gcode: lines.join("\n") };
};
