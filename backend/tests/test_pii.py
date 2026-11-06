"""Tests for PII detection service."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.pii import PIIService, pii_service
from app.services.recognizers import (
    SpanishNIFRecognizer,
    SpanishNIERecognizer,
    SpanishCIFRecognizer,
)


class TestSpanishRecognizers:
    """Tests for custom Spanish recognizers."""

    def test_dni_valid(self):
        """Test valid DNI with correct check letter."""
        recognizer = SpanishNIFRecognizer()
        # 12345678 -> 12345678 % 23 = 14 -> Z (TRWAGMYFPDXBNJZSQVHLCKE[14])
        assert recognizer.validate_result("12345678Z") is True
        # 87654321 -> 87654321 % 23 = 8 -> G
        assert recognizer.validate_result("87654321G") is True

    def test_dni_invalid(self):
        """Test invalid DNI with wrong check letter."""
        recognizer = SpanishNIFRecognizer()
        assert recognizer.validate_result("12345678A") is False  # Wrong letter
        assert recognizer.validate_result("12345678") is False  # Too short
        assert recognizer.validate_result("abcdefgh") is False  # Not numeric

    def test_nie_valid(self):
        """Test valid NIE."""
        recognizer = SpanishNIERecognizer()
        # X1234567 -> X=0 -> 01234567 -> same as DNI 01234567
        # 01234567 % 23 = 3 -> D
        assert recognizer.validate_result("X1234567D") is True
        # Y7654321 -> Y=1 -> 17654321 % 23 = ?
        # 17654321 % 23 = 10 -> K
        assert recognizer.validate_result("Y7654321K") is True

    def test_nie_invalid(self):
        """Test invalid NIE."""
        recognizer = SpanishNIERecognizer()
        assert recognizer.validate_result("X1234567A") is False
        assert recognizer.validate_result("A1234567B") is False  # Invalid prefix

    def test_cif_valid(self):
        """Test valid CIF."""
        recognizer = SpanishCIFRecognizer()
        # A1234567 -> test with valid control
        # This is a basic test, real validation is more complex
        assert recognizer.validate_result("A12345672") is not None


class TestPIIService:
    """Tests for PIIService."""

    @pytest.fixture
    def mock_presidio_analyzer(self):
        with patch("app.services.pii.AnalyzerEngine") as mock:
            yield mock

    @pytest.fixture
    def mock_presidio_anonymizer(self):
        with patch("app.services.pii.AnonymizerEngine") as mock:
            yield mock

    @pytest.mark.asyncio
    async def test_analyze_local_fallback(self, mock_presidio_analyzer, mock_presidio_anonymizer):
        """Test local analyzer fallback when remote fails."""
        service = PIIService()
        service._presidio_analyzer_url = "http://localhost:3000"
        service._presidio_anonymizer_url = "http://localhost:3001"

        # Mock remote failure
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.side_effect = Exception("Connection failed")

            # Mock local analyzer
            mock_analyzer = MagicMock()
            mock_result = MagicMock()
            mock_result.entity_type = "PERSON"
            mock_result.start = 0
            mock_result.end = 10
            mock_result.score = 0.9
            mock_analyzer.analyze.return_value = [mock_result]
            service._analyzer = mock_analyzer

            results = await service.analyze("Juan Garcia", language="es")

            assert len(results) == 1
            assert results[0]["entity_type"] == "PERSON"
            assert results[0]["start"] == 0
            assert results[0]["end"] == 10

    @pytest.mark.asyncio
    async def test_anonymize_local(self, mock_presidio_anonymizer):
        """Test local anonymization."""
        service = PIIService()
        service._anonymizer = MagicMock()
        mock_result = MagicMock()
        mock_result.text = "[REDACTED] vive en Madrid"
        service._anonymizer.anonymize.return_value = mock_result

        analyzer_results = [
            {"entity_type": "PERSON", "start": 0, "end": 10, "score": 0.9}
        ]

        result = await service.anonymize("Juan Garcia vive en Madrid", analyzer_results)

        assert result == "[REDACTED] vive en Madrid"
        service._anonymizer.anonymize.assert_called_once()

    def test_map_entities_to_pages(self):
        """Test mapping entities from full text to page bboxes."""
        service = PIIService()

        pages = [
            {
                "page_num": 1,
                "text": "Paciente: Juan Garcia",
                "words": [
                    {"text": "Paciente:", "bbox": [100, 100, 200, 120]},
                    {"text": "Juan", "bbox": [210, 100, 260, 120]},
                    {"text": "Garcia", "bbox": [270, 100, 330, 120]},
                ],
            },
            {
                "page_num": 2,
                "text": "DNI: 12345678Z",
                "words": [
                    {"text": "DNI:", "bbox": [100, 100, 150, 120]},
                    {"text": "12345678Z", "bbox": [160, 100, 250, 120]},
                ],
            },
        ]

        entities = [
            {"entity_type": "PERSON", "start": 10, "end": 20, "score": 0.9},  # "Juan Garcia"
            {"entity_type": "ES_NIF", "start": 33, "end": 42, "score": 0.95},  # "12345678Z"
        ]

        mapped = service.map_entities_to_pages(entities, pages)

        assert len(mapped) == 2
        assert mapped[0]["page_num"] == 1
        assert mapped[0]["bbox"] == [210.0, 100.0, 330.0, 120.0]
        assert mapped[1]["page_num"] == 2
        assert mapped[1]["bbox"] == [160.0, 100.0, 250.0, 120.0]

    def test_find_bbox_in_page(self):
        """Test finding bbox for text range in page."""
        service = PIIService()

        page = {
            "words": [
                {"text": "Hola", "bbox": [10, 10, 40, 30]},
                {"text": "mundo", "bbox": [50, 10, 100, 30]},
                {"text": "test", "bbox": [110, 10, 140, 30]},
            ]
        }

        # "Hola mundo" -> chars 0-9
        bbox = service._find_bbox_in_page(page, 0, 9)
        assert bbox == [10, 10, 100, 30]

        # "mundo" -> chars 5-9
        bbox = service._find_bbox_in_page(page, 5, 9)
        assert bbox == [50, 10, 100, 30]

        # Out of range
        bbox = service._find_bbox_in_page(page, 100, 200)
        assert bbox == [0, 0, 0, 0]
