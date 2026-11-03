#ifndef __WEB_CAMERA_H__
#define __WEB_CAMERA_H__

#include <algorithm>
#include <cmath>
#include <limits>
#include "box3.h"
#include "camera.h"

// Pure C++ camera controller without Qt dependencies
class WebCamera : public Camera {
 public:
  enum ProjectionMode { PERSPECTIVE = 0, ORTHOGRAPHIC = 1 };
  enum ViewAxis { ARBITRARY_AXIS, X_AXIS, Y_AXIS, Z_AXIS };

  WebCamera()
      : Camera(),
        _vfov(pi() / 4.0f),
        _aspect_ratio(1.0f),
        _projection_mode(PERSPECTIVE),
        _view_axis(ARBITRARY_AXIS) {}

  WebCamera(float xmin, float xmax, float ymin, float ymax, float zmin, float zmax)
      : Camera(xmin, xmax, ymin, ymax, zmin, zmax),
        _vfov(pi() / 4.0f),
        _aspect_ratio(1.0f),
        _projection_mode(PERSPECTIVE),
        _view_axis(ARBITRARY_AXIS) {}

  WebCamera(const vltools::Box3<float>& box)
      : Camera(box.x(0), box.x(1), box.y(0), box.y(1), box.z(0), box.z(1)),
        _vfov(pi() / 4.0f),
        _aspect_ratio(1.0f),
        _projection_mode(PERSPECTIVE),
        _view_axis(ARBITRARY_AXIS) {}

  void getCameraPosition(float out[3]) const { Camera::getCameraPosition(out); }
  void getLookAtPosition(float out[3]) const { Camera::getLookAtPosition(out); }
  void getRightVector(float out[3]) const { Camera::getRightVector(out); }
  void getUpVector(float out[3]) const { Camera::getUpVector(out); }
  void getViewVector(float out[3]) const { Camera::getViewVector(out); }

  void setLookAtPosition(float x, float y, float z) {
    float buf[3] = {x, y, z};
    Camera::setLookAtPosition(buf);
  }

  float getTop() const {
    if (_projection_mode == PERSPECTIVE) {
      return tan(0.5f * _vfov);
    } else {
      return getCameraDistance() * tan(0.5f * _vfov);
    }
  }

  float getRight() const { return _aspect_ratio * getTop(); }
  float getAspectRatio() const { return _aspect_ratio; }
  float getVerticalFOV() const { return _vfov; }
  ProjectionMode getProjectionMode() const { return _projection_mode; }
  ViewAxis getViewAxis() const { return _view_axis; }

  void setAspectRatio(float aspect_ratio) { _aspect_ratio = aspect_ratio; }
  void setVerticalFOV(float vfov) { _vfov = vfov; }
  void setProjectionMode(ProjectionMode mode) { _projection_mode = mode; }

  void setViewAxis(ViewAxis axis) {
    if (axis == X_AXIS) {
      setPhi(0.0f);
      setTheta(0.0f);
    } else if (axis == Y_AXIS) {
      setPhi(-0.5f * pi());
      setTheta(0.0f);
    } else if (axis == Z_AXIS) {
      setPhi(-0.5f * pi());
      setTheta(0.5f * pi());
    }
    _view_axis = axis;
  }

  // Computes column-major 4x4 matrix for WebGL / WebGPU uniform buffer
  void computeMVPMatrix(float out_mat4[16], const vltools::Box3<float>& box) const {
    float view_mat[16];
    float proj_mat[16];
    computeViewMatrix(view_mat);
    computeProjectionMatrix(proj_mat, box);
    multiplyMatrices(out_mat4, proj_mat, view_mat);
  }

  void computeViewMatrix(float out_mat4[16]) const {
    float eye[3], target[3], up[3];
    getCameraPosition(eye);
    getLookAtPosition(target);
    getUpVector(up);

    // Forward vector (z-axis in view space = normalized(eye - target))
    float f[3] = {eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]};
    normalize(f);

