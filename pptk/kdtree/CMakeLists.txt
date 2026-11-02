add_library(kdtree SHARED kdtree_wrapper.cpp)
set_target_python_module_name(kdtree)
target_compile_definitions(kdtree PRIVATE -DUSE_TBB)
target_include_directories(kdtree PRIVATE
  ../include
  src
  ${TBB_INCLUDE_DIR}
  ${PYTHON_INCLUDE_DIR}
  ${Numpy_INCLUDE_DIRS})
target_link_libraries(kdtree
  ${TBB_tbb_LIBRARY}
  ${TBB_tbbmalloc_LIBRARY})
copy_target(kdtree)
copy_file(__init__.py)
