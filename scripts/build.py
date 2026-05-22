from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

TARGETS = {
    "chromium": "manifest.chromium.json",
    "opera": "manifest.opera.json",
    "firefox": "manifest.firefox.json"
}


def build_target(name, manifest_file):
    target_dir = DIST / name

    print(f"Building {name}...")

    if target_dir.exists():
        shutil.rmtree(target_dir)

    shutil.copytree(SRC, target_dir)

    manifest_src = target_dir / "manifests" / manifest_file
    manifest_dst = target_dir / "manifest.json"

    shutil.copy2(manifest_src, manifest_dst)

    shutil.rmtree(target_dir / "manifests")

    # Clean up non-target background scripts to avoid store linting errors
    background_dir = target_dir / "background"
    if background_dir.exists():
        for script in background_dir.iterdir():
            if script.name != f"{name}.js" and script.is_file():
                script.unlink()

    # Clean up non-target platform folders to avoid store linting errors
    platform_dir = target_dir / "platform"
    if platform_dir.exists():
        for folder in platform_dir.iterdir():
            if folder.name != name and folder.is_dir():
                shutil.rmtree(folder)

    print(f"Built {name}")


def main():
    DIST.mkdir(exist_ok=True)

    for name, manifest in TARGETS.items():
        build_target(name, manifest)

    print("All builds completed.")


if __name__ == "__main__":
    main()
