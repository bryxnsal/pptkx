import os
import os.path
import sys
import platform


def _add_path():
    _root_dir = os.path.dirname(os.path.realpath(__file__))

    # manual specify list of dll directories, with paths relative to _root_dir
    _dll_dirs = ['libs', 'viewer', 'kdtree', 'vfuncs', 'processing/estimate_normals']

    if platform.system() == 'Windows':
        os.environ.setdefault('PATH', '')
        paths = os.environ['PATH'].split(';')
        for x in _dll_dirs:
            full_path = os.path.normpath(os.path.join(_root_dir, x))
            if os.path.isdir(full_path):
                if full_path not in paths:
                    paths = [full_path] + paths
                if hasattr(os, 'add_dll_directory'):
                    try:
                        os.add_dll_directory(full_path)
                    except OSError:
                        pass
        os.environ['PATH'] = ';'.join(paths)


_add_path()
