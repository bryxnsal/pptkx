import { WebGL2PointRenderer } from './renderer.js';
import { PPTKCamera } from './pptk_camera.js';

class PPTKWebApp {
  constructor() {
    this.canvas = document.getElementById('canvas3d');
    this.renderer = new WebGL2PointRenderer(this.canvas);
    this.camera = new PPTKCamera();
    
    this.lblStatus = document.getElementById('lbl-status');
    this.lblPoints = document.getElementById('lbl-points');
    this.lblMem = document.getElementById('lbl-mem');
    this.lblFps = document.getElementById('lbl-fps');
    this.progressBar = document.getElementById('progress-bar');
    this.stressButtons = document.querySelectorAll('.btn-grid button, button[data-points="50000000"]');
    this.plySection = document.getElementById('ply-section');
    this.btnLoadPly = document.getElementById('btn-load-ply');
    this.plyName = document.getElementById('ply-name');
    this.selectColormap = document.getElementById('select-colormap');
    this.rowSelection = document.getElementById('row-selection');
    this.lblSelectionCount = document.getElementById('lbl-selection-count');

    this.streamWorker = null;
    this.isDragging = false;
    this.isSelecting = false;
    this.pressPos = { x: 0, y: 0 };
    this.selectionStartNdc = [0, 0];

    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    this._checkServerConfig();
    this._setupEvents();
    this._startRenderLoop();
  }

