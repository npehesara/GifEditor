import { FilterConfig } from '../types/editor';

// Helper to multiply two 4x4 matrices
export function multiplyMatrices(a: number[], b: number[]): number[] {
  const result = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        sum += a[r * 4 + i] * b[i * 4 + c];
      }
      result[r * 4 + c] = sum;
    }
  }
  return result;
}

export function getIdentityMatrix(): number[] {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

export function generateColorMatrix(filter: FilterConfig): number[] {
  let matrix = getIdentityMatrix();

  // 1. Brightness / Exposure (Multiplicative vs Additive)
  // Usually brightness adds, exposure multiplies, but Android ColorMatrix often uses brightness as additive 
  // and we only have 4x4, so we can use the 4th column (assuming alpha = 1.0) for additive offsets.
  const b = filter.brightness / 100.0;
  if (b !== 0) {
    const brightnessMat = getIdentityMatrix();
    brightnessMat[3] = b;  // R offset
    brightnessMat[7] = b;  // G offset
    brightnessMat[11] = b; // B offset
    matrix = multiplyMatrices(brightnessMat, matrix);
  }

  if (filter.exposure !== 0) {
    const exp = 1.0 + (filter.exposure / 100.0);
    const expMat = getIdentityMatrix();
    expMat[0] = exp; expMat[5] = exp; expMat[10] = exp;
    matrix = multiplyMatrices(expMat, matrix);
  }

  // 2. Contrast
  if (filter.contrast !== 0) {
    const c = 1.0 + (filter.contrast / 100.0);
    const o = 0.5 * (1.0 - c); // Offset to center contrast around 0.5
    const contrastMat = [
      c, 0, 0, o,
      0, c, 0, o,
      0, 0, c, o,
      0, 0, 0, 1
    ];
    matrix = multiplyMatrices(contrastMat, matrix);
  }

  // 3. Saturation
  if (filter.saturation !== 0) {
    const s = 1.0 + (filter.saturation / 100.0);
    const invS = 1.0 - s;
    const rY = 0.299 * invS;
    const gY = 0.587 * invS;
    const bY = 0.114 * invS;
    
    const satMat = [
      rY + s, gY,     bY,     0,
      rY,     gY + s, bY,     0,
      rY,     gY,     bY + s, 0,
      0,      0,      0,      1
    ];
    matrix = multiplyMatrices(satMat, matrix);
  }

  // 4. Hue
  if (filter.hue !== 0) {
    // Hue approximation
    const hueAngle = (filter.hue / 180) * Math.PI;
    const cosVal = Math.cos(hueAngle);
    const sinVal = Math.sin(hueAngle);
    const lumR = 0.213;
    const lumG = 0.715;
    const lumB = 0.072;
    
    const hueMat = [
      lumR + cosVal * (1 - lumR) + sinVal * (-lumR),
      lumG + cosVal * (-lumG) + sinVal * (-lumG),
      lumB + cosVal * (-lumB) + sinVal * (1 - lumB),
      0,
      
      lumR + cosVal * (-lumR) + sinVal * (0.143),
      lumG + cosVal * (1 - lumG) + sinVal * (0.140),
      lumB + cosVal * (-lumB) + sinVal * (-0.283),
      0,
      
      lumR + cosVal * (-lumR) + sinVal * (-(1 - lumR)),
      lumG + cosVal * (-lumG) + sinVal * (lumG),
      lumB + cosVal * (1 - lumB) + sinVal * (lumB),
      0,
      
      0, 0, 0, 1
    ];
    matrix = multiplyMatrices(hueMat, matrix);
  }

  // 5. Temperature (Blue/Yellow shift)
  if (filter.temperature !== 0) {
    const temp = filter.temperature / 100.0;
    // Positive temp -> warm (add red, subtract blue)
    const rShift = temp > 0 ? temp * 0.2 : 0;
    const bShift = temp < 0 ? Math.abs(temp) * 0.2 : 0;
    const tempMat = getIdentityMatrix();
    tempMat[3] = rShift;  // offset Red
    tempMat[11] = bShift; // offset Blue
    matrix = multiplyMatrices(tempMat, matrix);
  }

  // 6. Tint (Green/Magenta shift)
  if (filter.tint !== 0) {
    const t = filter.tint / 100.0;
    // Positive -> magenta (add red/blue, subtract green)
    // Negative -> green (add green)
    const tintMat = getIdentityMatrix();
    if (t > 0) {
      tintMat[3] = t * 0.1;
      tintMat[11] = t * 0.1;
      tintMat[7] = -t * 0.1;
    } else {
      tintMat[7] = Math.abs(t) * 0.2;
    }
    matrix = multiplyMatrices(tintMat, matrix);
  }

  // 7. Fade (decrease contrast and lighten shadows)
  if (filter.fade > 0) {
    const f = filter.fade / 100.0;
    const fadeMat = [
      1 - f*0.2, 0, 0, f*0.1,
      0, 1 - f*0.2, 0, f*0.1,
      0, 0, 1 - f*0.2, f*0.1,
      0, 0, 0, 1
    ];
    matrix = multiplyMatrices(fadeMat, matrix);
  }

  return matrix;
}
