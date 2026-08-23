#!/usr/bin/env python3
"""Generate combat sprites for Beneath the Throne — dark fantasy style."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
POSE_DIR = ASSETS / "portraits/player/poses/base"
ACTOR_DIR = ASSETS / "actors/generated/v56"
ENEMY_DIR = ASSETS / "portraits/enemies"

# Palette — Ash Court
INK = (7, 8, 12, 255)
VOID = (14, 18, 28, 255)
GOLD = (212, 168, 75, 255)
EMBER = (196, 92, 58, 255)
BONE = (210, 198, 175, 255)
ASH = (138, 150, 168, 255)
MIST = (95, 127, 143, 255)
BLOOD = (158, 47, 42, 255)
VIOLET = (120, 72, 160, 255)
RUST = (140, 78, 48, 255)
WOLF = (62, 58, 54, 255)
ICE = (130, 170, 200, 255)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024}KB)")


def gradient_bg(w: int, h: int, top: tuple, bottom: tuple) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(4))
        draw.line([(0, y), (w, y)], fill=c)
    return img


def glow_ellipse(draw: ImageDraw.ImageDraw, box: tuple, color: tuple, width: int = 0) -> None:
    x0, y0, x1, y1 = box
    for i in range(4, 0, -1):
        alpha = int(color[3] * (i / 5) * 0.35)
        pad = i * 3
        draw.ellipse((x0 - pad, y0 - pad, x1 + pad, y1 + pad), fill=(*color[:3], alpha))
    draw.ellipse(box, fill=color, outline=(*GOLD[:3], 120), width=width or 2)


def draw_ground_shadow(draw: ImageDraw.ImageDraw, cx: int, base_y: int, w: int) -> None:
    draw.ellipse((cx - w, base_y - 8, cx + w, base_y + 18), fill=(0, 0, 0, 90))


def make_enemy_canvas(w: int = 512, h: int = 768) -> tuple[Image.Image, ImageDraw.ImageDraw, int, int]:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, base = w // 2, h - 48
    draw_ground_shadow(draw, cx, base, 120)
    return img, draw, cx, base


def skeleton_warrior() -> Image.Image:
    img, draw, cx, base = make_enemy_canvas()
    # Skull
    glow_ellipse(draw, (cx - 52, base - 520, cx + 52, base - 416), (*BONE[:3], 255))
    draw.rounded_rectangle((cx - 44, base - 510, cx + 44, base - 430), radius=18, fill=BONE, outline=(*ASH[:3], 200), width=2)
    # Eye sockets
    draw.ellipse((cx - 28, base - 488, cx - 10, base - 468), fill=(20, 20, 24, 255))
    draw.ellipse((cx + 10, base - 488, cx + 28, base - 468), fill=(20, 20, 24, 255))
    draw.ellipse((cx - 24, base - 484, cx - 14, base - 472), fill=(*EMBER[:3], 220))
    draw.ellipse((cx + 14, base - 484, cx + 24, base - 472), fill=(*EMBER[:3], 220))
    # Ribcage
    draw.rounded_rectangle((cx - 60, base - 420, cx + 60, base - 240), radius=14, fill=(*BONE[:3], 230), outline=(*ASH[:3], 180), width=2)
    for i in range(5):
        y = base - 400 + i * 32
        draw.arc((cx - 50, y - 8, cx + 50, y + 24), 200, 340, fill=(*ASH[:3], 160), width=3)
    # Arms with sword
    draw.polygon([(cx - 58, base - 400), (cx - 110, base - 300), (cx - 88, base - 288), (cx - 48, base - 380)], fill=BONE)
    draw.polygon([(cx + 58, base - 400), (cx + 95, base - 320), (cx + 115, base - 310), (cx + 72, base - 250)], fill=BONE)
    # Rusted blade
    draw.polygon([(cx + 100, base - 330), (cx + 130, base - 560), (cx + 108, base - 565), (cx + 78, base - 335)], fill=(*RUST[:3], 255), outline=(*GOLD[:3], 100))
    # Legs
    draw.rounded_rectangle((cx - 42, base - 240, cx - 8, base - 40), radius=8, fill=BONE)
    draw.rounded_rectangle((cx + 8, base - 240, cx + 42, base - 40), radius=8, fill=BONE)
    return img


def wolf_stalker() -> Image.Image:
    img, draw, cx, base = make_enemy_canvas()
    body = [(cx - 130, base - 200), (cx + 120, base - 220), (cx + 150, base - 120), (cx - 100, base - 80)]
    draw.polygon(body, fill=WOLF, outline=(*ASH[:3], 200))
    # Head
    draw.polygon([(cx + 90, base - 210), (cx + 200, base - 250), (cx + 220, base - 200), (cx + 130, base - 170)], fill=(*WOLF[:3], 255))
    draw.ellipse((cx + 185, base - 235, cx + 200, base - 220), fill=(*EMBER[:3], 255))
    # Legs
    for ox in (-90, -30, 40, 100):
        draw.rounded_rectangle((cx + ox, base - 120, cx + ox + 28, base - 20), radius=6, fill=(48, 44, 40, 255))
    # Tail
    draw.polygon([(cx - 120, base - 180), (cx - 200, base - 280), (cx - 160, base - 200)], fill=(72, 66, 60, 255))
    # Spines
    for i in range(6):
        x = cx - 60 + i * 28
        draw.polygon([(x, base - 220), (x + 8, base - 260), (x + 16, base - 220)], fill=(*ASH[:3], 200))
    return img


def humanoid_enemy(primary: tuple, accent: tuple, hood: bool = True, weapon: str = "sword") -> Image.Image:
    img, draw, cx, base = make_enemy_canvas()
    # Cape
    draw.polygon([(cx - 80, base - 480), (cx + 80, base - 480), (cx + 110, base - 60), (cx - 110, base - 60)], fill=(*primary[:3], 200))
    # Torso
    draw.rounded_rectangle((cx - 55, base - 420, cx + 55, base - 200), radius=16, fill=(*primary[:3], 255), outline=(*accent[:3], 180), width=2)
    # Head / hood
    if hood:
        draw.pieslice((cx - 50, base - 520, cx + 50, base - 420), 200, 340, fill=(*primary[:3], 255))
        draw.ellipse((cx - 18, base - 478, cx - 4, base - 464), fill=(*EMBER[:3], 240))
        draw.ellipse((cx + 4, base - 478, cx + 18, base - 464), fill=(*EMBER[:3], 240))
    else:
        glow_ellipse(draw, (cx - 40, base - 510, cx + 40, base - 430), (*ASH[:3], 255))
    # Arms
    draw.rounded_rectangle((cx - 95, base - 400, cx - 55, base - 260), radius=10, fill=(*primary[:3], 230))
    draw.rounded_rectangle((cx + 55, base - 400, cx + 95, base - 260), radius=10, fill=(*primary[:3], 230))
    # Weapon
    if weapon == "sword":
        draw.polygon([(cx + 85, base - 380), (cx + 105, base - 560), (cx + 88, base - 568), (cx + 68, base - 385)], fill=(*ASH[:3], 255), outline=(*GOLD[:3], 120))
    elif weapon == "staff":
        draw.rectangle((cx + 78, base - 560, cx + 92, base - 280), fill=(68, 52, 38, 255))
        draw.ellipse((cx + 62, base - 580, cx + 108, base - 534), fill=(*accent[:3], 255), outline=(*GOLD[:3], 100))
    # Legs
    draw.rounded_rectangle((cx - 40, base - 200, cx - 8, base - 35), radius=8, fill=(32, 28, 36, 255))
    draw.rounded_rectangle((cx + 8, base - 200, cx + 40, base - 35), radius=8, fill=(32, 28, 36, 255))
    return img


def corrupted_knight() -> Image.Image:
    img, draw, cx, base = make_enemy_canvas()
    # Dark plate armor
    draw.rounded_rectangle((cx - 75, base - 460, cx + 75, base - 180), radius=20, fill=(28, 32, 48, 255), outline=(*ICE[:3], 160), width=3)
    # Helm
    draw.rounded_rectangle((cx - 58, base - 540, cx + 58, base - 450), radius=14, fill=(36, 40, 58, 255), outline=(*ICE[:3], 200), width=2)
    draw.rectangle((cx - 40, base - 510, cx + 40, base - 490), fill=(8, 10, 16, 255))
    draw.ellipse((cx - 22, base - 506, cx - 8, base - 492), fill=(*ICE[:3], 255))
    draw.ellipse((cx + 8, base - 506, cx + 22, base - 492), fill=(*ICE[:3], 255))
    # Pauldrons
    draw.ellipse((cx - 110, base - 450, cx - 50, base - 390), fill=(40, 44, 62, 255), outline=(*ICE[:3], 140))
    draw.ellipse((cx + 50, base - 450, cx + 110, base - 390), fill=(40, 44, 62, 255), outline=(*ICE[:3], 140))
    # Greatsword
    draw.polygon([(cx + 90, base - 400), (cx + 118, base - 600), (cx + 100, base - 610), (cx + 72, base - 405)], fill=(*MIST[:3], 255), outline=(*ICE[:3], 180))
    draw.rectangle((cx + 70, base - 400, cx + 105, base - 370), fill=(*GOLD[:3], 200))
    # Leg armor
    draw.rounded_rectangle((cx - 50, base - 180, cx - 12, base - 30), radius=10, fill=(32, 36, 52, 255))
    draw.rounded_rectangle((cx + 12, base - 180, cx + 50, base - 30), radius=10, fill=(32, 36, 52, 255))
    # Corruption glow
    draw.ellipse((cx - 30, base - 350, cx + 30, base - 290), fill=(*VIOLET[:3], 60))
    return img


def enemy_defeated(tint: tuple) -> Image.Image:
    img, draw, cx, base = make_enemy_canvas(512, 400)
    draw.polygon([(cx - 100, base - 60), (cx + 120, base - 80), (cx + 80, base - 20), (cx - 80, base - 10)], fill=(*tint[:3], 180))
    draw.line([(cx - 60, base - 100), (cx + 80, base - 40)], fill=(*BONE[:3], 200), width=8)
    draw.ellipse((cx - 30, base - 130, cx + 10, base - 90), fill=(*tint[:3], 220))
    return img


def tint_image(img: Image.Image, color: tuple, amount: float = 0.3) -> Image.Image:
    overlay = Image.new("RGBA", img.size, color)
    return Image.blend(img, overlay, amount)


def transform_pose(base: Image.Image, name: str) -> Image.Image:
    w, h = base.size
    img = base.copy()

    if name == "player-idle-v28.png":
        return img.crop((0, 0, w, int(h * 0.55)))

    if name == "player-combat-idle-v28.png":
        cropped = img.crop((int(w * 0.05), 0, int(w * 0.95), int(h * 0.58)))
        return cropped.resize((w, h), Image.Resampling.LANCZOS)

    if name in ("player-melee-slash-v28.png", "player-meleeAttack"):
        rotated = img.rotate(-18, resample=Image.Resampling.BICUBIC, expand=True)
        rw, rh = rotated.size
        left = max(0, (rw - w) // 2 - 40)
        top = max(0, (rh - int(h * 0.55)) // 2)
        cropped = rotated.crop((left, top, left + w, top + int(h * 0.58)))
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        out.paste(cropped.resize((w, h), Image.Resampling.LANCZOS), (0, 0))
        # Motion slash
        draw = ImageDraw.Draw(out)
        for i in range(4):
            alpha = 80 - i * 15
            draw.arc((w // 2 - 80 + i * 10, h // 4, w // 2 + 180, h // 2 + 120), 200, 320, fill=(*GOLD[:3], alpha), width=6)
        return out

    if name == "player-block-v28.png":
        rotated = img.rotate(12, resample=Image.Resampling.BICUBIC, expand=True)
        rw, rh = rotated.size
        cropped = rotated.crop(((rw - w) // 2, (rh - int(h * 0.55)) // 2, (rw + w) // 2, (rh + int(h * 0.55)) // 2 + int(h * 0.55)))
        out = cropped.resize((w, h), Image.Resampling.LANCZOS)
        return tint_image(out, (*MIST[:3], 255), 0.15)

    if name == "player-hurt-v28.png":
        rotated = img.rotate(8, resample=Image.Resampling.BICUBIC, expand=True)
        rw, rh = rotated.size
        cropped = rotated.crop(((rw - w) // 2, 0, (rw + w) // 2, int(h * 0.55)))
        out = cropped.resize((w, h), Image.Resampling.LANCZOS)
        return tint_image(out, (*BLOOD[:3], 255), 0.25)

    if name == "player-defeated-v28.png":
        rotated = img.rotate(85, resample=Image.Resampling.BICUBIC, expand=True)
        rw, rh = rotated.size
        cropped = rotated.crop(((rw - w) // 2, (rh - int(h * 0.4)) // 2, (rw + w) // 2, (rh + int(h * 0.4)) // 2 + int(h * 0.4)))
        out = cropped.resize((w, h), Image.Resampling.LANCZOS)
        return tint_image(out, (0, 0, 0, 255), 0.35)

    if name == "player-thrust-attack-v28.png":
        scaled = img.resize((int(w * 1.08), int(h * 1.08)), Image.Resampling.LANCZOS)
        sw, sh = scaled.size
        cropped = scaled.crop(((sw - w) // 2 + 30, 0, (sw + w) // 2 + 30, int(sh * 0.55)))
        return cropped.resize((w, h), Image.Resampling.LANCZOS)

    if name == "player-ranged-attack-v28.png":
        out = img.crop((0, 0, w, int(h * 0.55))).resize((w, h), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(out)
        draw.polygon([(w - 40, h // 3), (w - 10, h // 3 - 8), (w - 10, h // 3 + 8)], fill=(*GOLD[:3], 220))
        return out

    if name == "player-cast-attack-v28.png":
        out = tint_image(img.crop((0, 0, w, int(h * 0.55))).resize((w, h), Image.Resampling.LANCZOS), (*VIOLET[:3], 255), 0.2)
        draw = ImageDraw.Draw(out)
        draw.ellipse((w // 2 - 60, h // 4, w // 2 + 60, h // 2), fill=(*VIOLET[:3], 80))
        return out

    if name == "player-unarmed-attack-v28.png":
        return transform_pose(base, "player-melee-slash-v28.png")

    if "walk-left" in name:
        return img.transpose(Image.FLIP_LEFT_RIGHT).crop((0, 0, w, int(h * 0.5))).resize((w, h), Image.Resampling.LANCZOS)

    if "walk-right" in name:
        return img.crop((0, 0, w, int(h * 0.5))).resize((w, h), Image.Resampling.LANCZOS)

    if "walk-forward" in name or "walk-down" in name:
        scaled = img.resize((w, int(h * 0.52)), Image.Resampling.LANCZOS)
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        out.paste(scaled, (0, int(h * 0.02)))
        return out

    if "walk-away" in name or "walk-up" in name:
        scaled = img.resize((int(w * 0.92), int(h * 0.48)), Image.Resampling.LANCZOS)
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        out.paste(scaled, (int(w * 0.04), int(h * 0.04)))
        return tint_image(out, (0, 0, 0, 255), 0.1)

    if name in ("player-arriving-v64.png", "player-entering-location-v64.png"):
        return img.crop((0, 0, w, int(h * 0.52))).resize((w, h), Image.Resampling.LANCZOS)

    return img.crop((0, 0, w, int(h * 0.55))).resize((w, h), Image.Resampling.LANCZOS)


def generate_enemies() -> None:
    print("Generating enemy sprites...")
    enemies = {
        "skeleton-warrior-idle-v56.png": skeleton_warrior(),
        "wolf-stalker-idle-v56.png": wolf_stalker(),
        "cultist-bandit-idle-crop-v76.png": humanoid_enemy(RUST, EMBER, hood=True, weapon="sword"),
        "elite-corrupted-knight-idle-v56.png": corrupted_knight(),
    }
    for name, art in enemies.items():
        save(art, ACTOR_DIR / name)

    defeated = {
        "skeleton": BONE,
        "wolf": WOLF,
        "bandit": RUST,
        "cultist": VIOLET,
        "corrupted_knight": ICE,
    }
    for kind, tint in defeated.items():
        save(enemy_defeated(tint), ENEMY_DIR / kind / "defeated-v1.png")


def generate_player_poses() -> None:
    print("Generating player combat poses...")
    base_path = POSE_DIR / "player-idle-crop-v76.png"
    if not base_path.exists():
        print("  WARN: no base idle crop, skipping poses")
        return
    base = Image.open(base_path).convert("RGBA")

    pose_files = [
        "player-idle-v28.png", "player-combat-idle-v28.png",
        "player-melee-slash-v28.png", "player-thrust-attack-v28.png",
        "player-ranged-attack-v28.png", "player-unarmed-attack-v28.png",
        "player-cast-attack-v28.png", "player-block-v28.png",
        "player-hurt-v28.png", "player-defeated-v28.png",
        "player-arriving-v64.png", "player-entering-location-v64.png",
        "player-walk-left-v64.png", "player-walk-left-b-v65.png",
        "player-walk-left-c-v69.png", "player-walk-left-d-v69.png",
        "player-walk-right-v64.png", "player-walk-right-b-v65.png",
        "player-walk-right-c-v69.png", "player-walk-right-d-v69.png",
        "player-walk-forward-v64.png", "player-walk-forward-b-v65.png",
        "player-walk-forward-c-v69.png", "player-walk-forward-d-v69.png",
        "player-walk-away-v64.png", "player-walk-away-b-v65.png",
        "player-walk-away-c-v69.png", "player-walk-away-d-v69.png",
    ]

    for name in pose_files:
        art = transform_pose(base, name)
        save(art, POSE_DIR / name)


def generate_composites() -> None:
    """Refresh composite attack frames from updated poses."""
    print("Refreshing composite attack frames...")
    base_pose = POSE_DIR / "player-melee-slash-v28.png"
    idle_pose = POSE_DIR / "player-combat-idle-v28.png"
    hurt_pose = POSE_DIR / "player-hurt-v28.png"
    block_pose = POSE_DIR / "player-block-v28.png"
    defeated_pose = POSE_DIR / "player-defeated-v28.png"
    cast_pose = POSE_DIR / "player-cast-attack-v28.png"
    ranged_pose = POSE_DIR / "player-ranged-attack-v28.png"

    composites = ASSETS / "portraits/player/composites"
    mapping = {
        "ash_axe/idle-v38.png": idle_pose,
        "ash_axe/combat-idle-v38.png": idle_pose,
        "ash_axe/melee-slash-v38.png": base_pose,
        "leather_armor/idle-v38.png": idle_pose,
        "leather_armor/combat-idle-v38.png": idle_pose,
        "leather_armor/melee-slash-v38.png": base_pose,
        "leather_armor_scout_hood/idle-v38.png": idle_pose,
        "leather_armor_scout_hood/combat-idle-v38.png": idle_pose,
        "leather_armor_scout_hood/melee-slash-v38.png": base_pose,
        "scout_hood/idle-v38.png": idle_pose,
        "scout_hood/combat-idle-v38.png": idle_pose,
        "scout_hood/melee-slash-v38.png": base_pose,
        "chainmail_sword/idle-v39.png": idle_pose,
        "chainmail_sword/combat-idle-v39.png": idle_pose,
        "chainmail_sword/melee-slash-v39.png": base_pose,
        "chainmail_sword/hurt-v39.png": hurt_pose,
        "chainmail_sword/block-v39.png": block_pose,
        "hunter_ranger/idle-v39.png": idle_pose,
        "hunter_ranger/combat-idle-v39.png": idle_pose,
        "hunter_ranger/ranged-attack-v39.png": ranged_pose,
        "hunter_ranger/hurt-v39.png": hurt_pose,
        "hunter_ranger/block-v39.png": block_pose,
        "hunter_ranger/defeated-v39.png": defeated_pose,
        "mage_robe_staff/idle-v39.png": idle_pose,
        "mage_robe_staff/combat-idle-v39.png": idle_pose,
        "mage_robe_staff/cast-attack-v39.png": cast_pose,
        "mage_robe_staff/hurt-v39.png": hurt_pose,
        "mage_robe_staff/block-v39.png": block_pose,
        "mage_robe_staff/defeated-v39.png": defeated_pose,
        "starter_leather_hood_axe/idle-v38.png": idle_pose,
        "starter_leather_hood_axe/combat-idle-v38.png": idle_pose,
        "starter_leather_hood_axe/melee-slash-v38.png": base_pose,
        "starter_leather_hood_axe/hurt-v39.png": hurt_pose,
        "starter_leather_hood_axe/block-v39.png": block_pose,
        "starter_leather_hood_axe/defeated-v39.png": defeated_pose,
    }
    for rel, src in mapping.items():
        if src.exists():
            save(Image.open(src).convert("RGBA"), composites / rel)


def main() -> None:
    generate_enemies()
    generate_player_poses()
    generate_composites()
    print("Done.")


if __name__ == "__main__":
    main()
