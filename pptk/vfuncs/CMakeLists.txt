add_library(vfuncs SHARED vfuncs.cpp)
set_target_python_module_name(vfuncs)
target_include_directories(vfuncs PRIVATE
  ../include
  ${PYTHON_INCLUDE_DIR}
  ${Eigen_INCLUDE_DIR}
  ${Numpy_INCLUDE_DIRS})
target_link_libraries(vfuncs ${PYTHON_LIBRARY})
copy_target(vfuncs)
copy_file(__init__.py)
