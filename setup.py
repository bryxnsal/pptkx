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
        if system_type == 'Windows':
            base_dir = getattr(sys, 'base_prefix', sys.prefix)
            libs_dir = os.path.join(base_dir, 'libs')
            lib_file = os.path.join(libs_dir, f'python{sys.version_info.major}{sys.version_info.minor}.lib')
            if os.path.exists(libs_dir):
                cmake_args.append(f'-DPython3_LIBRARY_DIRS={libs_dir.replace(os.sep, "/")}')
                cmake_args.append(f'-DCMAKE_LIBRARY_PATH={libs_dir.replace(os.sep, "/")}')
            if os.path.exists(lib_file):
                cmake_args.append(f'-DPython3_LIBRARY={lib_file.replace(os.sep, "/")}')
                cmake_args.append(f'-DPython3_LIBRARIES={lib_file.replace(os.sep, "/")}')
        if 'CMAKE_TOOLCHAIN_FILE' in os.environ:
            cmake_args.append(f"-DCMAKE_TOOLCHAIN_FILE={os.environ['CMAKE_TOOLCHAIN_FILE']}")
        if 'Qt5_DIR' in os.environ:
            cmake_args.append(f"-DQt5_DIR={os.environ['Qt5_DIR']}")

        subprocess.check_call([cmake_bin, ext.sourcedir] + cmake_args, cwd=build_temp)
        subprocess.check_call([cmake_bin, '--build', '.', '--config', 'Release'], cwd=build_temp)

        # In setuptools, self.build_lib points to the directory holding the packages (e.g. build/lib...)
        target_pptk = os.path.join(os.path.abspath(self.build_lib), 'pptk')
        built_pptk = os.path.join(build_temp, 'pptk')

        # Helper to find built files (handling both Ninja/Make in built_pptk/... and MSVC in built_pptk/.../Release)
        def find_file(subpath, filename):
            p1 = os.path.join(built_pptk, subpath, filename)
            if os.path.exists(p1):
                return p1
            p2 = os.path.join(built_pptk, subpath, 'Release', filename)
            if os.path.exists(p2):
                return p2
            return None

        # 1. kdtree
        kdtree_so = find_file('kdtree', make_mod('kdtree'))
        if kdtree_so:
            dest = os.path.join(target_pptk, 'kdtree')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(kdtree_so, dest)

        # 2. vfuncs
        vfuncs_so = find_file('vfuncs', make_mod('vfuncs'))
        if vfuncs_so:
            dest = os.path.join(target_pptk, 'vfuncs')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(vfuncs_so, dest)

        # 3. estimate_normals
        en_so = find_file(os.path.join('processing', 'estimate_normals'), make_mod('estimate_normals'))
        if en_so:
            dest = os.path.join(target_pptk, 'processing', 'estimate_normals')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(en_so, dest)

        # 4. viewer
        viewer_bin = find_file('viewer', make_exe('viewer'))
        if viewer_bin:
            dest = os.path.join(target_pptk, 'viewer')
            os.makedirs(dest, exist_ok=True)
            shutil.copy2(viewer_bin, dest)

        # 5. On Windows, bundle TBB DLLs and run windeployqt on viewer.exe if available
        if system_type == 'Windows':
            tbb_bin_dir = 'C:/vcpkg/installed/x64-windows/bin'
            if os.path.isdir(tbb_bin_dir):
                libs_target = os.path.join(target_pptk, 'libs')
                os.makedirs(libs_target, exist_ok=True)
                for dll in os.listdir(tbb_bin_dir):
                    if dll.lower().endswith('.dll'):
                        shutil.copy2(os.path.join(tbb_bin_dir, dll), libs_target)
                        # Also place in viewer dir
                        shutil.copy2(os.path.join(tbb_bin_dir, dll), os.path.join(target_pptk, 'viewer'))

            # Run windeployqt on viewer.exe
            installed_viewer_exe = os.path.join(target_pptk, 'viewer', 'viewer.exe')
            windeployqt_bin = shutil.which('windeployqt')
            if os.path.exists(installed_viewer_exe) and windeployqt_bin:
                try:
                    subprocess.check_call([
                        windeployqt_bin,
                        '--release',
                        '--no-compiler-runtime',
                        '--no-translations',
                        installed_viewer_exe
                    ])
                except Exception as e:
                    print(f"Warning: windeployqt failed: {e}")

setup(
    name='pptkx',
    version='0.1.2',
    description='A Python package for 3D point cloud visualization and processing with native Wayland support.',
    author='HERE Europe B.V., modern Wayland fork maintained by Bryan Salazar',
    license='MIT',
    packages=find_packages(),
    ext_modules=[CMakeExtension('pptk._cmake_build')],
    cmdclass={'build_ext': CMakeBuild},
    package_data={
        'pptk': ['LICENSE', 'libs/*.dll'],
        'pptk.kdtree': [make_mod('kdtree')],
        'pptk.processing.estimate_normals': [make_mod('estimate_normals')],
        'pptk.vfuncs': [make_mod('vfuncs')],
        'pptk.viewer': [make_exe('viewer'), '*.dll', 'platforms/*.dll', 'styles/*.dll'],
    },
    include_package_data=True,
    zip_safe=False,
)
