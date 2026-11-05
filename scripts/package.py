import os
import shutil
import zipfile
import subprocess
import sys

PLUGIN_DIR_NAME = "decky-trailers"
OUTPUT_ZIP = "decky-trailers.zip"

FILES_TO_INCLUDE = [
    "plugin.json",
    "package.json",
    "main.py",
    "README.md",
    "LICENSE",
]

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    print("Building frontend (npm run build)...")
    subprocess.check_call("npm run build", shell=True)

    dist_dir = os.path.join(root, "dist")
    if not os.path.exists(dist_dir) or not os.listdir(dist_dir):
        print("Error: dist directory is missing or empty!")
        sys.exit(1)

    temp_bundle = os.path.join(root, "bundle")
    if os.path.exists(temp_bundle):
        shutil.rmtree(temp_bundle)

    plugin_bundle = os.path.join(temp_bundle, PLUGIN_DIR_NAME)
    os.makedirs(plugin_bundle, exist_ok=True)

    # Copy root files
    for fname in FILES_TO_INCLUDE:
        src = os.path.join(root, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(plugin_bundle, fname))
        else:
            print(f"Warning: {fname} not found in root")

    # Copy dist folder
    shutil.copytree(dist_dir, os.path.join(plugin_bundle, "dist"))

    # Create zip archive
    out_zip_path = os.path.join(root, OUTPUT_ZIP)
    if os.path.exists(out_zip_path):
        os.remove(out_zip_path)

    print(f"Creating release archive: {OUTPUT_ZIP}...")
    with zipfile.ZipFile(out_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for foldername, subfolders, filenames in os.walk(temp_bundle):
            for filename in filenames:
                filepath = os.path.join(foldername, filename)
                arcname = os.path.relpath(filepath, temp_bundle)
                zf.write(filepath, arcname)

    shutil.rmtree(temp_bundle)
    print(f"Successfully packaged {OUTPUT_ZIP} ({os.path.getsize(out_zip_path):,} bytes)")

if __name__ == "__main__":
    main()
