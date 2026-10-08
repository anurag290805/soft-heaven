"""Create non-destructive web derivatives for the supplied Soft Heaven assets.

The supplied logo remains untouched. The transparent logo only removes the
white canvas around the existing circular artwork; it does not redraw or
recolour any part of the mark.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PRODUCTS = PUBLIC / "images" / "products"
BRAND = PUBLIC / "images" / "brand"
APPROVED_PRODUCT_FILES = {
    "Red+blue_Bouquet.png",
    "Red+Pink_Bouquet.png",
    "blueMix_flower.png",
    "green_dress.png",
    "lavendar_dress.png",
    "lightblue_dress.png",
    "pink_dress.png",
    "red_dress.png",
    "lightblue_flower.png",
    "pink_flower.png",
    "purple_flower.png",
    "white_flower.png",
    "yellow_flower.png",
    "blue_heart.png",
    "pink_heart.png",
    "purple_heart.png",
    "red_heart.png",
    "white_heart.png",
    "Sunflower.png",
}


def make_transparent_logo() -> None:
    source_path = BRAND / "soft-heaven-logo.png"
    output_path = BRAND / "soft-heaven-logo-transparent.png"
    favicon_path = PUBLIC / "soft-heaven-favicon.png"

    source = Image.open(source_path).convert("RGBA")
    # The artwork is a circular badge. Mask only the outside of that badge;
    # the warm inner canvas is part of the supplied artwork and must remain
    # opaque so pale flowers and fine details are not damaged.
    scale = 4
    mask = Image.new("L", (source.width * scale, source.height * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        (-2 * scale, -2 * scale, (source.width - 2) * scale, (source.height - 2) * scale),
        fill=255,
    )
    source.putalpha(mask.resize(source.size, Image.Resampling.LANCZOS))

    source.save(output_path, "PNG", optimize=True)

    favicon = source.copy()
    favicon.thumbnail((256, 256), Image.Resampling.LANCZOS)
    favicon.save(favicon_path, "PNG", optimize=True)


def make_product_webp_derivatives() -> None:
    for source_path in sorted(PRODUCTS.glob("*.png")):
        if source_path.name not in APPROVED_PRODUCT_FILES:
            continue
        output_path = PRODUCTS / "optimized" / f"{source_path.stem}.webp"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.open(source_path).convert("RGB")
        image.save(output_path, "WEBP", quality=90, method=6)
        for width in (480, 800):
            derivative = image.copy()
            derivative.thumbnail((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)
            derivative.save(PRODUCTS / "optimized" / f"{source_path.stem}-{width}.webp", "WEBP", quality=88, method=6)


if __name__ == "__main__":
    make_transparent_logo()
    make_product_webp_derivatives()
