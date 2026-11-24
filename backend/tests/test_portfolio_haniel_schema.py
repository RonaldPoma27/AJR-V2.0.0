"""Validation contracts for the AJR Data 3.6 Haniel portfolio editor."""
import pytest
from pydantic import ValidationError

from app.schemas.cms import (
    PortfolioBlockIn,
    PortfolioItemCreate,
    PortfolioOrderUpdate,
    PortfolioStyle,
    PortfolioTextMark,
)


def test_photo_only_project_is_valid_and_gets_default_style():
    project = PortfolioItemCreate(
        title="Galería",
        description="",
        blocks=[{"id": "photo-1", "type": "image", "size": "large", "url": "https://cdn.example.test/photo.webp"}],
    )
    assert project.description == ""
    assert project.style == PortfolioStyle()
    assert project.blocks[0].type == "image"


def test_text_block_limit_depends_on_size():
    with pytest.raises(ValidationError, match="admite hasta 140 caracteres"):
        PortfolioBlockIn(id="copy", type="text", size="small", text="x" * 141)
    assert PortfolioBlockIn(id="copy", type="text", size="medium", text="x" * 280)


def test_two_color_gradient_is_required_as_a_pair():
    with pytest.raises(ValidationError, match="requiere sus dos colores"):
        PortfolioBlockIn(
            id="copy", type="text", size="small", text="Hola",
            gradient_start="#22D3EE",
        )


def test_invalid_css_colors_are_rejected():
    with pytest.raises(ValidationError, match="HEX #RRGGBB"):
        PortfolioStyle(background_color="url(javascript:alert(1))")


def test_text_marks_cannot_exceed_the_text_range():
    with pytest.raises(ValidationError, match="excede la longitud"):
        PortfolioBlockIn(
            id="copy", type="text", size="small", text="Hola",
            marks=[{"start": 0, "end": 5, "bold": True}],
        )


def test_legacy_image_url_and_gallery_payload_remain_supported():
    project = PortfolioItemCreate(
        title="Proyecto anterior",
        description="Resumen",
        image_url="https://cdn.example.test/cover.png",
    )
    assert len(project.media) == 1
    assert project.media[0].url.endswith("cover.png")
    assert project.blocks == []


def test_reorder_rejects_duplicate_project_ids():
    with pytest.raises(ValidationError, match="repetidos"):
        PortfolioOrderUpdate(ids=[4, 2, 4])


def test_project_media_gallery_limit_is_enforced():
    media = [{"url": f"https://cdn.example.test/{index}.png", "media_type": "image"} for index in range(31)]
    with pytest.raises(ValidationError):
        PortfolioItemCreate(title="Galería extensa", media=media)
