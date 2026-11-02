add_executable(viewer
  main.cpp
  octree.h
  box3.h
  floor_grid.h
  selection_box.h
  background.h
  look_at.h
  point_cloud.h
  viewer.h
  qt_camera.h
  camera.h
  comm_funcs.h
  opengl_funcs.h
  text.h
  camera_dolly.h
  splines.h
  point_attributes.h)

set_target_properties(viewer PROPERTIES AUTOMOC TRUE)
target_link_libraries(viewer Qt5::Widgets Qt5::Network Qt5::OpenGL OpenGL::GL)
target_include_directories(viewer PRIVATE ${Eigen_INCLUDE_DIR})
copy_target(viewer)
copy_file(viewer.py)
copy_file(__init__.py)
