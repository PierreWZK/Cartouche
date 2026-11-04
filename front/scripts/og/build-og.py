"""Génère l'image d'aperçu du lien (Open Graph, 1200 × 630) aux couleurs de la charte.

Lancé à la main après un changement de visuel : python scripts/og/build-og.py
Écrit public/og.png, servi à la racine du site. Ta consigne : « On continue jusqu'à la fin ».
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
FOND = (14, 14, 16)
AMBRE = (240, 168, 78)
ENCRE = (244, 238, 230)
BRUME = (138, 138, 146)
PLASTIQUE = (184, 184, 181)
PLASTIQUE_OMBRE = (111, 110, 107)
BANDEAU = (31, 60, 122)

FONT_TITRE = "C:/Windows/Fonts/arialbd.ttf"
FONT_TEXTE = "C:/Windows/Fonts/arial.ttf"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"

OUT = Path(__file__).resolve().parents[2] / "public" / "og.png"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def gradient(width: int, height: int, top: tuple, bottom: tuple) -> Image.Image:
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return img


def main() -> None:
    img = Image.new("RGB", (W, H), FOND)
    draw = ImageDraw.Draw(img)

    # Cartouche de face, à droite : boîtier gris, rainures, fenêtre avec planète, bandeau bleu.
    cx, top, cw, ch = 790, 90, 300, 440
    draw.rounded_rectangle([cx, top, cx + cw, top + ch], radius=18, fill=PLASTIQUE, outline=PLASTIQUE_OMBRE, width=4)
    for i in range(7):
        y = top + 40 + i * 14
        draw.rectangle([cx + 60, y, cx + cw - 60, y + 5], fill=PLASTIQUE_OMBRE)

    win = (cx + 30, top + 110, cx + cw - 30, top + 340)
    art = gradient(win[2] - win[0], win[3] - win[1], (43, 35, 80), (107, 63, 122))
    img.paste(art, (win[0], win[1]))
    draw.rectangle(win, outline=(27, 27, 29), width=4)

    # Planète à anneau dans la fenêtre.
    px, py, pr = (win[0] + win[2]) // 2, win[1] + 110, 62
    draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(224, 136, 74))
    draw.ellipse([px - 120, py - 16, px + 120, py + 16], outline=(240, 200, 150), width=9)

    draw.rectangle([win[0], win[3] - 80, win[2], win[3]], fill=BANDEAU)
    draw.text((win[0] + 20, win[3] - 66), "Orbite Basse", font=font(FONT_TITRE, 30), fill=(255, 248, 238))
    draw.text((win[0] + 20, win[3] - 32), "PC · 2024", font=font(FONT_MONO, 16), fill=(255, 248, 238))

    # Texte à gauche.
    draw.text((70, 150), "CARTOUCHE", font=font(FONT_MONO, 22), fill=AMBRE)
    draw.text((70, 190), "La ludothèque", font=font(FONT_TITRE, 84), fill=ENCRE)
    draw.text((70, 280), "qui se feuillette.", font=font(FONT_TITRE, 84), fill=AMBRE)
    draw.text((70, 410), "Filtre, compare les notes et pose tes favoris", font=font(FONT_TEXTE, 30), fill=ENCRE)
    draw.text((70, 450), "sur une étagère en bois.", font=font(FONT_TEXTE, 30), fill=ENCRE)
    draw.text((70, 560), "cartouche.projectp.fr  ·  30 jours, 30 projets", font=font(FONT_MONO, 20), fill=BRUME)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"écrit : {OUT}")


if __name__ == "__main__":
    main()
