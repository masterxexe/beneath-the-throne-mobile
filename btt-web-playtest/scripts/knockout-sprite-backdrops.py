#!/usr/bin/env python3
"""Remove studio-black backdrops from combat sprites without eating costume detail."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path("/opt/cursor/artifacts/assets")
ACTOR_V80 = ROOT / "assets/actors/generated/v80"
PLAYER_POSES = ROOT / "assets/portraits/player/poses/base"
PLAYER_COMPOSITES = ROOT / "assets/portraits/player/composites"
ENEMY_DIR = ROOT / "assets/portraits/enemies"
ENEMY_SIZE = (512, 768)


def is_studio_black(r: int, g: int, b: int, a: int, thresh: int, edge_rgb: tuple[int, int, int] | None = None) -> bool:
    if a < 90:
        return True
    if max(r, g, b) <= thresh and (max(r, g, b) - min(r, g, b)) <= 16:
        return True
    if edge_rgb:
        er, eg, eb = edge_rgb
        if a < 160 and abs(r - er) <= 18 and abs(g - eg) <= 18 and abs(b - eb) <= 18:
            return True
    return False


def knockout(img: Image.Image, thresh: int = 20) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    pix = img.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    edge_rgb = pix[0, 0][:3]

    def push(x: int, y: int) -> None:
        i = y * w + x
        if seen[i]:
            return
        r, g, b, a = pix[x, y]
        if not is_studio_black(r, g, b, a, thresh, edge_rgb):
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        pix[x, y] = (0, 0, 0, 0)
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)
    return img


def fit_canvas(img: Image.Image, size: tuple[int, int] = ENEMY_SIZE) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", size, (0, 0, 0, 0))
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    scale = min(size[0] / cw, size[1] / ch) * 0.92
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(resized, ((size[0] - nw) // 2, size[1] - nh - 8), resized)
    return canvas


def stats(img: Image.Image) -> tuple[float, float]:
    pix = img.load()
    w, h = img.size
    trans = black = n = 0
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b, a = pix[x, y]
            n += 1
            if a < 12:
                trans += 1
            elif r < 18 and g < 18 and b < 18:
                black += 1
    return 100 * trans / n, 100 * black / n


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    t, b = stats(img)
    print(f"  {path.relative_to(ROOT)} trans={t:.0f}% black={b:.0f}% {path.stat().st_size // 1024}KB")


def process_file(path: Path, thresh: int = 20, refit: bool = False) -> None:
    img = Image.open(path).convert("RGBA")
    t, b = stats(img)
    if t >= 70 and b <= 6 and "cultist-acolyte" not in path.name:
        print(f"  skip clean {path.name} trans={t:.0f}% black={b:.0f}%")
        return
    used = 40 if t < 50 else thresh
    out = knockout(img, used)
    if refit:
        out = fit_canvas(out, img.size if img.size[0] >= 500 else ENEMY_SIZE)
    save(out, path)


def install_cultist_from_artifacts() -> None:
    mapping = {
        "idle": "cultist-acolyte-idle-v80.png",
        "attack": "cultist-acolyte-attack-v80.png",
        "hurt": "cultist-acolyte-hurt-v80.png",
    }
    processed = {}
    for pose, name in mapping.items():
        src = ARTIFACTS / name
        if not src.exists():
            print(f"  missing artifact {name}, knocking out existing")
            dest = ACTOR_V80 / name
            if dest.exists():
                process_file(dest, thresh=18, refit=True)
            continue
        art = fit_canvas(knockout(Image.open(src), thresh=18), ENEMY_SIZE)
        processed[pose] = art
        save(art, ACTOR_V80 / name)
    hurt = processed.get("hurt")
    if hurt is not None:
        w, h = hurt.size
        fallen = hurt.rotate(78, resample=Image.Resampling.BICUBIC, expand=True)
        fw, fh = fallen.size
        crop = fallen.crop(((fw - w) // 2, max(0, fh - int(h * 0.58)), (fw + w) // 2, fh))
        out = crop.resize((512, 400), Image.Resampling.LANCZOS)
        out = ImageEnhance.Brightness(out).enhance(0.82)
        save(out, ENEMY_DIR / "cultist" / "defeated-v80.png")


def main() -> None:
    print("Knocking out studio-black combat sprites...")
    install_cultist_from_artifacts()
    for path in sorted(ACTOR_V80.glob("*.png")):
        if path.name.startswith("cultist-acolyte-"):
            continue
        process_file(path, thresh=20)
    for path in sorted(PLAYER_POSES.glob("*-v80.png")):
        process_file(path, thresh=20)
    if PLAYER_COMPOSITES.exists():
        for path in sorted(PLAYER_COMPOSITES.glob("**/*-v80.png")):
            process_file(path, thresh=20)
    print("Done.")


if __name__ == "__main__":
    main()
