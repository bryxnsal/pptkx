# pptkx (Point Processing Toolkit Extended)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/downloads/)
[![Platform: Wayland](https://img.shields.io/badge/display-Wayland%20Native-brightgreen.svg)](https://wayland.freedesktop.org/)

**pptkx** (formerly pptk-wayland) is an actively maintained modernization and fork of the original Point Processing Toolkit (`pptk` by HERE Europe B.V.).

It provides a high-performance 2D/3D point cloud viewer and spatial processing algorithms tailored for modern Linux desktops, featuring **100% native Wayland support**, compatibility with **Python 3.8 through 3.12+**, and support for **NumPy 2.x**.

---

## ✨ Key Improvements in pptkx

* 🚀 **100% Native Wayland Support**:
  - Replaced bundled, outdated Qt 5.6 X11/XCB libraries with native system Qt5 (`qt5-wayland`).
  - Implemented robust EGL/OpenGL context initialization using `QOffscreenSurface` to prevent Wayland surface creation race conditions and segfaults before window mapping.
  - Zero requirement for Xwayland or legacy XCB platform plugins.
* 🐍 **Modern Python Support**:
  - Full support for Python 3.8, 3.9, 3.10, 3.11, and 3.12+.
  - Upgraded C-API to NumPy 2.x with backwards compatibility for NumPy 1.x.
  - Replaced deprecated `ndarray.tostring()` calls with `ndarray.tobytes()`.
* ⚡ **Modern Threading (oneTBB)**:
  - Migrated KD-Tree multithreading from obsolete `tbb::task` and `task_scheduler_init` to modern oneTBB `tbb::task_group`.
* 📦 **Modern PEP 517 / PEP 518 Packaging**:
  - Standard `pyproject.toml` and CMake build backend.
  - Seamless installation with both `uv` and `pip`.

---

## 📸 Overview

![pptk screenshots](/docs/source/tutorials/viewer/images/tutorial_banner.png)

* **3D Point Cloud Viewer**:
  - Accepts any $N \times 3$ numpy array as input.
  - Renders tens of millions of points interactively using octree-based level-of-detail (LOD).
  - Supports interactive point selection, bounding boxes, attribute color maps, and camera dollies.
* **Parallel k-d Tree**:
  - Accelerated k-nearest neighbor (k-NN) queries and radius-based range queries using oneTBB.
* **PCA Normal Estimation**:
  - Fast normal vector calculation and curvature estimation from point cloud neighborhoods.

---

## 🛠️ System Requirements (Linux)

Ensure you have the development libraries and C++17 compiler installed:

### Arch Linux / Manjaro
```bash
sudo pacman -S base-devel cmake ninja qt5-base qt5-wayland onetbb eigen
```

### Ubuntu / Debian (22.04+)
```bash
sudo apt update
sudo apt install build-essential cmake ninja-build qtbase5-dev qtwayland5 libtbb-dev libeigen3-dev
```

### Fedora
```bash
sudo dnf install gcc-c++ cmake ninja-build qt5-qtbase-devel qt5-qtwayland-devel tbb-devel eigen3-devel
```

---

## 📦 Installation

### Using `uv` (Recommended)

From git:
```bash
uv pip install pptkx
# or from git:
uv pip install git+https://github.com/bryxnsal/pptkx.git
```

Or clone and install locally:
```bash
git clone https://github.com/bryxnsal/pptkx.git
cd pptkx
uv pip install pptkx
# or locally:
pip install .
```

### Using standard `pip`

```bash
git clone https://github.com/bryxnsal/pptkx.git
cd pptkx
pip install pptkx
# or locally:
pip install .
```

---

## 🚀 Quickstart

```python
import numpy as np
import pptk

# Generate 100,000 random 3D points
points = np.random.rand(100000, 3)

# Launch native Wayland viewer
v = pptk.viewer(points)

# Adjust point size
v.set(point_size=0.005)

# Color points by height (Z axis)
v.attributes(points[:, 2])

# Set camera focus position
v.set(lookat=[0.5, 0.5, 0.5])
```

---

## 🏗️ Development & Building from Source

Create a virtual environment with `uv` and install dependencies:

```bash
# Create environment with Python 3.12
uv venv --python 3.12
source .venv/bin/activate

# Install build dependencies
uv pip install numpy cmake ninja setuptools wheel build

# Build and install in editable/development mode
pip install --no-build-isolation -e .
```

---

## 📄 License

The original `pptk` project was developed by HERE Europe B.V. and released under the MIT License.
All modern Wayland adaptations and updates in this repository remain under the **MIT License**. See [LICENSE](LICENSE) for details.
