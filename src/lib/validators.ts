export interface ValidationErrorItem {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(public errors: ValidationErrorItem[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export function validateTubeConfig(config: any) {
  const errors: ValidationErrorItem[] = [];

  if (!config.width || config.width <= 0) {
    errors.push({ field: 'width', message: 'العرض يجب أن يكون أكبر من 0' });
  }
  if (!config.height || config.height <= 0) {
    errors.push({ field: 'height', message: 'الارتفاع يجب أن يكون أكبر من 0' });
  }
  const maxThickness = Math.min(config.width, config.height) / 2 - 0.1;
  if (!config.thickness || config.thickness <= 0 || config.thickness >= maxThickness) {
    errors.push({ field: 'thickness', message: `سمك الجدار يجب أن يكون أقل من ${maxThickness.toFixed(1)}mm` });
  }
  if (!config.totalLength || config.totalLength <= 0) {
    errors.push({ field: 'totalLength', message: 'الطول الإجمالي يجب أن يكون أكبر من 0' });
  }
  if (!config.partLength || config.partLength <= 0 || config.partLength > config.totalLength) {
    errors.push({ field: 'partLength', message: 'طول الجزء يجب أن يكون بين 0 والطول الإجمالي' });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

export function validatePanConfig(config: any) {
  const errors: ValidationErrorItem[] = [];

  if (!config.bottomDiameter || config.bottomDiameter <= 0) {
    errors.push({ field: 'bottomDiameter', message: 'قطر القاع يجب أن يكون أكبر من 0' });
  }
  if (!config.topDiameter || config.topDiameter <= config.bottomDiameter) {
    errors.push({ field: 'topDiameter', message: 'قطر الأعلى يجب أن يكون أكبر من قطر القاع' });
  }
  if (!config.height || config.height <= 0) {
    errors.push({ field: 'height', message: 'الارتفاع يجب أن يكون أكبر من 0' });
  }
  if (config.curveRadius != null && config.curveRadius < 0) {
    errors.push({ field: 'curveRadius', message: 'نصف قطر المنحنى لا يمكن أن يكون سالباً' });
  }
  if (config.wallThickness != null && config.wallThickness <= 0) {
    errors.push({ field: 'wallThickness', message: 'سمك الجدار يجب أن يكون أكبر من 0' });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

export function validateAssemblyConfig(config: any) {
  const errors: ValidationErrorItem[] = [];

  if (config.tiltAngle < -90 || config.tiltAngle > 90) {
    errors.push({ field: 'tiltAngle', message: 'زاوية الميل يجب أن تكون بين -90 و 90 درجة' });
  }
  if (config.insertionDistance < 0) {
    errors.push({ field: 'insertionDistance', message: 'مسافة الإدراج يجب أن تكون موجبة' });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('webgl2'))
    );
  } catch (e) {
    return false;
  }
}
