#!/usr/bin/env python3
"""Install generated painted art into Beneath the Throne asset paths."""

from __future__ import annotations

import shutil  # noqa: F401 — kept for manual repair workflows
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/opt/cursor/artifacts/assets")
ACTOR_V56 = ROOT / "assets/actors/generated/v56"
ACTOR_V80 = ROOT / "assets/actors/generated/v80"
NPC_DIR = ROOT / "assets/npcs/generated/v1"
ENEMY_DIR = ROOT / "assets/portraits/enemies"

TARGET_SIZE = (512, 768)


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_character(img: Image.Image, size: tuple[int, int] = TARGET_SIZE) -> Image.Image:
    """Letterbox painted art onto combat canvas, preserving aspect ratio."""
    tw, th = size
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    iw, ih = img.size
    scale = min(tw / iw, th / ih) * 0.92
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    ox, oy = (tw - nw) // 2, th - nh - 24
    canvas.paste(resized, (ox, max(oy, 0)), resized)
    return canvas


def save(img: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG", optimize=True)
    print(f"  {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024}KB)")


def install_actor(name: str, artifact_name: str | None = None, *, v80_name: str | None = None) -> None:
    src = ARTIFACTS / (artifact_name or name)
    if not src.exists():
        print(f"  SKIP missing artifact {src.name}")
        return
    img = fit_character(load_rgba(src))
    save(img, ACTOR_V56 / name)
    if v80_name:
        save(img, ACTOR_V80 / v80_name)


def install_npc(name: str) -> None:
    src = ARTIFACTS / name
    if not src.exists():
        print(f"  SKIP missing artifact {name}")
        return
    save(fit_character(load_rgba(src)), NPC_DIR / name)


def make_defeated(idle_path: Path, dest: Path, darken: float = 0.55) -> None:
    if not idle_path.exists():
        return
    img = load_rgba(idle_path)
    w, h = img.size
    fallen = img.rotate(88, resample=Image.Resampling.BICUBIC, expand=True)
    fw, fh = fallen.size
    crop = fallen.crop(((fw - w) // 2, (fh - int(h * 0.45)) // 2, (fw + w) // 2, (fh + int(h * 0.45)) // 2 + int(h * 0.45)))
    out = crop.resize((w, h), Image.Resampling.LANCZOS)
    out = ImageEnhance.Brightness(out).enhance(darken)
    save(out, dest)


def install_defeated(kind: str, hurt_v80: str) -> None:
    hurt = ACTOR_V80 / hurt_v80
    make_defeated(hurt, ENEMY_DIR / kind / "defeated-v1.png")
    make_defeated(hurt, ENEMY_DIR / kind / "defeated-v80.png")


def main() -> None:
    print("Installing enemy combat sprites...")
    enemies = [
        ("skeleton-warrior-idle-v56.png", None, "skeleton-warrior-idle-v80.png"),
        ("skeleton-warrior-attack-v56.png", None, "skeleton-warrior-attack-v80.png"),
        ("skeleton-warrior-hurt-v56.png", None, "skeleton-warrior-hurt-v80.png"),
        ("wolf-stalker-idle-v56.png", None, "wolf-stalker-idle-v80.png"),
        ("wolf-stalker-attack-v56.png", None, "wolf-stalker-attack-v80.png"),
        ("wolf-stalker-hurt-v56.png", None, "wolf-stalker-hurt-v80.png"),
        ("cultist-bandit-idle-crop-v76.png", "cultist-bandit-idle-v76.png", "cultist-bandit-idle-v80.png"),
        ("cultist-bandit-attack-v76.png", None, "cultist-bandit-attack-v80.png"),
        ("cultist-bandit-hurt-v76.png", None, "cultist-bandit-hurt-v80.png"),
        ("elite-corrupted-knight-idle-v56.png", None, "elite-corrupted-knight-idle-v80.png"),
        ("elite-corrupted-knight-attack-v56.png", None, "elite-corrupted-knight-attack-v80.png"),
        ("elite-corrupted-knight-hurt-v56.png", None, "elite-corrupted-knight-hurt-v80.png"),
    ]
    for dest_name, artifact, v80_name in enemies:
        install_actor(dest_name, artifact, v80_name=v80_name)

    print("Generating defeated poses from hurt sprites...")
    defeated_map = {
        "skeleton": "skeleton-warrior-hurt-v80.png",
        "wolf": "wolf-stalker-hurt-v80.png",
        "bandit": "cultist-bandit-hurt-v80.png",
        "cultist": "cultist-bandit-hurt-v80.png",
        "corrupted_knight": "elite-corrupted-knight-hurt-v80.png",
    }
    for kind, src_name in defeated_map.items():
        install_defeated(kind, src_name)

    print("Installing NPC portraits...")
    for name in [
        "blacksmith-v1.png", "market_merchant-v1.png", "innkeeper-v1.png",
        "tavern_keeper-v1.png", "town_clerk-v1.png", "slum_beggar-v1.png",
        "gang_lookout-v1.png", "healer_herbalist-v1.png", "caravan_trader-v1.png",
        "castle_guard-v1.png", "companion_scout-v1.png", "companion_mage-v1.png",
    ]:
        install_npc(name)

    print("Refreshing companion combat actor sprites...")
    for npc, v56, v80 in [
        ("companion_scout-v1.png", "companion-scout-idle-v56.png", "companion-scout-idle-v80.png"),
        ("companion_mage-v1.png", "companion-armored-idle-v56.png", "companion-armored-idle-v80.png"),
    ]:
        src = NPC_DIR / npc
        if src.exists():
            img = fit_character(load_rgba(src))
            save(img, ACTOR_V56 / v56)
            save(img, ACTOR_V80 / v80)

    print("Done.")


if __name__ == "__main__":
    main()
