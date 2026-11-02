macro(set_target_python_module_name target)
  set_target_properties(${target} PROPERTIES PREFIX "")
  if (WIN32)
    set_target_properties(${target} PROPERTIES SUFFIX ".pyd")
  else()
    set_target_properties(${target} PROPERTIES SUFFIX ".so")
  endif()
endmacro()

macro(copy_target x)
  set(src $<TARGET_FILE:${x}>)
  set(dst ${CMAKE_CURRENT_BINARY_DIR})
  add_custom_command(
    TARGET ${x}
    POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${src} ${dst}
    COMMENT "Copying ${src} to ${dst}")
  unset(src)
  unset(dst)
endmacro()

function(copy_target_dependencies x)
  # In native modern system builds, we link dynamically against system Qt, TBB, etc.
endfunction()

function(copy_file x)
  get_filename_component(name ${x} NAME)
  file(RELATIVE_PATH temp ${PROJECT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR})
  if (NOT (temp STREQUAL ""))
    string(REGEX REPLACE "(/|\\\\)" "." temp "${temp}")
    string(CONCAT name "${temp}" "." "${name}")
  endif()
  if (ARGC EQUAL 2)
    set(${ARGV1} ${name} PARENT_SCOPE)
  endif()
  if (NOT IS_ABSOLUTE ${x})
    set(src ${CMAKE_CURRENT_SOURCE_DIR}/${x})
  else()
    set(src ${x})
  endif()
  set(dst ${CMAKE_CURRENT_BINARY_DIR})
  add_custom_target(${name} ALL
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${src} ${dst}
    COMMENT "Copying ${src} to ${dst}")
endfunction()

function(copy_file_with_dependencies x)
  copy_file(${x})
endfunction()
