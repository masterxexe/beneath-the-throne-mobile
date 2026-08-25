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
    """Fallback only: hue-shift the bandit. Never paint opaque geometry over the sprite."""
    r_ch, g_ch, b_ch, a = src.split()
    r_ch = r_ch.point(lambda x: min(255, int(x * 0.78)))
    g_ch = g_ch.point(lambda x: min(255, int(x * 0.62)))
    b_ch = b_ch.point(lambda x: min(255, int(x * 1.28)))
    graded = Image.merge("RGBA", (r_ch, g_ch, b_ch, a))
    overlay = Image.new("RGBA", graded.size, (*VIOLET, 0))
    mask = a.point(lambda v: int(v * 0.18))
    overlay.putalpha(mask)
    return Image.alpha_composite(graded, overlay)


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
    painted = ACTOR_V80 / "cultist-acolyte-idle-v80.png"
    if painted.exists() and painted.stat().st_size > 200_000:
        print("Keeping painted cultist acolyte sprites.")
        return
    print("Painted cultist missing; hue-shifting bandit as fallback...")
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
            if not src.exists():
                continue
            art = fit_player(load(src))
            if "hood" in extras:
                art = tint(art, (40, 35, 30), 0.08)
            if loadout == "mage_robe_staff":
                art = tint(art, VIOLET, 0.12)
            elif loadout == "hunter_ranger":
                art = tint(art, (60, 90, 50), 0.08)
            save(art, COMPOSITE_DIR / loadout / pose_file)


def install_location_art() -> None:
    print("Generating location art for Cinderhook Slums and Lower Ward...")
    towns = ROOT / "assets/towns/generated"
    market = towns / "market-town-world-v71.png"
    keep = towns / "ashen-keep-world-v71.png"
    if market.exists():
        slum = tint(load(market), EMBER, 0.14)
        slum = color_grade(slum, 1.05, 0.88, 0.82)
        save(slum, towns / "cinderhook-slums-world-v71.png")
        save(slum.resize((1672, 941), Image.Resampling.LANCZOS), towns / "cinderhook-slums-v18.png")
    if keep.exists():
        ward = tint(load(keep), GOLD, 0.08)
        ward = color_grade(ward, 0.95, 0.98, 1.05)
        save(ward, towns / "lower-ward-world-v71.png")
        save(ward.resize((1672, 941), Image.Resampling.LANCZOS), towns / "lower-ward-v18.png")


def install_mine_interior() -> None:
    print("Generating mine interior art...")
    interiors = ROOT / "assets/interiors/generated"
    forge = interiors / "blacksmith-forge-v20.png"
    if not forge.exists():
        print("  SKIP mine-cut (no forge source)")
        return
    mine = tint(load(forge), (48, 62, 72), 0.28)
    mine = color_grade(mine, 0.72, 0.78, 0.88)
    w, h = mine.size
    cave_overlay = Image.new("RGBA", mine.size, (0, 0, 0, 0))
    cave_draw = ImageDraw.Draw(cave_overlay)
    cave_draw.rectangle((0, 0, w, int(h * 0.35)), fill=(8, 12, 18, 120))
    cave_draw.ellipse((int(w * 0.35), int(h * 0.42), int(w * 0.65), int(h * 0.72)), fill=(28, 32, 38, 80))
    mine = Image.alpha_composite(mine, cave_overlay)
    ore_glow = Image.new("RGBA", mine.size, (0, 0, 0, 0))
    ore_draw = ImageDraw.Draw(ore_glow)
    ore_draw.polygon(
        [(w * 0.44, h * 0.54), (w * 0.56, h * 0.52), (w * 0.62, h * 0.64), (w * 0.48, h * 0.68)],
        fill=(*EMBER[:3], 90),
    )
    mine = Image.alpha_composite(mine, ore_glow)
    save(mine, interiors / "mine-cut-v20.png")


def install_overworld_map() -> None:
    print("Generating premium overworld map art...")
    src = ROOT / "assets/overworld-map-v12.png"
    if not src.exists():
        print("  SKIP overworld-map-v20 (no v12 source)")
        return
    art = load(src)
    art = color_grade(art, 1.04, 0.96, 0.9)
    art = tint(art, (48, 38, 28), 0.06)
    art = ImageEnhance.Contrast(art).enhance(1.08)
    art = ImageEnhance.Sharpness(art).enhance(1.12)
    w, h = art.size
    vignette = Image.new("RGBA", art.size, (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((-w * 0.08, -h * 0.12, w * 1.08, h * 1.14), fill=(8, 6, 4, 0))
    vdraw.rectangle((0, 0, w, h), fill=(0, 0, 0, 0))
    for i in range(8):
        alpha = int(18 + i * 10)
        inset_x = int(w * (0.02 + i * 0.012))
        inset_y = int(h * (0.02 + i * 0.01))
        vdraw.rectangle((inset_x, inset_y, w - inset_x, h - inset_y), outline=(12, 8, 4, alpha))
    glow = Image.new("RGBA", art.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((int(w * 0.18), int(h * 0.62), int(w * 0.42), int(h * 0.92)), fill=(*EMBER[:3], 28))
    gdraw.ellipse((int(w * 0.52), int(h * 0.18), int(w * 0.78), int(h * 0.42)), fill=(*GOLD[:3], 22))
    gdraw.ellipse((int(w * 0.62), int(h * 0.48), int(w * 0.9), int(h * 0.78)), fill=(72, 96, 82, 18))
    art = Image.alpha_composite(art.convert("RGBA"), glow)
    art = Image.alpha_composite(art, vignette)
    save(art, ROOT / "assets/overworld-map-v20.png")


def install_companion_actors() -> None:
    print("Refreshing companion combat actor variants...")
    npc_dir = ROOT / "assets/npcs/generated/v1"
    artifact_dir = Path("/opt/cursor/artifacts/assets")
    pairs = [
        ("healer_herbalist-v1.png", "companion-healer-idle-v80.png"),
        ("companion_mage-v1.png", "companion-mage-idle-v80.png"),
    ]
    for npc_name, actor_name in pairs:
        src = npc_dir / npc_name
        if not src.exists():
            alt = artifact_dir / npc_name.replace("_", "-").replace("v1", "v80")
            src = alt if alt.exists() else src
        if not src.exists():
            print(f"  SKIP {npc_name}")
            continue
        img = load(src).resize(ENEMY_SIZE, Image.Resampling.LANCZOS)
        save(img, ACTOR_V80 / actor_name)


def main() -> None:
    install_cultist_sprites()
    install_walk_cycles()
    install_composites()
    install_location_art()
    install_mine_interior()
    install_overworld_map()
    try:
        install_companion_actors()
    except Exception as exc:
        print(f"  companion actors skipped: {exc}")
    print("Done.")


if __name__ == "__main__":
    main()
