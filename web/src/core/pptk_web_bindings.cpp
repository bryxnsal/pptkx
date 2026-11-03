#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "web_point_cloud_core.h"

using namespace emscripten;

class PPTKWebEngine {
 public:
  PPTKWebEngine() : _core(), _camera() {}

  void loadPointsFromJS(uintptr_t data_ptr, size_t num_points) {
    const float* ptr = reinterpret_cast<const float*>(data_ptr);
    _core.loadPoints(ptr, num_points);
    _camera = WebCamera(_core.getBoundingBox());
  }

  void loadColorsFromJS(uintptr_t data_ptr, size_t num_points) {
    const float* ptr = reinterpret_cast<const float*>(data_ptr);
    _core.loadColors(ptr, num_points);
  }

  void loadScalarsFromJS(uintptr_t data_ptr, size_t num_points) {
    const float* ptr = reinterpret_cast<const float*>(data_ptr);
    _core.loadScalars(ptr, num_points);
  }

  size_t updateLOD(float pixel_size) {
    return _core.updateLOD(_camera, pixel_size);
  }

  // Camera controls
  void setViewport(float aspect_ratio, float vfov) {
    _camera.setAspectRatio(aspect_ratio);
    _camera.setVerticalFOV(vfov);
  }

  void mouseRotate(float dx, float dy) {
    _camera.mousePan(dx, dy); // or orbit controls
  }

  void mouseZoom(float factor) {
    _camera.mouseZoom(factor);
  }

  void mouseTranslate(float dx, float dy) {
    _camera.mouseTranslate(dx, dy);
  }

  // Zero-copy pointers to Wasm Memory
  uintptr_t getPositionsPointer() const {
    return reinterpret_cast<uintptr_t>(_core.getPositionsPtr());
  }

  uintptr_t getSizesPointer() const {
    return reinterpret_cast<uintptr_t>(_core.getSizesPtr());
  }

  uintptr_t getColorsPointer() const {
    return reinterpret_cast<uintptr_t>(_core.getColorsPtr());
  }

  uintptr_t getIndicesPointer() const {
    return reinterpret_cast<uintptr_t>(_core.getIndicesPtr());
  }

  val getMVPMatrix() const {
    float mvp[16];
    _camera.computeMVPMatrix(mvp, _core.getBoundingBox());
    return val(typed_memory_view(16, mvp));
  }

  void setPointSize(float size) {
    _core.setPointSize(size);
  }

  size_t getNumPoints() const {
    return _core.getNumPoints();
  }

 private:
  WebPointCloudCore _core;
  WebCamera _camera;
};

EMSCRIPTEN_BINDINGS(pptk_web_module) {
  class_<PPTKWebEngine>("PPTKWebEngine")
      .constructor<>()
      .function("loadPointsFromJS", &PPTKWebEngine::loadPointsFromJS)
      .function("loadColorsFromJS", &PPTKWebEngine::loadColorsFromJS)
      .function("loadScalarsFromJS", &PPTKWebEngine::loadScalarsFromJS)
      .function("updateLOD", &PPTKWebEngine::updateLOD)
      .function("setViewport", &PPTKWebEngine::setViewport)
      .function("mouseRotate", &PPTKWebEngine::mouseRotate)
      .function("mouseZoom", &PPTKWebEngine::mouseZoom)
      .function("mouseTranslate", &PPTKWebEngine::mouseTranslate)
      .function("getPositionsPointer", &PPTKWebEngine::getPositionsPointer)
      .function("getSizesPointer", &PPTKWebEngine::getSizesPointer)
      .function("getColorsPointer", &PPTKWebEngine::getColorsPointer)
      .function("getIndicesPointer", &PPTKWebEngine::getIndicesPointer)
      .function("getMVPMatrix", &PPTKWebEngine::getMVPMatrix)
      .function("setPointSize", &PPTKWebEngine::setPointSize)
      .function("getNumPoints", &PPTKWebEngine::getNumPoints);
}
