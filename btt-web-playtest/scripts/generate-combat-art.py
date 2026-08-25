#!/usr/bin/env python3
"""Legacy procedural combat art generator — DEPRECATED.

Production art is now AI-generated and installed via install-combat-art.py.
This script remains as a fallback for environments without generated artifacts.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTALL = ROOT / "scripts" / "install-combat-art.py"
ARTIFACTS = Path("/opt/cursor/artifacts/assets")


def main() -> None:
    if ARTIFACTS.exists() and any(ARTIFACTS.glob("*-v80.png")):
        print("Found v80 artifacts — running install-combat-art.py instead.")
        subprocess.run([sys.executable, str(INSTALL)], check=True)
        return
    print("No v80 artifacts found. Run install-combat-art.py after generating art.")
    print("See README.md § Art assets for the full workflow.")
    sys.exit(1)


if __name__ == "__main__":
    main()
