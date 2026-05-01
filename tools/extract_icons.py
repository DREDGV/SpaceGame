"""
extract_icons.py — нарезка иконок из ChatGPT-листа.

Использование:
  python tools/extract_icons.py <путь_к_картинке> [имя1 имя2 ...]

Флаги (до имён):
  --col-gap N    минимальная плотность пикселей в колонке, чтобы считалась контентом (по умолч. 8)
                 Уменьши если иконки слипаются (например --col-gap 15)

Примеры:
  # Имена автоматически (icon_r0c0.png, ...)
  python tools/extract_icons.py "C:/Downloads/icons.png"

  # Имена вручную (строки разделены --)
  python tools/extract_icons.py icons.png wood stone fiber -- campfire rest_tent

  # Плотный лист — уменьшить порог разделения
  python tools/extract_icons.py icons.png --col-gap 15 clay brick dry_fiber hide sharp_stone coal

Иконки сохраняются в web/prototype/assets/icons/
"""

import sys
import os
import numpy as np
from PIL import Image

# ── Настройки ────────────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "prototype", "assets", "icons")
ICON_SIZE = 128          # финальный размер иконки (пиксели)
PAD = 10                 # отступ вокруг содержимого при кропе
GAP_THRESHOLD = 8        # мин. плотность пикселей, чтобы считаться "контентом"
ROW_THRESHOLD = 8        # то же для рядов
# ─────────────────────────────────────────────────────────────────────────────


def remove_checkerboard(arr: np.ndarray) -> np.ndarray:
    """RGB с шашечным фоном → RGBA."""
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = r.astype(int) + g.astype(int) + b.astype(int)
    grayness = (np.maximum(r, np.maximum(g, b)).astype(int) -
                np.minimum(r, np.minimum(g, b)).astype(int))
    # Шашечный серый: малонасыщенный + очень светлый
    bg_mask = (grayness < 15) & (lum > 630)
    rgba = np.zeros((*arr.shape[:2], 4), dtype=np.uint8)
    rgba[:, :, :3] = arr[:, :, :3]
    rgba[:, :, 3] = np.where(bg_mask, 0, 255).astype(np.uint8)
    return rgba


def get_alpha(img: Image.Image) -> np.ndarray:
    """Получить канал прозрачности, снимая шашечный фон если нужно."""
    arr = np.array(img)
    if img.mode == "RGBA":
        alpha = arr[:, :, 3]
        # Если реальная прозрачность почти нулевая — вероятно шашечный фон
        if np.sum(alpha < 10) < img.width * img.height * 0.05:
            arr = remove_checkerboard(arr)
            alpha = arr[:, :, 3]
        return alpha, arr
    else:
        arr_rgb = np.array(img.convert("RGB"))
        rgba = remove_checkerboard(arr_rgb)
        return rgba[:, :, 3], rgba


def find_zones(density: np.ndarray, threshold: int) -> list[tuple[int, int]]:
    """Найти непрерывные зоны с density > threshold."""
    zones = []
    in_zone = False
    start = 0
    for i, d in enumerate(density):
        if not in_zone and d > threshold:
            in_zone = True
            start = i
        elif in_zone and d <= threshold:
            in_zone = False
            zones.append((start, i - 1))
    if in_zone:
        zones.append((start, len(density) - 1))
    return zones


def crop_icon(rgba: np.ndarray, r0: int, r1: int, c0: int, c1: int,
              img_h: int, img_w: int) -> Image.Image:
    """Вырезать иконку, сделать квадрат 128x128."""
    alpha = rgba[:, :, 3]
    region = alpha[r0:r1+1, c0:c1+1]
    rw = np.where(np.any(region > 10, axis=1))[0]
    cw = np.where(np.any(region > 10, axis=0))[0]
    if not len(rw) or not len(cw):
        return None

    yr0 = max(0, r0 + rw[0] - PAD)
    yr1 = min(img_h - 1, r0 + rw[-1] + PAD)
    xc0 = max(0, c0 + cw[0] - PAD)
    xc1 = min(img_w - 1, c0 + cw[-1] + PAD)

    crop_arr = rgba[yr0:yr1+1, xc0:xc1+1]
    crop_img = Image.fromarray(crop_arr, "RGBA")

    side = max(crop_img.width, crop_img.height)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(crop_img, ((side - crop_img.width) // 2, (side - crop_img.height) // 2))
    return sq.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)


def extract(image_path: str, names: list[list[str]], col_gap: int = GAP_THRESHOLD) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    img = Image.open(image_path)
    alpha, rgba = get_alpha(img)
    H, W = alpha.shape

    # Найти ряды
    row_density = np.sum(alpha > 10, axis=1)
    row_zones = find_zones(row_density, ROW_THRESHOLD)
    print(f"Найдено рядов: {len(row_zones)}")

    saved = []
    for ri, (ry0, ry1) in enumerate(row_zones):
        # Найти колонки внутри ряда
        row_alpha = alpha[ry0:ry1+1, :]
        col_density = np.sum(row_alpha > 10, axis=0)

        # Динамический порог: адаптируется к плотности ряда, но не ниже col_gap
        dyn_threshold = max(col_gap, int(np.max(col_density) * 0.03))
        col_zones = find_zones(col_density, dyn_threshold)

        row_names = names[ri] if ri < len(names) else []
        print(f"  Ряд {ri}: {len(col_zones)} иконок")

        for ci, (cx0, cx1) in enumerate(col_zones):
            icon = crop_icon(rgba, ry0, ry1, cx0, cx1, H, W)
            if icon is None:
                print(f"    [{ri},{ci}] пропущен (пустой)")
                continue

            if ci < len(row_names):
                fname = f"{row_names[ci]}.png"
            else:
                fname = f"icon_r{ri}c{ci}.png"

            out_path = os.path.join(OUT_DIR, fname)
            icon.save(out_path, "PNG")
            saved.append(fname)
            print(f"    [{ri},{ci}] → {fname}  ({icon.width}×{icon.height})")

    print(f"\nГотово: {len(saved)} иконок → {os.path.abspath(OUT_DIR)}")


def parse_args(argv: list[str]):
    """argv[1] = путь к файлу, флаги, остальное — имена (строки разделены '--')."""
    if len(argv) < 2:
        print(__doc__)
        sys.exit(0)

    image_path = argv[1]
    raw = argv[2:]

    # Извлечь флаги
    col_gap = GAP_THRESHOLD
    filtered = []
    i = 0
    while i < len(raw):
        if raw[i] == "--col-gap" and i + 1 < len(raw):
            col_gap = int(raw[i + 1])
            i += 2
        else:
            filtered.append(raw[i])
            i += 1

    # Разбить имена по '--' на ряды
    rows: list[list[str]] = []
    current: list[str] = []
    for tok in filtered:
        if tok == "--":
            rows.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        rows.append(current)

    return image_path, rows, col_gap


if __name__ == "__main__":
    path, name_rows, col_gap = parse_args(sys.argv)
    extract(path, name_rows, col_gap)
