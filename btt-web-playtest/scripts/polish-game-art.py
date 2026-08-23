#!/usr/bin/env python3
"""Polish pass: cultist sprites, v80 gear composites, walk cycles."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/opt/cursor/artifacts/assets")
ACTOR_V80 = ROOT / "assets/actors/generated/v80"
POSE_DIR = ROOT / "assets/portraits/player/poses/base"
COMPOSITE_DIR = ROOT / "assets/portraits/player/composites"
GENERATED = ROOT / "assets/portraits/player/generated"
ENEMY_DIR = ROOT / "assets/portraits/enemies"

PLAYER_SIZE = (598, 900)
ENEMY_SIZE = (512, 768)

# Ash Court palette
VIOLET = (120, 72, 160)
GOLD = (212, 168, 75)
EMBER = (196, 92, 58)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)} ({path.stat().st_size // 1024}KB)")


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_player(img: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", PLAYER_SIZE, (0, 0, 0, 0))
    iw, ih = img.size
    scale = min(PLAYER_SIZE[0] / iw, PLAYER_SIZE[1] / ih) * 0.96
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((PLAYER_SIZE[0] - nw) // 2, PLAYER_SIZE[1] - nh - 8), resized)
    return canvas


def tint(img: Image.Image, color: tuple[int, int, int], amount: float = 0.25) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (*color, int(255 * amount)))
    return Image.alpha_composite(img, overlay)


def color_grade(img: Image.Image, r: float, g: float, b: float) -> Image.Image:
    r_ch, g_ch, b_ch, a = img.split()
    r_ch = r_ch.point(lambda x: min(255, int(x * r)))
    g_ch = g_ch.point(lambda x: min(255, int(x * g)))
    b_ch = b_ch.point(lambda x: min(255, int(x * b)))
    return Image.merge("RGBA", (r_ch, g_ch, b_ch, a))


def make_cultist_from_bandit(src: Image.Image) -> Image.Image:
    """Distinct cultist: violet robes, masked face, ritual dagger glow."""
    out = color_grade(src, 0.82, 0.72, 1.18)
    out = tint(out, VIOLET, 0.22)
    w, h = out.size
    draw = ImageDraw.Draw(out)
    # Hood / mask
    draw.polygon(
        [(w * 0.28, h * 0.08), (w * 0.72, h * 0.08), (w * 0.68, h * 0.28), (w * 0.32, h * 0.28)],
        fill=(*VIOLET[:3], 140),
    )
    draw.ellipse((w * 0.38, h * 0.16, w * 0.62, h * 0.24), fill=(20, 12, 28, 220))
    draw.ellipse((w * 0.42, h * 0.175, w * 0.48, h * 0.215), fill=(*EMBER[:3], 240))
    draw.ellipse((w * 0.52, h * 0.175, w * 0.58, h * 0.215), fill=(*EMBER[:3], 240))
    # Ritual robe drape
    draw.polygon(
        [(w * 0.18, h * 0.35), (w * 0.82, h * 0.35), (w * 0.9, h * 0.88), (w * 0.1, h * 0.88)],
        fill=(*VIOLET[:3], 60),
    )
    # Arcane glow on hands
    draw.ellipse((w * 0.55, h * 0.42, w * 0.72, h * 0.58), fill=(*VIOLET[:3], 50))
    return out.filter(ImageFilter.GaussianBlur(radius=0.3))


def make_cultist_attack(src: Image.Image) -> Image.Image:
    out = make_cultist_from_bandit(src)
    w, h = out.size
    rotated = out.rotate(-8, resample=Image.Resampling.BICUBIC, expand=True)
    fw, fh = rotated.size
    return rotated.crop(((fw - w) // 2, 0, (fw + w) // 2, h))


def make_cultist_hurt(src: Image.Image) -> Image.Image:
    out = make_cultist_from_bandit(src)
    out = ImageEnhance.Brightness(out).enhance(0.75)
    out = tint(out, (180, 40, 40), 0.15)
    w, h = out.size
    rotated = out.rotate(6, resample=Image.Resampling.BICUBIC, expand=True)
    fw, fh = rotated.size
    return rotated.crop(((fw - w) // 2, int(h * 0.04), (fw + w) // 2, h + int(h * 0.04)))


def install_cultist_sprites() -> None:
    print("Creating distinct cultist enemy sprites...")
    mapping = {
        "cultist-acolyte-idle-v80.png": ("cultist-bandit-idle-v80.png", "idle"),
        "cultist-acolyte-attack-v80.png": ("cultist-bandit-attack-v80.png", "attack"),
        "cultist-acolyte-hurt-v80.png": ("cultist-bandit-hurt-v80.png", "hurt"),
    }
    for dest, (src_name, kind) in mapping.items():
        src_path = ACTOR_V80 / src_name
        if not src_path.exists():
            src_path = ARTIFACTS / src_name
        if not src_path.exists():
            print(f"  SKIP missing {src_name}")
            continue
        src = load(src_path).resize(ENEMY_SIZE, Image.Resampling.LANCZOS)
        if kind == "idle":
            art = make_cultist_from_bandit(src)
        elif kind == "attack":
            art = make_cultist_attack(src)
        else:
            art = make_cultist_hurt(src)
        save(art, ACTOR_V80 / dest)

    hurt = ACTOR_V80 / "cultist-acolyte-hurt-v80.png"
    if hurt.exists():
        make_defeated_simple(hurt, ENEMY_DIR / "cultist" / "defeated-v80.png")


def make_defeated_simple(src: Path, dest: Path) -> None:
    if not src.exists():
        return
    img = load(src)
    w, h = img.size
    fallen = img.rotate(78, resample=Image.Resampling.BICUBIC, expand=True)
    fw, fh = fallen.size
    crop = fallen.crop(((fw - w) // 2, fh - int(h * 0.55), (fw + w) // 2, fh))
    out = crop.resize((512, 400), Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", out.size, (0, 0, 0, 80))
    out = Image.blend(out, overlay, 0.35)
    save(out, dest)


def walk_frame(base: Image.Image, direction: str, phase: int) -> Image.Image:
    """Generate walk frame from idle base with body bob and leg shift."""
    w, h = base.size
    t = phase / 4.0
    bob = int(6 * math.sin(t * math.pi * 2))
    sway = int(4 * math.sin(t * math.pi * 2 + math.pi / 2))

    if direction in ("left", "right"):
        mirror = direction == "left"
        body = base.transpose(Image.FLIP_LEFT_RIGHT) if mirror else base.copy()
        # Crop lower body and shift for stride
        upper = body.crop((0, 0, w, int(h * 0.55)))
        lower = body.crop((0, int(h * 0.45), w, h))
        stride = int(14 * math.sin(t * math.pi * 2))
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(upper, (sway, bob), upper)
        lower_shifted = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        lower_shifted.paste(lower, (stride, int(h * 0.45) + bob), lower)
        canvas = Image.alpha_composite(canvas, lower_shifted)
        return canvas

    if direction in ("forward", "down"):
        scaled = base.resize((int(w * 0.98), int(h * 0.96)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        y = int(h * 0.02) + bob
        canvas.paste(scaled, ((w - scaled.width) // 2, y), scaled)
        return canvas

    # away / up
    scaled = base.resize((int(w * 0.92), int(h * 0.9)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(scaled, ((w - scaled.width) // 2, int(h * 0.04) + bob), scaled)
    return tint(canvas, (0, 0, 0), 0.08)


def install_walk_cycles() -> None:
    print("Generating v80 walk cycle frames...")
    base_path = POSE_DIR / "player-idle-crop-v76.png"
    if not base_path.exists():
        base_path = POSE_DIR / "player-combat-idle-v80.png"
    if not base_path.exists():
        print("  SKIP no base pose")
        return
    base = fit_player(load(base_path))

    frames = {
        "player-walk-left-v80.png": ("left", 0),
        "player-walk-left-b-v80.png": ("left", 1),
        "player-walk-left-c-v80.png": ("left", 2),
        "player-walk-left-d-v80.png": ("left", 3),
        "player-walk-right-v80.png": ("right", 0),
        "player-walk-right-b-v80.png": ("right", 1),
        "player-walk-right-c-v80.png": ("right", 2),
        "player-walk-right-d-v80.png": ("right", 3),
        "player-walk-forward-v80.png": ("forward", 0),
        "player-walk-forward-b-v80.png": ("forward", 1),
        "player-walk-forward-c-v80.png": ("forward", 2),
        "player-walk-forward-d-v80.png": ("forward", 3),
        "player-walk-away-v80.png": ("away", 0),
        "player-walk-away-b-v80.png": ("away", 1),
        "player-walk-away-c-v80.png": ("away", 2),
        "player-walk-away-d-v80.png": ("away", 3),
        "player-arriving-v80.png": ("forward", 1),
        "player-entering-location-v80.png": ("forward", 2),
        "player-idle-v80.png": ("forward", 0),
    }
    for name, (direction, phase) in frames.items():
        if name == "player-idle-v80.png":
            save(base, POSE_DIR / name)
        else:
            save(walk_frame(base, direction, phase), POSE_DIR / name)


def composite_loadout(base_key: str, extras: list[str]) -> Image.Image:
    """Build loadout composite from generated armor variants."""
    sources = {
        "base": GENERATED / "survivor-base-v16.png",
        "road": GENERATED / "survivor-road-armor-v17.png",
        "knight": GENERATED / "survivor-knight-armor-v17.png",
        "rusted": GENERATED / "survivor-rusted-armor-v17.png",
        "combat_idle": POSE_DIR / "player-combat-idle-v80.png",
        "melee": POSE_DIR / "player-melee-slash-v80.png",
        "ranged": POSE_DIR / "player-ranged-attack-v80.png",
        "cast": POSE_DIR / "player-cast-attack-v80.png",
        "block": POSE_DIR / "player-block-v80.png",
        "hurt": POSE_DIR / "player-hurt-v80.png",
        "defeated": POSE_DIR / "player-defeated-v80.png",
    }
    src = sources.get(base_key)
    if not src or not src.exists():
        src = sources["combat_idle"]
    img = fit_player(load(src))
    for extra in extras:
        if extra == "hood":
            img = tint(img, (40, 35, 30), 0.12)
        elif extra == "axe":
            draw = ImageDraw.Draw(img)
            w, h = img.size
            draw.polygon([(w * 0.72, h * 0.35), (w * 0.82, h * 0.15), (w * 0.78, h * 0.55)], fill=(*EMBER[:3], 180))
        elif extra == "ranger":
            img = tint(img, (60, 90, 50), 0.1)
        elif extra == "mage":
            img = tint(img, VIOLET, 0.18)
        elif extra == "starter":
            img = tint(img, (80, 60, 40), 0.08)
    return img


LOADOUTS = {
    "scout_hood": (["base"], ["hood"]),
    "ash_axe": (["base"], ["hood", "axe"]),
    "leather_armor": (["road"], []),
    "leather_armor_scout_hood": (["road"], ["hood"]),
    "starter_leather_hood_axe": (["road"], ["hood", "axe", "starter"]),
    "hunter_ranger": (["base"], ["ranger"]),
    "chainmail_sword": (["knight"], []),
    "mage_robe_staff": (["base"], ["mage"]),
}


def install_composites() -> None:
    print("Building v80 gear composite frames...")
    pose_map = {
        "idle-v80.png": lambda k, e: composite_loadout(k, e),
        "combat-idle-v80.png": lambda k, e: composite_loadout("combat_idle", e if e else []),
    }
    for loadout, (base_keys, extras) in LOADOUTS.items():
        base_key = base_keys[0]
        for filename, builder in pose_map.items():
            art = builder(base_key, extras)
            save(art, COMPOSITE_DIR / loadout / filename)

        # Attack poses per loadout
        if loadout == "hunter_ranger":
            art = fit_player(load(POSE_DIR / "player-ranged-attack-v80.png"))
            art = tint(art, (60, 90, 50), 0.1)
            save(art, COMPOSITE_DIR / loadout / "ranged-attack-v80.png")
        elif loadout == "mage_robe_staff":
            art = fit_player(load(POSE_DIR / "player-cast-attack-v80.png"))
            art = tint(art, VIOLET, 0.15)
            save(art, COMPOSITE_DIR / loadout / "cast-attack-v80.png")
        else:
            art = composite_loadout(base_key, extras + ["axe"] if "axe" in extras else [])
            if art:
                melee_src = POSE_DIR / "player-melee-slash-v80.png"
                if melee_src.exists():
                    art = fit_player(load(melee_src))
                    if "hood" in extras:
                        art = tint(art, (40, 35, 30), 0.1)
                save(art, COMPOSITE_DIR / loadout / "melee-slash-v80.png")

        for pose_file, src_name in [
            ("block-v80.png", "player-block-v80.png"),
            ("hurt-v80.png", "player-hurt-v80.png"),
            ("defeated-v80.png", "player-defeated-v80.png"),
        ]:
            src = POSE_DIR / src_name
            if src.exists() and loadout in ("starter_leather_hood_axe", "hunter_ranger", "chainmail_sword", "mage_robe_staff"):
                art = fit_player(load(src))
                if loadout == "mage_robe_staff":
                    art = tint(art, VIOLET, 0.12)
                elif loadout == "hunter_ranger":
                    art = tint(art, (60, 90, 50), 0.08)
                save(art, COMPOSITE_DIR / loadout / pose_file)


def main() -> None:
    install_cultist_sprites()
    install_walk_cycles()
    install_composites()
    print("Done.")


if __name__ == "__main__":
    main()