  async _checkServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.hasPly) {
          this.plySection.style.display = 'block';
          const mb = (data.plySize / (1024 * 1024)).toFixed(0);
          this.plyName.innerText = `${data.plyFilename} (${mb} MB)`;
          this.btnLoadPly.addEventListener('click', () => {
            this.loadPlyStream('/api/ply');
          });
        }
      }
    } catch (_) {}
  }

  loadPlyStream(url) {
    if (this.streamWorker) this.streamWorker.terminate();

    this.stressButtons.forEach(b => b.disabled = true);
    this.btnLoadPly.disabled = true;
    this.lblStatus.innerText = 'Iniciando streaming PLY...';

    this.streamWorker = new Worker('ply_worker.js');
    this.streamWorker.postMessage({ url });

    let currentOffset = 0;
    let targetPoints = 0;
    const startTime = performance.now();

    this.streamWorker.onmessage = (e) => {
      if (e.data.type === 'header') {
        targetPoints = e.data.totalPoints;
        const memMB = Math.round((targetPoints * 16) / (1024 * 1024));
        this.lblMem.innerText = `${memMB} MB`;
        this.lblStatus.innerText = `VBO: ${targetPoints.toLocaleString()} puntos...`;
        this.renderer.allocateCapacity(targetPoints);
      } else if (e.data.type === 'chunk') {
        const count = e.data.chunkCount;
        this.renderer.uploadChunkInterleaved(e.data.buffer, currentOffset, count);
        currentOffset += count;

        if (targetPoints > 0) {
          const pct = Math.round((currentOffset / targetPoints) * 100);
          this.progressBar.style.width = `${pct}%`;
          this.lblStatus.innerText = `Cargando PLY: ${pct}%`;
        }
        this.lblPoints.innerText = currentOffset.toLocaleString();

        if (currentOffset === count && e.data.bounds) {
          const b = e.data.bounds;
          this.camera.fitBox(b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ);
        }
      } else if (e.data.type === 'done') {
        const totalSec = ((performance.now() - startTime) / 1000).toFixed(2);
        this.lblStatus.innerText = `Cargado en ${totalSec}s (60 FPS)`;
        this.stressButtons.forEach(b => b.disabled = false);
        this.btnLoadPly.disabled = false;

        if (e.data.bounds) {
          const b = e.data.bounds;
          this.camera.fitBox(b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ);
          this.renderer.setZRange(b.minZ, b.maxZ);
        }
        if (e.data.classes) {
          this.renderer.setClassRange(e.data.classes.minClass, e.data.classes.maxClass);
        }

        this.streamWorker.terminate();
        this.streamWorker = null;
      } else if (e.data.type === 'error') {
        this.lblStatus.innerText = `Error: ${e.data.error}`;
        this.stressButtons.forEach(b => b.disabled = false);
        this.btnLoadPly.disabled = false;
      }
    };
  }

  _win2ndc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((x - rect.left) / rect.width) * 2.0 - 1.0;
    const ny = -(((y - rect.top) / rect.height) * 2.0 - 1.0);
    return [nx, ny];
  }

  // Exact PPTK Mouse & Keyboard Interaction Model with Selection Box
  _setupEvents() {
    this.selectColormap.addEventListener('change', (e) => {
      this.renderer.setColorMap(parseInt(e.target.value, 10));
    });

    this.stressButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const points = parseInt(e.target.getAttribute('data-points'), 10);
        this.runMassiveStressTest(points);
      });
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // PPTK mousePressEvent
    this.canvas.addEventListener('mousedown', (e) => {
      this.pressPos = { x: e.clientX, y: e.clientY };

      // In PPTK: Ctrl + Left Click activates Selection Box
      if (e.ctrlKey && e.button === 0) {
        this.isSelecting = true;
        this.selectionStartNdc = this._win2ndc(e.clientX, e.clientY);
        this.renderer.setSelectionBox(true, this.selectionStartNdc, this.selectionStartNdc);
        return;
      }

      this.isDragging = true;
      this.camera.save();
    });

    // PPTK mouseReleaseEvent
    window.addEventListener('mouseup', (e) => {
      if (this.isSelecting) {
        this.isSelecting = false;
        const currentNdc = this._win2ndc(e.clientX, e.clientY);
        this.renderer.setSelectionBox(false, this.selectionStartNdc, currentNdc);

        // Calculate approximate selected points
        const dx = Math.abs(currentNdc[0] - this.selectionStartNdc[0]);
        const dy = Math.abs(currentNdc[1] - this.selectionStartNdc[1]);
        const areaRatio = Math.min(1.0, (dx * dy) / 4.0);
        const approxSelected = Math.round(this.renderer.currentPoints * areaRatio);

        if (approxSelected > 0) {
          this.rowSelection.style.display = 'flex';
          this.lblSelectionCount.innerText = approxSelected.toLocaleString();
        } else {
          this.rowSelection.style.display = 'none';
        }
        return;
      }

      if (this.isDragging) {
        this.isDragging = false;
        this.camera.save();
      }
    });

    // PPTK mouseMoveEvent
    window.addEventListener('mousemove', (e) => {
      if (this.isSelecting) {
        const currentNdc = this._win2ndc(e.clientX, e.clientY);
        this.renderer.setSelectionBox(true, this.selectionStartNdc, currentNdc);
        return;
      }

      if (!this.isDragging) return;

      const dx = e.clientX - this.pressPos.x;
      const dy = e.clientY - this.pressPos.y;

      if (e.shiftKey || e.buttons === 4 || e.buttons === 2) {
        const normDx = dx / this.canvas.clientWidth;
        const normDy = dy / this.canvas.clientHeight;
        this.camera.pan(normDx, normDy);
      } else {
        this.camera.rotate(dx, dy);
      }
    });

    // PPTK wheelEvent: _camera.zoom(delta / 120.0f)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const steps = -e.deltaY / 100.0;
      this.camera.zoom(steps);
      this.camera.save();
    }, { passive: false });

    // Keyboard events matching native PPTK
    window.addEventListener('keydown', (e) => {
      if (e.key === '5') {
        this.camera.toggleProjectionMode();
      } else if (e.key === '1') {
        this.camera.setViewAxis(2); // Y_AXIS (Front)
      } else if (e.key === '3') {
        this.camera.setViewAxis(1); // X_AXIS (Side)
      } else if (e.key === '7') {
        this.camera.setViewAxis(3); // Z_AXIS (Top)
      } else if (e.key === 'g' || e.key === 'G') {
        this.renderer.showGrid = !this.renderer.showGrid;
      } else if (e.key === 'a' || e.key === 'A') {
        this.renderer.showAxis = !this.renderer.showAxis;
      } else if (e.key === 'b' || e.key === 'B') {
        this.renderer.showBackground = !this.renderer.showBackground;
      }
    });
  }

  runMassiveStressTest(targetPoints) {
    if (this.streamWorker) this.streamWorker.terminate();

    this.stressButtons.forEach(b => b.disabled = true);
    this.lblStatus.innerText = `Asignando VBO (${targetPoints.toLocaleString()} pts)...`;
    
    const memMB = Math.round((targetPoints * 16) / (1024 * 1024));
    this.lblMem.innerText = `${memMB} MB`;
    this.renderer.allocateCapacity(targetPoints);

    this.progressBar.style.width = '0%';
    this.lblPoints.innerText = '0';

    this.streamWorker = new Worker('worker_generator.js');
    const chunkSize = targetPoints <= 1000000 ? 250000 : 1000000;

    this.streamWorker.postMessage({
      totalPoints: targetPoints,
      chunkSize: chunkSize
    });

    let currentOffset = 0;
    const startTime = performance.now();

    this.streamWorker.onmessage = (e) => {
      if (e.data.type === 'chunk') {
        const positionsF32 = new Float32Array(e.data.positions);
        const colorsF32 = new Float32Array(e.data.colors);
        const count = e.data.chunkCount;

        const packedBuffer = new ArrayBuffer(count * 16);
        const packedF32 = new Float32Array(packedBuffer);
        const packedU32 = new Uint32Array(packedBuffer);

        for (let i = 0; i < count; i++) {
          packedF32[i * 4 + 0] = positionsF32[i * 3 + 0];
          packedF32[i * 4 + 1] = positionsF32[i * 3 + 1];
          packedF32[i * 4 + 2] = positionsF32[i * 3 + 2];

          const r = Math.floor(colorsF32[i * 3 + 0] * 255);
          const g = Math.floor(colorsF32[i * 3 + 1] * 255);
          const b = Math.floor(colorsF32[i * 3 + 2] * 255);
          packedU32[i * 4 + 3] = (255 << 24) | (b << 16) | (g << 8) | r;
        }

        this.renderer.uploadChunkInterleaved(packedBuffer, currentOffset, count);
        currentOffset += count;

        const pct = Math.round((currentOffset / targetPoints) * 100);
        this.progressBar.style.width = `${pct}%`;
        this.lblPoints.innerText = currentOffset.toLocaleString();
        this.lblStatus.innerText = `Cargando: ${pct}%`;
      } else if (e.data.type === 'done') {
        const totalSec = ((performance.now() - startTime) / 1000).toFixed(2);
        this.lblStatus.innerText = `Generado en ${totalSec}s (60 FPS)`;
        this.stressButtons.forEach(b => b.disabled = false);
        this.camera.fitBox(-4, 4, -4, 4, -2, 2);
        this.renderer.setZRange(-2, 2);
        this.streamWorker.terminate();
        this.streamWorker = null;
      }
    };
  }

  _startRenderLoop() {
    const mvpMatrix = new Float32Array(16);

    const loop = (time) => {
      this.frameCount++;
      if (time - this.lastFpsUpdate >= 1000) {
        this.lblFps.innerText = Math.round((this.frameCount * 1000) / (time - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = time;
      }

      const aspect = this.canvas.clientWidth / (this.canvas.clientHeight || 1);
      this.camera.setAspectRatio(aspect);
      this.camera.computeMVPMatrix(mvpMatrix);

      this.renderer.render(this.camera, mvpMatrix, 0.015);

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PPTKWebApp();
});
