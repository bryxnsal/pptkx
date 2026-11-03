// High-Performance GPU Colormaps ported for WebGL2 Shaders
// Includes Jet (classic PPTK default), Viridis, Plasma, Inferno, and Elevation Grayscale

export const COLOR_MAPS = {
  jet: {
    name: 'Jet (PPTK Default)',
    id: 0,
    shaderFunc: `
      vec3 colormap(float t) {
        t = clamp(t, 0.0, 1.0);
        float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
        float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
        float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
        return vec3(r, g, b);
      }
    `
  },
  viridis: {
    name: 'Viridis',
    id: 1,
    shaderFunc: `
      vec3 colormap(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.267, 0.004, 0.329);
        vec3 c1 = vec3(0.127, 0.566, 0.550);
        vec3 c2 = vec3(0.993, 0.906, 0.143);
        if (t < 0.5) {
          return mix(c0, c1, t * 2.0);
        } else {
          return mix(c1, c2, (t - 0.5) * 2.0);
        }
      }
    `
  },
  plasma: {
    name: 'Plasma',
    id: 2,
    shaderFunc: `
      vec3 colormap(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.050, 0.029, 0.528);
        vec3 c1 = vec3(0.798, 0.280, 0.469);
        vec3 c2 = vec3(0.940, 0.975, 0.131);
        if (t < 0.5) {
          return mix(c0, c1, t * 2.0);
        } else {
          return mix(c1, c2, (t - 0.5) * 2.0);
        }
      }
    `
  },
  elevation: {
    name: 'Elevation Gray',
    id: 3,
    shaderFunc: `
      vec3 colormap(float t) {
        t = clamp(t, 0.0, 1.0);
        return vec3(t);
      }
    `
  }
};
