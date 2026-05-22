from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Build first
subprocess.run(
    [sys.executable, "scripts/build.py"],
    check=True
)

TARGETS = [
    "chromium",
    "opera",
    "firefox"
]

for target in TARGETS:
    print(f"Zipping {target}...")

    shutil.make_archive(
        str(DIST / target),
        'zip',
        DIST / target
    )

print("Release completed.")
