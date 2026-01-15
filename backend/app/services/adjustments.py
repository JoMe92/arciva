from PIL import Image
import numpy as np

from .. import schemas


def apply_adjustments(
    image: Image.Image, adjustments: schemas.QuickFixAdjustments | None
) -> Image.Image:
    """Apply the configured adjustments in a deterministic order."""

    # FIXME: Deactivated for client-side transition (QuickFix Renderer)
    # logic moved to frontend (WASM)
    # See: https://github.com/JoMe92/quickfix-renderer
    return image.copy()

    # if adjustments is None:
    #     return image.copy()

    # working = image.copy()
    # if working.mode != "RGB":
    #     working = working.convert("RGB")

    # if adjustments.geometry:
    #     working = apply_geometry(working, adjustments.geometry)

    # if adjustments.crop:
    #     working = apply_crop_rotate(working, adjustments.crop)

    # if adjustments.exposure:
    #     working = apply_exposure(working, adjustments.exposure)

    # if adjustments.color:
    #     working = apply_color_balance(working, adjustments.color)

    # if adjustments.grain:
    #     working = apply_grain(working, adjustments.grain)

    # return working


def apply_crop_rotate(
    image: Image.Image, settings: schemas.CropSettings
) -> Image.Image:
    result = image
    if settings.rotation:
        # Keep canvas size stable (expand=False) but use bicubic resampling for a smooth rotate.
        result = result.rotate(
            -settings.rotation,
            resample=Image.Resampling.BICUBIC,
            expand=False,
        )

    if settings.aspect_ratio:
        try:
            target_ratio = float(settings.aspect_ratio)
        except (ValueError, TypeError):
            # If it's a string like "1:1", we might need a parser.
            # For now, if it fails to convert to float directly, we skip or handle common presets.
            if isinstance(settings.aspect_ratio, str) and ":" in settings.aspect_ratio:
                try:
                    w, h = map(float, settings.aspect_ratio.split(":"))
                    target_ratio = w / h
                except (ValueError, ZeroDivisionError):
                    target_ratio = 0.0
            else:
                target_ratio = 0.0

        if target_ratio > 0:
            current_ratio = result.width / result.height
            if abs(current_ratio - target_ratio) > 1e-3:
                if current_ratio > target_ratio:
                    new_width = int(result.height * target_ratio)
                    offset = max((result.width - new_width) // 2, 0)
                    result = result.crop((offset, 0, offset + new_width, result.height))
                else:
                    new_height = int(result.width / target_ratio)
                    offset = max((result.height - new_height) // 2, 0)
                    result = result.crop((0, offset, result.width, offset + new_height))

    return result


def _apply_highlights_shadows(
    arr: np.ndarray, settings: schemas.ExposureSettings
) -> np.ndarray:
    result = arr
    if settings.highlights:
        highlight_mask = np.clip((result - 0.5) * 2.0, 0.0, 1.0)
        result = result + highlight_mask * settings.highlights * 0.5
    if settings.shadows:
        shadow_mask = np.clip((0.5 - result) * 2.0, 0.0, 1.0)
        result = result + shadow_mask * settings.shadows * 0.5
    return result


def apply_exposure(
    image: Image.Image, settings: schemas.ExposureSettings
) -> Image.Image:
    arr = np.asarray(image).astype(np.float32) / 255.0

    if settings.exposure:
        arr = arr * pow(2.0, settings.exposure)

    if settings.contrast and abs(settings.contrast - 1.0) > 1e-3:
        arr = (arr - 0.5) * settings.contrast + 0.5

    arr = _apply_highlights_shadows(arr, settings)
    arr = np.clip(arr, 0.0, 1.0)

    return Image.fromarray((arr * 255).astype(np.uint8))


def apply_color_balance(
    image: Image.Image, settings: schemas.ColorSettings
) -> Image.Image:
    if not settings.temperature and not settings.tint:
        return image

    arr = np.asarray(image).astype(np.float32)

    temp = max(-1.0, min(1.0, settings.temperature))
    tint = max(-1.0, min(1.0, settings.tint))

    temp_r = 1.0 + temp * 0.25
    temp_b = 1.0 - temp * 0.25
    tint_g = 1.0 - tint * 0.2
    tint_rb = 1.0 + tint * 0.1

    factors = np.array([temp_r * tint_rb, tint_g, temp_b * tint_rb], dtype=np.float32)
    arr = arr * factors
    arr = np.clip(arr, 0.0, 255.0)

    return Image.fromarray(arr.astype(np.uint8))


def apply_grain(image: Image.Image, settings: schemas.GrainSettings) -> Image.Image:
    if settings.amount <= 0:
        return image

    width, height = image.size
    scale = 1
    if settings.size == "medium":
        scale = 2
    elif settings.size == "coarse":
        scale = 4

    noise_w = max(1, (width + scale - 1) // scale)
    noise_h = max(1, (height + scale - 1) // scale)

    sigma = max(0.0, min(1.0, settings.amount)) * 25.0
    noise = np.random.normal(0.0, sigma, (noise_h, noise_w)).astype(np.float32)

    if scale > 1:
        noise = np.repeat(noise, scale, axis=0)
        noise = np.repeat(noise, scale, axis=1)

    noise = noise[:height, :width]

    img_arr = np.asarray(image).astype(np.float32)
    img_arr = img_arr + noise[..., None]
    img_arr = np.clip(img_arr, 0.0, 255.0)
    return Image.fromarray(img_arr.astype(np.uint8))


def apply_geometry(
    image: Image.Image, settings: schemas.GeometrySettings
) -> Image.Image:
    if not settings.vertical and not settings.horizontal:
        return image

    width, height = image.size
    max_x_offset = width * 0.25
    max_y_offset = height * 0.25

    v = max(-1.0, min(1.0, settings.vertical))
    h = max(-1.0, min(1.0, settings.horizontal))

    top_inset = v * max_x_offset
    bottom_inset = -v * max_x_offset
    left_y = h * max_y_offset
    right_y = -h * max_y_offset

    def clamp_x(value: float) -> float:
        return max(-max_x_offset, min(width + max_x_offset, value))

    def clamp_y(value: float) -> float:
        return max(-max_y_offset, min(height + max_y_offset, value))

    ul = (clamp_x(0 + top_inset), clamp_y(0 + left_y))
    ll = (clamp_x(0 + bottom_inset), clamp_y(height - left_y))
    lr = (clamp_x(width - bottom_inset), clamp_y(height - right_y))
    ur = (clamp_x(width - top_inset), clamp_y(0 + right_y))

    quad = (ul[0], ul[1], ll[0], ll[1], lr[0], lr[1], ur[0], ur[1])
    return image.transform(
        (width, height),
        Image.QUAD,
        quad,
        resample=Image.Resampling.BICUBIC,
    )
