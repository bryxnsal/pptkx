find_path(Eigen_INCLUDE_DIR NAMES Eigen/Core PATHS /usr/include/eigen3 /usr/local/include/eigen3 /usr/include)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(Eigen REQUIRED_VARS Eigen_INCLUDE_DIR)
