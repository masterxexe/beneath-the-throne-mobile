#!/usr/bin/env python3
"""Install AI-generated combat art from artifacts into game assets."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/opt/cursor/artifacts/assets")
ACTOR_DIR = ROOT / "assets/actors/generated/v80"
POSE_DIR = ROOT / "assets/portraits/player/poses/base"
ENEMY_DIR = ROOT / "assets/portraits/enemies"
COMPOSITE_DIR = ROOT / "assets/portraits/player/composites"

ENEMY_MAP = {
    "skeleton-warrior-idle-v80.png": "skeleton-warrior-idle-v80.png",
    "skeleton-warrior-attack-v80.png": "skeleton-warrior-attack-v80.png",
    "skeleton-warrior-hurt-v80.png": "skeleton-warrior-hurt-v80.png",
    "wolf-stalker-idle-v80.png": "wolf-stalker-idle-v80.png",
    "wolf-stalker-attack-v80.png": "wolf-stalker-attack-v80.png",
    "wolf-stalker-hurt-v80.png": "wolf-stalker-hurt-v80.png",
    "cultist-bandit-idle-v80.png": "cultist-bandit-idle-v80.png",
    "cultist-bandit-attack-v80.png": "cultist-bandit-attack-v80.png",
    "cultist-bandit-hurt-v80.png": "cultist-bandit-hurt-v80.png",
    "elite-corrupted-knight-idle-v80.png": "elite-corrupted-knight-idle-v80.png",
    "elite-corrupted-knight-attack-v80.png": "elite-corrupted-knight-attack-v80.png",
    "elite-corrupted-knight-hurt-v80.png": "elite-corrupted-knight-hurt-v80.png",
    "companion-scout-idle-v80.png": "companion-scout-idle-v80.png",
    "companion-armored-idle-v80.png": "companion-armored-idle-v80.png",
}

PLAYER_MAP = {
    "player-combat-idle-v80.png": "player-combat-idle-v80.png",
    "player-melee-slash-v80.png": "player-melee-slash-v80.png",
    "player-thrust-attack-v80.png": "player-thrust-attack-v80.png",
    "player-ranged-attack-v80.png": "player-ranged-attack-v80.png",
    "player-cast-attack-v80.png": "player-cast-attack-v80.png",
    "player-block-v80.png": "player-block-v80.png",
    "player-hurt-v80.png": "player-hurt-v80.png",
    "player-defeated-v80.png": "player-defeated-v80.png",
}

DEFEATED_SOURCES = {
    "skeleton": "skeleton-warrior-hurt-v80.png",
    "wolf": "wolf-stalker-hurt-v80.png",
    "bandit": "cultist-bandit-hurt-v80.png",
    "cultist": "cultist-bandit-hurt-v80.png",
    "corrupted_knight": "elite-corrupted-knight-hurt-v80.png",
}


def normalize_sprite(src: Path, dst: Path, size: tuple[int, int] = (512, 768)) -> None:
  img = Image.open(src).convert("RGBA")
  img = img.resize(size, Image.Resampling.LANCZOS)
  dst.parent.mkdir(parents=True, exist_ok=True)
  img.save(dst, "PNG", optimize=True)
  print(f"  {dst.relative_to(ROOT)} ({dst.stat().st_size // 1024}KB)")


def make_defeated(src: Path, dst: Path) -> None:
  img = Image.open(src).convert("RGBA")
  w, h = img.size
  fallen = img.rotate(78, resample=Image.Resampling.BICUBIC, expand=True)
  fw, fh = fallen.size
  crop = fallen.crop(((fw - w) // 2, fh - int(h * 0.55), (fw + w) // 2, fh))
  out = crop.resize((512, 400), Image.Resampling.LANCZOS)
  overlay = Image.new("RGBA", out.size, (0, 0, 0, 80))
  out = Image.blend(out, overlay, 0.35)
  dst.parent.mkdir(parents=True, exist_ok=True)
  out.save(dst, "PNG", optimize=True)
  print(f"  {dst.relative_to(ROOT)} (defeated, {dst.stat().st_size // 1024}KB)")


def install_enemies() -> None:
  print("Installing enemy sprites...")
  for src_name, dst_name in ENEMY_MAP.items():
    src = ARTIFACTS / src_name
    if not src.exists():
      print(f"  SKIP missing {src_name}")
      continue
    normalize_sprite(src, ACTOR_DIR / dst_name)

  print("Generating defeated enemy poses...")
  for kind, src_name in DEFEATED_SOURCES.items():
    src = ARTIFACTS / src_name
    if src.exists():
      make_defeated(src, ENEMY_DIR / kind / "defeated-v80.png")


def install_player_poses() -> None:
  print("Installing player combat poses...")
  for src_name, dst_name in PLAYER_MAP.items():
    src = ARTIFACTS / src_name
    if not src.exists():
      print(f"  SKIP missing {src_name}")
      continue
    normalize_sprite(src, POSE_DIR / dst_name, size=(598, 900))

  # Unarmed uses melee slash variant
  slash = POSE_DIR / "player-melee-slash-v80.png"
  unarmed = POSE_DIR / "player-unarmed-attack-v80.png"
  if slash.exists() and not unarmed.exists():
    shutil.copy2(slash, unarmed)
    print(f"  {unarmed.relative_to(ROOT)} (from melee slash)")


def refresh_composites() -> None:
  print("Refreshing composite frames from v80 poses...")
  mapping = {
    "ash_axe/combat-idle-v80.png": "player-combat-idle-v80.png",
    "ash_axe/melee-slash-v80.png": "player-melee-slash-v80.png",
    "leather_armor/combat-idle-v80.png": "player-combat-idle-v80.png",
    "leather_armor/melee-slash-v80.png": "player-melee-slash-v80.png",
    "leather_armor_scout_hood/combat-idle-v80.png": "player-combat-idle-v80.png",
    "leather_armor_scout_hood/melee-slash-v80.png": "player-melee-slash-v80.png",
    "scout_hood/combat-idle-v80.png": "player-combat-idle-v80.png",
    "scout_hood/melee-slash-v80.png": "player-melee-slash-v80.png",
    "chainmail_sword/combat-idle-v80.png": "player-combat-idle-v80.png",
    "chainmail_sword/melee-slash-v80.png": "player-melee-slash-v80.png",
    "chainmail_sword/hurt-v80.png": "player-hurt-v80.png",
    "chainmail_sword/block-v80.png": "player-block-v80.png",
    "hunter_ranger/combat-idle-v80.png": "player-combat-idle-v80.png",
    "hunter_ranger/ranged-attack-v80.png": "player-ranged-attack-v80.png",
    "hunter_ranger/hurt-v80.png": "player-hurt-v80.png",
    "hunter_ranger/block-v80.png": "player-block-v80.png",
    "hunter_ranger/defeated-v80.png": "player-defeated-v80.png",
    "mage_robe_staff/combat-idle-v80.png": "player-combat-idle-v80.png",
    "mage_robe_staff/cast-attack-v80.png": "player-cast-attack-v80.png",
    "mage_robe_staff/hurt-v80.png": "player-hurt-v80.png",
    "mage_robe_staff/block-v80.png": "player-block-v80.png",
    "mage_robe_staff/defeated-v80.png": "player-defeated-v80.png",
    "starter_leather_hood_axe/combat-idle-v80.png": "player-combat-idle-v80.png",
    "starter_leather_hood_axe/melee-slash-v80.png": "player-melee-slash-v80.png",
    "starter_leather_hood_axe/hurt-v80.png": "player-hurt-v80.png",
    "starter_leather_hood_axe/block-v80.png": "player-block-v80.png",
    "starter_leather_hood_axe/defeated-v80.png": "player-defeated-v80.png",
  }
  for rel, pose_name in mapping.items():
    src = POSE_DIR / pose_name
    dst = COMPOSITE_DIR / rel
    if src.exists():
      normalize_sprite(src, dst, size=(598, 900))


def main() -> None:
  if not ARTIFACTS.exists():
    print(f"Artifacts dir not found: {ARTIFACTS}")
    return
  install_enemies()
  install_player_poses()
  refresh_composites()
  print("Done.")


if __name__ == "__main__":
  main()
