#ifndef __WEB_POINT_CLOUD_CORE_H__
#define __WEB_POINT_CLOUD_CORE_H__

#include <vector>
#include "box3.h"
#include "octree.h"
#include "web_camera.h"

// Pure C++ headless point cloud processor using PPTK's Octree LOD algorithm
class WebPointCloudCore {
 public:
  WebPointCloudCore()
      : _num_points(0),
        _point_size(0.01f),
        _color_map_min(0.0f),
        _color_map_max(1.0f),
        _color_map_auto(true) {}

  ~WebPointCloudCore() { clear(); }

  void clear() {
    _positions.clear();
    _sizes.clear();
    _colors.clear();
    _scalars.clear();
    _octree_ids.clear();
    _selection_mask.clear();
    _num_points = 0;
  }

  // Load raw point positions (Nx3 float array). Builds the Octree.
  void loadPoints(const float* data, size_t num_points, size_t max_leaf_size = 32) {
    _positions.assign(data, data + num_points * 3);
    _num_points = num_points;

    _sizes.clear();
    _octree.buildTree(_positions, _sizes, max_leaf_size);
    _octree_ids.resize(_num_points);

    _full_box = vltools::Box3<float>();
    if (_num_points > 0) {
      _full_box.addPoints(&_positions[0], _num_points);
    }
  }

  void loadColors(const float* data, size_t num_points) {
    _colors.assign(data, data + num_points * 3);
  }

  void loadScalars(const float* data, size_t num_points) {
    _scalars.assign(data, data + num_points);
    if (_color_map_auto && num_points > 0) {
      _color_map_min = _scalars[0];
      _color_map_max = _scalars[0];
      for (size_t i = 1; i < num_points; ++i) {
        if (_scalars[i] < _color_map_min) _color_map_min = _scalars[i];
        if (_scalars[i] > _color_map_max) _color_map_max = _scalars[i];
      }
    }
  }

  // Updates visible points based on Camera frustum and LOD criterion
  // Returns number of visible points/nodes to draw
  size_t updateLOD(const WebCamera& camera, float pixel_size = 1.0f) {
    if (_num_points == 0) return 0;

    Octree::CameraFrustum frustum;
    float eye[3], right[3], up[3], view[3];
    camera.getCameraPosition(eye);
    camera.getRightVector(right);
    camera.getUpVector(up);
    camera.getViewVector(view);

    std::copy(eye, eye + 3, frustum.eye);
    std::copy(right, right + 3, frustum.right);
    std::copy(up, up + 3, frustum.up);
    std::copy(view, view + 3, frustum.view);

    float d_near, d_far;
    camera.computeNearFar(d_near, d_far, _full_box);
    frustum.z_near = -std::max(0.1f, 0.8f * d_near);
    frustum.setImagePlane(camera.getVerticalFOV(), camera.getAspectRatio());

    float z_near = -std::max(0.1f, 0.8f * d_near);
    float z_far = -1.2f * d_far;
    float point_size_proj = (camera.getProjectionMode() == WebCamera::PERSPECTIVE)
                                ? _point_size / (2.0f * camera.getTop())
                                : _point_size / (2.0f * camera.getTop() * camera.getCameraDistance());

    size_t count = _octree.cullAndLOD(
        _octree_ids, frustum, z_near, z_far,
        (camera.getProjectionMode() == WebCamera::PERSPECTIVE),
        point_size_proj, pixel_size);

    return count;
  }

  // Pointer accessors for direct WebGL / WebGPU buffer transfers
  const float* getPositionsPtr() const { return _positions.data(); }
  size_t getPositionsByteSize() const { return _positions.size() * sizeof(float); }

  const float* getSizesPtr() const { return _sizes.data(); }
  size_t getSizesByteSize() const { return _sizes.size() * sizeof(float); }

  const float* getColorsPtr() const { return _colors.data(); }
  size_t getColorsByteSize() const { return _colors.size() * sizeof(float); }

  const float* getScalarsPtr() const { return _scalars.data(); }
  size_t getScalarsByteSize() const { return _scalars.size() * sizeof(float); }

  const unsigned int* getIndicesPtr() const { return _octree_ids.data(); }

  size_t getNumPoints() const { return _num_points; }
  const vltools::Box3<float>& getBoundingBox() const { return _full_box; }

  void setPointSize(float size) { _point_size = size; }
  float getPointSize() const { return _point_size; }

  void setColorMapRange(float min_val, float max_val) {
    _color_map_min = min_val;
    _color_map_max = max_val;
    _color_map_auto = false;
  }

 private:
  size_t _num_points;
  float _point_size;
  float _color_map_min;
  float _color_map_max;
  bool _color_map_auto;

  vltools::Box3<float> _full_box;
  Octree _octree;

  std::vector<float> _positions;
  std::vector<float> _sizes;
  std::vector<float> _colors;
  std::vector<float> _scalars;
  std::vector<float> _selection_mask;
  std::vector<unsigned int> _octree_ids;
};

#endif  // __WEB_POINT_CLOUD_CORE_H__
