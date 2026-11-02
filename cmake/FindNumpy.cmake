if(Python3_NumPy_INCLUDE_DIRS)
  set(Numpy_INCLUDE_DIR "${Python3_NumPy_INCLUDE_DIRS}")
else()
  execute_process(
    COMMAND "${Python3_EXECUTABLE}" -c "import numpy; print(numpy.get_include())"
    OUTPUT_VARIABLE _np_dir
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
  )
  set(Numpy_INCLUDE_DIR "${_np_dir}")
endif()

find_path(Numpy_INCLUDE_DIR NAMES numpy/arrayobject.h PATHS ${Numpy_INCLUDE_DIR})
set(Numpy_INCLUDE_DIRS "${Numpy_INCLUDE_DIR}" "${Numpy_INCLUDE_DIR}/numpy")

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(Numpy REQUIRED_VARS Numpy_INCLUDE_DIR)