    // Right vector (x-axis = normalized(cross(up, f)))
    float r[3];
    cross(r, up, f);
    normalize(r);

    // Recomputed Up vector (y-axis = cross(f, r))
    float u[3];
    cross(u, f, r);

    // Column-major view matrix
    out_mat4[0] = r[0];
    out_mat4[1] = u[0];
    out_mat4[2] = f[0];
    out_mat4[3] = 0.0f;

    out_mat4[4] = r[1];
    out_mat4[5] = u[1];
    out_mat4[6] = f[1];
    out_mat4[7] = 0.0f;

    out_mat4[8] = r[2];
    out_mat4[9] = u[2];
    out_mat4[10] = f[2];
    out_mat4[11] = 0.0f;

    out_mat4[12] = -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]);
    out_mat4[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
    out_mat4[14] = -(f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2]);
    out_mat4[15] = 1.0f;
  }

  void computeProjectionMatrix(float out_mat4[16], const vltools::Box3<float>& box) const {
    float d_near, d_far;
    computeNearFar(d_near, d_far, box);

    for (int i = 0; i < 16; ++i) out_mat4[i] = 0.0f;

    if (_projection_mode == PERSPECTIVE) {
      float near_val = std::max(0.1f, 0.8f * d_near);
      float far_val = 1.2f * d_far;
      float tan_half_fov = std::tan(_vfov * 0.5f);

      out_mat4[0] = 1.0f / (_aspect_ratio * tan_half_fov);
      out_mat4[5] = 1.0f / tan_half_fov;
      out_mat4[10] = -(far_val + near_val) / (far_val - near_val);
      out_mat4[11] = -1.0f;
      out_mat4[14] = -(2.0f * far_val * near_val) / (far_val - near_val);
    } else {
      float t = getCameraDistance() * std::tan(0.5f * _vfov);
      float r = _aspect_ratio * t;
      float near_val = 0.8f * d_near;
      float far_val = 1.2f * d_far;

      out_mat4[0] = 1.0f / r;
      out_mat4[5] = 1.0f / t;
      out_mat4[10] = -2.0f / (far_val - near_val);
      out_mat4[14] = -(far_val + near_val) / (far_val - near_val);
      out_mat4[15] = 1.0f;
    }
  }

  void computeNearFar(float& d_near, float& d_far, const vltools::Box3<float>& box) const {
    d_near = std::numeric_limits<float>::max();
    d_far = -std::numeric_limits<float>::max();

    float view[3], eye[3];
    getViewVector(view);
    getCameraPosition(eye);

    for (std::size_t i = 0; i < 2; i++) {
      for (std::size_t j = 0; j < 2; j++) {
        for (std::size_t k = 0; k < 2; k++) {
          float corner[3] = {box.x(i), box.y(j), box.z(k)};
          float diff[3] = {corner[0] - eye[0], corner[1] - eye[1], corner[2] - eye[2]};
          // dot product with -view
          float t = -(diff[0] * view[0] + diff[1] * view[1] + diff[2] * view[2]);
          d_near = std::min(d_near, t);
          d_far = std::max(d_far, t);
        }
      }
    }
  }

 private:
  static float pi() { return std::atan2(0.0f, -1.0f); }

  static void normalize(float v[3]) {
    float len = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len > 1e-6f) {
      v[0] /= len;
      v[1] /= len;
      v[2] /= len;
    }
  }

  static void cross(float out[3], const float a[3], const float b[3]) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
  }

  // Column-major 4x4 matrix multiplication: out = a * b
  static void multiplyMatrices(float out[16], const float a[16], const float b[16]) {
    for (int col = 0; col < 4; ++col) {
      for (int row = 0; row < 4; ++row) {
        float sum = 0.0f;
        for (int k = 0; k < 4; ++k) {
          sum += a[row + k * 4] * b[k + col * 4];
        }
        out[row + col * 4] = sum;
      }
    }
  }

  float _vfov;
  float _aspect_ratio;
  ProjectionMode _projection_mode;
  ViewAxis _view_axis;
};

#endif  // __WEB_CAMERA_H__
