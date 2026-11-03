cmake_minimum_required(VERSION 3.10)
project(pptk_web)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/src/core
)

set(SOURCES
    src/core/pptk_web_bindings.cpp
)

add_executable(pptk_web ${SOURCES})

# Emscripten flags for High Performance WebAssembly
set_target_properties(pptk_web PROPERTIES
    LINK_FLAGS "-O3 -flto --bind -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s NO_EXIT_RUNTIME=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -msimd128"
)

set_target_properties(pptk_web PROPERTIES
    SUFFIX ".js"
)
