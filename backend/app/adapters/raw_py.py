"""
Adapters for interacting with the ``rawpy`` library.

This module isolates direct ``rawpy`` usage behind a thin layer so higher level
services can remain testable without importing the heavy dependency.  The
adapter exposes lightweight data classes describing RAW file characteristics and
embedded thumbnails.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

try:  # pragma: no cover - import guarded for environments without rawpy
    import rawpy
except ImportError:  # pragma: no cover - handled gracefully by the service layer
    rawpy = None  # type: ignore[assignment]


class RawPyAdapterError(RuntimeError):
    """
    Raised when the ``rawpy`` adapter fails to process a RAW file.
    """


@dataclass(slots=True)
class RawPyThumbnail:
    """
    Details about an embedded RAW thumbnail.

    Parameters
    ----------
    format : str
        Thumbnail format identifier as exposed by ``rawpy`` (e.g., ``jpeg`` or
        ``bitmap``).
    data : bytes
        Raw thumbnail payload.
    width : Optional[int]
        Width reported by ``rawpy`` for the thumbnail.
    height : Optional[int]
        Height reported by ``rawpy`` for the thumbnail.
    """

    format: str
    data: bytes
    width: Optional[int]
    height: Optional[int]


@dataclass(slots=True)
class RawPyReadResult:
    """
    Result produced by the ``RawPyAdapter`` after parsing a RAW file.

    Parameters
    ----------
    width : Optional[int]
        Orientation-corrected width returned by ``rawpy``.
    height : Optional[int]
        Orientation-corrected height returned by ``rawpy``.
    raw_width : Optional[int]
        Sensor width reported for the RAW mosaic.
    raw_height : Optional[int]
        Sensor height reported for the RAW mosaic.
    flip : Optional[int]
        Value describing how the image should be flipped/rotated as per LibRaw.
    color_description : Optional[str]
        CFA channel order description (e.g., ``RGBG``).
    raw_type : Optional[int]
        Numeric RAW type identifier from LibRaw.
    thumbnail : Optional[RawPyThumbnail]
        Embedded thumbnail details when available.
    """

    width: Optional[int]
    height: Optional[int]
    raw_width: Optional[int]
    raw_height: Optional[int]
    flip: Optional[int]
    color_description: Optional[str]
    raw_type: Optional[int]
    thumbnail: Optional[RawPyThumbnail]


class RawPyAdapter:
    """
    Adapter responsible for reading RAW files via ``rawpy``.

    The adapter wraps ``rawpy`` exceptions into :class:`RawPyAdapterError` to
    shield callers from the library specifics.  All numeric values are coerced
    into Python primitives to allow downstream serialization.
    """

    def read(self, path: Path) -> RawPyReadResult:
        """
        Read RAW information and embedded thumbnails from ``path``.

        Parameters
        ----------
        path : Path
            Filesystem path pointing to a RAW image.

        Returns
        -------
        RawPyReadResult
            Structured information extracted from the RAW container.

        Raises
        ------
        RawPyAdapterError
            Raised when ``rawpy`` is unavailable or fails to decode the file.
        """

        if rawpy is None:  # pragma: no cover - guarded import path
            raise RawPyAdapterError("rawpy is not installed")

        try:
            with rawpy.imread(str(path)) as raw:
                sizes = raw.sizes
                width = self._to_int(getattr(sizes, "width", None))
                height = self._to_int(getattr(sizes, "height", None))
                raw_width = self._to_int(getattr(sizes, "raw_width", None))
                raw_height = self._to_int(getattr(sizes, "raw_height", None))
                flip = self._to_int(getattr(sizes, "flip", None))
                color_desc = self._decode_bytes(getattr(raw, "color_desc", b""))
                raw_type = self._to_int(getattr(raw, "raw_type", None))
                thumbnail = self._extract_thumbnail(raw)
        except rawpy.LibRawError as exc:  # pragma: no cover - passthrough for envs without RAWs
            raise RawPyAdapterError(str(exc)) from exc

        return RawPyReadResult(
            width=width,
            height=height,
            raw_width=raw_width,
            raw_height=raw_height,
            flip=flip,
            color_description=color_desc,
            raw_type=raw_type,
            thumbnail=thumbnail,
        )

    @staticmethod
    def _to_int(value: Any) -> Optional[int]:
        """
        Attempt to coerce ``value`` into ``int``.

        Parameters
        ----------
        value : Any
            Numeric-like value returned by ``rawpy``.

        Returns
        -------
        Optional[int]
            Converted integer or ``None`` when coercion fails.
        """

        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _decode_bytes(value: Any) -> Optional[str]:
        """
        Decode ``bytes`` values returned by ``rawpy`` helpers.

        Parameters
        ----------
        value : Any
            Potentially a ``bytes`` or ``bytearray`` instance representing
            textual data.

        Returns
        -------
        Optional[str]
            UTF-8 decoded string or ``None`` when decoding is not possible.
        """

        if isinstance(value, (bytes, bytearray)):
            decoded = value.decode("utf-8", errors="ignore").strip()
            return decoded or None
        return None

    def _extract_thumbnail(self, raw: Any) -> Optional[RawPyThumbnail]:
        """
        Extract an embedded thumbnail from an opened RAW instance.

        Parameters
        ----------
        raw : Any
            ``rawpy`` RAW object with the file already opened.

        Returns
        -------
        Optional[RawPyThumbnail]
            Thumbnail payload when available, otherwise ``None``.
        """

        try:
            thumb = raw.extract_thumb()
        except rawpy.LibRawNoThumbnailError:
            return None
        except rawpy.LibRawUnsupportedThumbnailError:
            return None

        thumb_format = getattr(thumb.format, "name", str(getattr(thumb, "format", ""))).lower()
        data = bytes(getattr(thumb, "data", b""))
        width = self._to_int(getattr(thumb, "width", None))
        height = self._to_int(getattr(thumb, "height", None))
        if not data:
            return None
        return RawPyThumbnail(format=thumb_format, data=data, width=width, height=height)
