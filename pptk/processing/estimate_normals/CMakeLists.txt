add_library(estimate_normals SHARED estimate_normals.cpp)
set(_link_flags ${OpenMP_CXX_FLAGS})
set_target_properties(estimate_normals PROPERTIES
  COMPILE_FLAGS "${OpenMP_CXX_FLAGS}"
  LINK_FLAGS "${_link_flags}")
set_target_python_module_name(estimate_normals)
target_compile_definitions(estimate_normals PRIVATE -DUSE_TBB)
target_link_libraries(estimate_normals
  ${TBB_tbb_LIBRARY}
  ${TBB_tbbmalloc_LIBRARY}
  OpenMP::OpenMP_CXX)
target_include_directories(estimate_normals PRIVATE
  ../../include
  ../../kdtree/src
  ${Eigen_INCLUDE_DIR}
  ${PYTHON_INCLUDE_DIR}
  ${TBB_INCLUDE_DIR}
  ${Numpy_INCLUDE_DIRS})
copy_target(estimate_normals)
copy_file(__init__.py)
