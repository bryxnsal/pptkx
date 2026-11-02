cmake_minimum_required(VERSION 3.16)
project(pptk)

set(CMAKE_BUILD_TYPE Release)
set(CMAKE_MODULE_PATH
  "${CMAKE_CURRENT_SOURCE_DIR}/cmake" ${CMAKE_CURRENT_SOURCE_DIR})

find_package(Python3 COMPONENTS Interpreter Development NumPy REQUIRED)
set(PYTHON_INCLUDE_DIR ${Python3_INCLUDE_DIRS})
set(PYTHON_LIBRARY ${Python3_LIBRARIES})

find_package(OpenGL REQUIRED)
find_package(Numpy REQUIRED)
find_package(TBB REQUIRED)
find_package(Eigen REQUIRED)
find_package(Qt5 CONFIG REQUIRED COMPONENTS Widgets Network OpenGL Core)
find_package(OpenMP)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(UsefulMacros)

set(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_SKIP TRUE)
set(CMAKE_INSTALL_OPENMP_LIBRARIES TRUE)
include(InstallRequiredSystemLibraries)

copy_file(setup.py)
copy_file(LICENSE)
add_subdirectory(pptk)
add_subdirectory(licenses)
