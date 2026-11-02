find_path(TBB_INCLUDE_DIR NAMES tbb/tbb.h PATHS /usr/include /usr/local/include)
find_library(TBB_tbb_LIBRARY NAMES tbb PATHS /usr/lib /usr/local/lib)
find_library(TBB_tbbmalloc_LIBRARY NAMES tbbmalloc PATHS /usr/lib /usr/local/lib)

set(TBB_tbb_RUNTIME "${TBB_tbb_LIBRARY}" CACHE FILEPATH "Path to tbb runtime")
set(TBB_tbbmalloc_RUNTIME "${TBB_tbbmalloc_LIBRARY}" CACHE FILEPATH "Path to tbbmalloc runtime")

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(TBB
  REQUIRED_VARS
    TBB_INCLUDE_DIR
    TBB_tbb_LIBRARY
    TBB_tbbmalloc_LIBRARY
)
