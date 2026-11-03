# First check standard header paths directly
find_path(Eigen_INCLUDE_DIR NAMES Eigen/Core PATHS
  /usr/include/eigen3
  /usr/local/include/eigen3
  /usr/include
)

if (NOT Eigen_INCLUDE_DIR)
  find_package(Eigen3 CONFIG QUIET)
  if (Eigen3_FOUND)
    if (TARGET Eigen3::Eigen)
      get_target_property(_target_inc Eigen3::Eigen INTERFACE_INCLUDE_DIRECTORIES)
      if (_target_inc)
        set(Eigen_INCLUDE_DIR "${_target_inc}")
      else()
        set(Eigen_INCLUDE_DIR "${EIGEN3_INCLUDE_DIRS}")
      endif()
    else()
      set(Eigen_INCLUDE_DIR "${EIGEN3_INCLUDE_DIRS}")
    endif()
  endif()
endif()

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(Eigen REQUIRED_VARS Eigen_INCLUDE_DIR)

