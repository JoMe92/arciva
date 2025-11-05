"""
RAW ingestion helpers backed by the :mod:`rawpy` adapter.

The :class:`RawReaderService` coordinates thumbnail extraction and metadata
collection for RAW assets so the ingest worker can treat them similarly to
standard images.
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from PIL import Image

from ..adapters.raw_py import RawPyAdapter, RawPyAdapterError, RawPyReadResult, RawPyThumbnail


class RawReaderProcessingError(RuntimeError):
    """
    Raised when RAW thumbnails cannot be normalised into JPEG bytes.
    """


@dataclass(slots=True)
class RawReadResult:
    """
    Outcome of running the RAW reader service on a file.

    Parameters
    ----------
    preview_bytes : Optional[bytes]
        JPEG bytes suitable for downstream derivative generation.
    preview_width : Optional[int]
        Width reported for the preview image.
    preview_height : Optional[int]
        Height reported for the preview image.
    metadata : Dict[str, Any]
        Additional metadata collected while processing the RAW file.  Keys with
        ``None`` values are omitted to keep payloads concise.
    warnings : List[str]
        Non-fatal issues encountered during processing (e.g., missing
        thumbnails).
    """

    preview_bytes: Optional[bytes]
    preview_width: Optional[int]
    preview_height: Optional[int]
    metadata: Dict[str, Any]
    warnings: List[str]


class RawReaderService:
    """
    High-level RAW reader that relies on :class:`RawPyAdapter`.

    The service consolidates adapter results, converts thumbnails to JPEG when
    required, and produces a metadata dictionary that can be merged into asset
    metadata.
    """

    RAW_EXTENSIONS: Set[str] = {
        "3fr",
        "arw",
        "cr2",
        "cr3",
        "crw",
        "dng",
        "erf",
        "iiq",
        "kdc",
        "mrw",
        "nef",
        "nrw",
        "orf",
        "pef",
        "raf",
        "raw",
        "rw2",
        "rwl",
        "sr2",
        "srw",
    }

    def __init__(self, adapter: Optional[RawPyAdapter] = None) -> None:
        """
        Initialise the RAW reader.

        Parameters
        ----------
        adapter : Optional[RawPyAdapter]
            Custom adapter instance.  When omitted the default adapter is used.
        """

        self._adapter = adapter or RawPyAdapter()

    def supports(self, path: Path) -> bool:
        """
        Determine whether the file extension suggests RAW contents.

        Parameters
        ----------
        path : Path
            Candidate file path.

        Returns
        -------
        bool
            ``True`` when the service should attempt rawpy decoding.
        """

        suffix = path.suffix.lower().lstrip(".")
        return suffix in self.RAW_EXTENSIONS

    def read(self, path: Path) -> RawReadResult:
        """
        Execute the RAW read flow for the given ``path``.

        Parameters
        ----------
        path : Path
            Filesystem path pointing to the RAW source.

        Returns
        -------
        RawReadResult
            Structured preview data and metadata suitable for ingest.
        """

        warnings: List[str] = []
        metadata: Dict[str, Any] = {}
        preview_bytes: Optional[bytes] = None
        preview_width: Optional[int] = None
        preview_height: Optional[int] = None

        try:
            raw_result = self._adapter.read(path)
        except RawPyAdapterError as exc:
            warnings.append("RAW_ADAPTER_ERROR")
            metadata["rawpy_error"] = str(exc)
            return RawReadResult(
                preview_bytes=None,
                preview_width=None,
                preview_height=None,
                metadata=metadata,
                warnings=warnings,
            )

        raw_metadata = self._build_metadata(raw_result)
        metadata["rawpy"] = raw_metadata

        preview_source: Optional[str] = None

        if raw_result.thumbnail:
            try:
                preview_bytes, preview_width, preview_height = self._normalise_thumbnail(raw_result.thumbnail)
                preview_source = "thumbnail"
            except RawReaderProcessingError as exc:
                warnings.append("RAW_THUMBNAIL_CONVERSION_FAILED")
                metadata.setdefault("rawpy", {})["thumbnail_error"] = str(exc)
                if raw_result.preview_jpeg:
                    preview_bytes = raw_result.preview_jpeg
                    preview_width = raw_result.preview_width
                    preview_height = raw_result.preview_height
                    preview_source = "rendered"
        elif raw_result.preview_jpeg:
            preview_bytes = raw_result.preview_jpeg
            preview_width = raw_result.preview_width
            preview_height = raw_result.preview_height
            preview_source = "rendered"
        else:
            warnings.append("RAW_NO_THUMBNAIL")

        if preview_source:
            raw_metadata["preview_source"] = preview_source

        return RawReadResult(
            preview_bytes=preview_bytes,
            preview_width=preview_width,
            preview_height=preview_height,
            metadata=metadata,
            warnings=warnings,
        )

    @staticmethod
    def _build_metadata(raw_result: RawPyReadResult) -> Dict[str, Any]:
        """
        Convert adapter output into a JSON-friendly metadata dictionary.

        Parameters
        ----------
        raw_result : RawPyReadResult
            Structured outcome from the adapter.

        Returns
        -------
        Dict[str, Any]
            Metadata with ``None`` values pruned.
        """

        candidates: Dict[str, Any] = {
            "width": raw_result.width,
            "height": raw_result.height,
            "raw_width": raw_result.raw_width,
            "raw_height": raw_result.raw_height,
            "flip": raw_result.flip,
            "color_description": raw_result.color_description,
            "raw_type": raw_result.raw_type,
        }
        return {key: value for key, value in candidates.items() if value is not None}

    def _normalise_thumbnail(self, thumbnail: RawPyThumbnail) -> Tuple[bytes, Optional[int], Optional[int]]:
        """
        Ensure the embedded thumbnail is represented as JPEG bytes.

        Parameters
        ----------
        thumbnail : RawPyThumbnail
            Thumbnail information returned by the adapter.

        Returns
        -------
        Tuple[bytes, Optional[int], Optional[int]]
            JPEG payload and dimensions.

        Raises
        ------
        RawReaderProcessingError
            Raised when the thumbnail cannot be converted.
        """

        fmt = (thumbnail.format or "").lower()
        if fmt == "jpeg":
            return thumbnail.data, thumbnail.width, thumbnail.height
        if fmt == "bitmap":
            return self._convert_bitmap_thumbnail(thumbnail)

        raise RawReaderProcessingError(f"Unsupported RAW thumbnail format: {thumbnail.format!r}")

    @staticmethod
    def _convert_bitmap_thumbnail(thumbnail: RawPyThumbnail) -> Tuple[bytes, Optional[int], Optional[int]]:
        """
        Convert a bitmap thumbnail into JPEG bytes.

        Parameters
        ----------
        thumbnail : RawPyThumbnail
            Thumbnail containing bitmap pixel data.

        Returns
        -------
        Tuple[bytes, Optional[int], Optional[int]]
            JPEG payload and thumbnail dimensions.

        Raises
        ------
        RawReaderProcessingError
            Raised when conversion fails or essential information is missing.
        """

        if thumbnail.width is None or thumbnail.height is None:
            raise RawReaderProcessingError("Bitmap thumbnail missing dimensions")

        image = None
        try:
            image = Image.frombuffer(
                "RGB",
                (thumbnail.width, thumbnail.height),
                thumbnail.data,
                "raw",
                "RGB",
                0,
                1,
            )
            with BytesIO() as buffer:
                image.save(buffer, format="JPEG", quality=90)
                return buffer.getvalue(), thumbnail.width, thumbnail.height
        except OSError as exc:  # pragma: no cover - depends on pillow internals
            raise RawReaderProcessingError(str(exc)) from exc
        finally:
            if image is not None:
                image.close()
