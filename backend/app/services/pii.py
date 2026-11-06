"""PII detection and anonymization service using Presidio."""
from typing import List, Dict, Optional, Any
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
import httpx
import logging

logger = logging.getLogger(__name__)


LEGAL_ENTITIES = [
    "PERSON",
    "LOCATION",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "IBAN_CODE",
    "CREDIT_CARD",
    "DATE_TIME",
    "NRP",
    "ES_NIF",
    "ES_NIE",
    "ES_CIF",
    "ES_CC",
    "LICENSE_PLATE",
    "IP_ADDRESS",
    "URL",
    "CAT_CIP",
    "ICD10",
    "EXPEDIENTE",
    "COLEGIADO",
]


class PIIService:
    def __init__(self):
        self._analyzer = None
        self._anonymizer = None
        self._presidio_analyzer_url = None
        self._presidio_anonymizer_url = None

    async def initialize(self, analyzer_url: str, anonymizer_url: str):
        self._presidio_analyzer_url = analyzer_url
        self._presidio_anonymizer_url = anonymizer_url
        await self._test_connections()
        await self._init_local_analyzer()

    async def _test_connections(self):
        async with httpx.AsyncClient(timeout=5.0) as client:
            for url, name in [
                (self._presidio_analyzer_url, "analyzer"),
                (self._presidio_anonymizer_url, "anonymizer"),
            ]:
                try:
                    resp = await client.get(f"{url}/health")
                    if resp.status_code == 200:
                        logger.info(f"Presidio {name} connected at {url}")
                    else:
                        logger.warning(f"Presidio {name} health check failed: {resp.status_code}")
                except Exception as e:
                    logger.warning(f"Presidio {name} not available: {e}")

    async def _init_local_analyzer(self):
        try:
            nlp_config = {
                "nlp_engine_name": "spacy",
                "models": [
                    {"lang_code": "es", "model_name": "es_core_news_lg"},
                    {"lang_code": "en", "model_name": "en_core_web_lg"},
                ],
            }
            provider = NlpEngineProvider(nlp_configuration=nlp_config)
            nlp_engine = provider.create_engine()

            registry = RecognizerRegistry()
            registry.load_predefined_recognizers(nlp_engine=nlp_engine)

            from app.services.recognizers import (
                SpanishNIFRecognizer,
                SpanishNIERecognizer,
                SpanishCIFRecognizer,
                CatalanCIPRecognizer,
                ICD10Recognizer,
                ExpedienteRecognizer,
                ColegiadoRecognizer,
            )

            registry.add_recognizer(SpanishNIFRecognizer())
            registry.add_recognizer(SpanishNIERecognizer())
            registry.add_recognizer(SpanishCIFRecognizer())
            registry.add_recognizer(CatalanCIPRecognizer())
            registry.add_recognizer(ICD10Recognizer())
            registry.add_recognizer(ExpedienteRecognizer())
            registry.add_recognizer(ColegiadoRecognizer())

            self._analyzer = AnalyzerEngine(
                registry=registry,
                nlp_engine=nlp_engine,
                supported_languages=["es", "en"],
            )
            self._anonymizer = AnonymizerEngine()
            logger.info("Local Presidio analyzer initialized with custom recognizers")
        except Exception as e:
            logger.error(f"Failed to initialize local analyzer: {e}")
            self._analyzer = None
            self._anonymizer = None

    async def analyze(
        self,
        text: str,
        language: str = "es",
        entities: Optional[List[str]] = None,
        score_threshold: float = 0.3,
    ) -> List[Dict]:
        if entities is None:
            entities = LEGAL_ENTITIES

        if self._presidio_analyzer_url:
            try:
                return await self._analyze_remote(text, language, entities, score_threshold)
            except Exception as e:
                logger.warning(f"Remote analyzer failed, falling back to local: {e}")

        return await self._analyze_local(text, language, entities, score_threshold)

    async def _analyze_remote(
        self,
        text: str,
        language: str,
        entities: List[str],
        score_threshold: float,
    ) -> List[Dict]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._presidio_analyzer_url}/analyze",
                json={
                    "text": text,
                    "language": language,
                    "entities": entities,
                    "score_threshold": score_threshold,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _analyze_local(
        self,
        text: str,
        language: str,
        entities: List[str],
        score_threshold: float,
    ) -> List[Dict]:
        if not self._analyzer:
            raise RuntimeError("Local analyzer not initialized")

        results = self._analyzer.analyze(
            text=text,
            entities=entities,
            language=language,
            score_threshold=score_threshold,
        )

        return [
            {
                "entity_type": r.entity_type,
                "start": r.start,
                "end": r.end,
                "score": r.score,
                "recognition_metadata": {
                    "recognizer_name": r.recognition_metadata.get("recognizer_name", "")
                    if r.recognition_metadata
                    else "",
                },
            }
            for r in results
        ]

    async def anonymize(
        self,
        text: str,
        analyzer_results: List[Dict],
        operators: Optional[Dict[str, Dict]] = None,
    ) -> str:
        if operators is None:
            operators = {
                "DEFAULT": OperatorConfig("replace", {"new_value": "[REDACTED]"}),
                "PERSON": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 4, "from_end": True}),
                "ES_NIF": OperatorConfig("hash", {"hash_type": "sha256"}),
                "ES_NIE": OperatorConfig("hash", {"hash_type": "sha256"}),
                "CAT_CIP": OperatorConfig("hash", {"hash_type": "sha256"}),
            }

        if self._presidio_anonymizer_url:
            try:
                return await self._anonymize_remote(text, analyzer_results, operators)
            except Exception as e:
                logger.warning(f"Remote anonymizer failed, falling back to local: {e}")

        return await self._anonymize_local(text, analyzer_results, operators)

    async def _anonymize_remote(
        self,
        text: str,
        analyzer_results: List[Dict],
        operators: Dict,
    ) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._presidio_anonymizer_url}/anonymize",
                json={
                    "text": text,
                    "analyzer_results": analyzer_results,
                    "operators": {
                        k: v.to_dict() if hasattr(v, "to_dict") else v
                        for k, v in operators.items()
                    },
                },
            )
            resp.raise_for_status()
            return resp.json()["text"]

    async def _anonymize_local(
        self,
        text: str,
        analyzer_results: List[Dict],
        operators: Dict,
    ) -> str:
        if not self._anonymizer:
            raise RuntimeError("Local anonymizer not initialized")

        from presidio_analyzer import RecognizerResult

        recognizer_results = [
            RecognizerResult(
                entity_type=r["entity_type"],
                start=r["start"],
                end=r["end"],
                score=r["score"],
            )
            for r in analyzer_results
        ]

        result = self._anonymizer.anonymize(
            text=text,
            analyzer_results=recognizer_results,
            operators=operators,
        )
        return result.text

    def map_entities_to_pages(
        self,
        entities: List[Dict],
        pages: List[Dict],
    ) -> List[Dict]:
        mapped = []
        char_offset = 0

        for page in pages:
            page_text = page["text"]
            page_start = char_offset
            page_end = char_offset + len(page_text)

            for entity in entities:
                if entity["start"] >= page_start and entity["end"] <= page_end:
                    rel_start = entity["start"] - page_start
                    rel_end = entity["end"] - page_start

                    bbox = self._find_bbox_in_page(page, rel_start, rel_end)

                    mapped.append({
                        **entity,
                        "page_num": page["page_num"],
                        "bbox": bbox,
                        "page_text_start": rel_start,
                        "page_text_end": rel_end,
                    })

            char_offset = page_end + 2

        return mapped

    def _find_bbox_in_page(self, page: Dict, start: int, end: int) -> List[float]:
        words = page.get("words", [])
        if not words:
            return [0, 0, 0, 0]

        char_pos = 0
        matched_bboxes = []

        for word in words:
            word_text = word["text"]
            word_start = char_pos
            word_end = char_pos + len(word_text)

            if word_end > start and word_start < end:
                matched_bboxes.append(word["bbox"])

            char_pos = word_end + 1

        if not matched_bboxes:
            return [0, 0, 0, 0]

        x0 = min(b[0] for b in matched_bboxes)
        y0 = min(b[1] for b in matched_bboxes)
        x1 = max(b[2] for b in matched_bboxes)
        y1 = max(b[3] for b in matched_bboxes)

        return [x0, y0, x1, y1]


pii_service = PIIService()
