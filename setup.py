import sys
import os
import platform
import subprocess
import shutil
from setuptools import setup, find_packages, Extension
from setuptools.command.build_ext import build_ext

system_type = platform.system()

def get_cmake_bin():
    # Try system PATH
    c = shutil.which("cmake")
    if c:
        return c
    # Try virtualenv or python site-packages cmake
    venv_bin = os.path.join(sys.prefix, "bin", "cmake")
    if os.path.isfile(venv_bin) and os.access(venv_bin, os.X_OK):
        return venv_bin
    try:
        import cmake
        c = os.path.join(cmake.CMAKE_BIN_DIR, "cmake")
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    except ImportError:
        pass
    return "cmake"

def make_mod(x):
    if system_type == 'Windows':
        return x + '.pyd'
    else:
        return x + '.so'

def make_exe(x):
    if system_type == 'Windows':
        return x + '.exe'
    else:
        return x

class CMakeExtension(Extension):
    def __init__(self, name, sourcedir=''):
        super().__init__(name, sources=[])
        self.sourcedir = os.path.abspath(sourcedir)

class CMakeBuild(build_ext):
    def run(self):
        cmake_bin = get_cmake_bin()
        try:
            subprocess.check_call([cmake_bin, '--version'])
        except OSError:
            raise RuntimeError(f"CMake not found at '{cmake_bin}'. Please install cmake.")

        for ext in self.extensions:
            self.build_extension(ext, cmake_bin)

    def build_extension(self, ext, cmake_bin):
        build_temp = os.path.join(self.build_temp, 'cmake_build')
        os.makedirs(build_temp, exist_ok=True)

        cmake_args = [
            f'-DCMAKE_BUILD_TYPE=Release',
            f'-DPython3_EXECUTABLE={sys.executable}',
        ]

        subprocess.check_call([cmake_bin, ext.sourcedir] + cmake_args, cwd=build_temp)
        subprocess.check_call([cmake_bin, '--build', '.', '--config', 'Release'], cwd=build_temp)

        # In setuptools, self.build_lib points to the directory holding the packages (e.g. build/lib...)
        target_pptk = os.path.join(os.path.abspath(self.build_lib), 'pptk')
        built_pptk = os.path.join(build_temp, 'pptk')

        # 1. kdtree
        kdtree_so = os.path.join(built_pptk, 'kdtree', make_mod('kdtree'))
        if os.path.exists(kdtree_so):
            dest = os.path.join(target_pptk, 'kdtree')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(kdtree_so, dest)

        # 2. vfuncs
        vfuncs_so = os.path.join(built_pptk, 'vfuncs', make_mod('vfuncs'))
        if os.path.exists(vfuncs_so):
            dest = os.path.join(target_pptk, 'vfuncs')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(vfuncs_so, dest)

        # 3. estimate_normals
        en_so = os.path.join(built_pptk, 'processing', 'estimate_normals', make_mod('estimate_normals'))
        if os.path.exists(en_so):
            dest = os.path.join(target_pptk, 'processing', 'estimate_normals')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(en_so, dest)

        # 4. viewer
        viewer_bin = os.path.join(built_pptk, 'viewer', make_exe('viewer'))
        if os.path.exists(viewer_bin):
            dest = os.path.join(target_pptk, 'viewer')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(viewer_bin, dest)

setup(
    name='pptk',
    version='0.1.2',
    description='A Python package for 3D point cloud visualization and processing with native Wayland support.',
    author='HERE Europe B.V., modern Wayland fork maintained by Bryan Salazar',
    license='MIT',
    packages=find_packages(),
    ext_modules=[CMakeExtension('pptk._cmake_build')],
    cmdclass={'build_ext': CMakeBuild},
    package_data={
        'pptk': ['LICENSE'],
        'pptk.kdtree': [make_mod('kdtree')],
        'pptk.processing.estimate_normals': [make_mod('estimate_normals')],
        'pptk.vfuncs': [make_mod('vfuncs')],
        'pptk.viewer': [make_exe('viewer')],
    },
    include_package_data=True,
    zip_safe=False,
)
