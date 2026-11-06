"""Custom Presidio recognizers for Spanish legal/medical documents."""
import re
from typing import List, Optional
from presidio_analyzer import Pattern, PatternRecognizer


# Spanish DNI (8 digits + letter)
class SpanishNIFRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "ES_NIF",
            r"\b([0-9]{8})([A-HJ-NP-TV-Z])\b",
            0.95,
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="ES_NIF",
            patterns=self.PATTERNS,
            supported_language="es",
        )

    def validate_result(self, pattern_text: str) -> bool:
        letras = "TRWAGMYFPDXBNJZSQVHLCKE"
        if len(pattern_text) != 9:
            return False
        try:
            numero = int(pattern_text[:8])
            letra = pattern_text[8].upper()
            return letras[numero % 23] == letra
        except ValueError:
            return False


# Spanish NIE (X/Y/Z + 7 digits + letter)
class SpanishNIERecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "ES_NIE",
            r"\b([XYZ])([0-9]{7})([A-HJ-NP-TV-Z])\b",
            0.95,
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="ES_NIE",
            patterns=self.PATTERNS,
            supported_language="es",
        )

    def validate_result(self, pattern_text: str) -> bool:
        if len(pattern_text) != 9:
            return False
        mapa = {"X": "0", "Y": "1", "Z": "2"}
        if pattern_text[0] not in mapa:
            return False
        dni_num = mapa[pattern_text[0]] + pattern_text[1:8]
        return SpanishNIFRecognizer().validate_result(dni_num + pattern_text[8])


# Spanish CIF (Letter + 7 digits + check)
class SpanishCIFRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "ES_CIF",
            r"\b([A-HJ-NP-SUVW])([0-9]{7})([0-9A-J])\b",
            0.9,
        ),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="ES_CIF",
            patterns=self.PATTERNS,
            supported_language="es",
        )

    def validate_result(self, pattern_text: str) -> bool:
        if len(pattern_text) != 9:
            return False
        # CIF validation algorithm
        letra = pattern_text[0]
        numeros = pattern_text[1:8]
        control = pattern_text[8]

        try:
            pares = sum(int(numeros[i]) for i in range(1, 7, 2))
            impares = 0
            for i in range(0, 7, 2):
                doble = int(numeros[i]) * 2
                impares += doble if doble < 10 else doble - 9
            total = pares + impares
            digito_control = (10 - (total % 10)) % 10
            letra_control = "JABCDEFGHI"[digito_control]

            if letra in "KLM":
                return control.isalpha() and control.upper() == letra_control
            else:
                return control.isdigit() and int(control) == digito_control
        except (ValueError, IndexError):
            return False


# Catalan Health Card (CIP) - 10 digits
class CatalanCIPRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "CAT_CIP",
            r"\b([0-9]{10})\b",
            0.6,  # Lower score due to potential false positives
        ),
    ]

    CONTEXT = ["cip", "tarjeta", "sanitària", "sanitaria", "salut", "cat", "seguretat social"]

    def __init__(self):
        super().__init__(
            supported_entity="CAT_CIP",
            patterns=self.PATTERNS,
            supported_language="es",
            context=self.CONTEXT,
        )


# ICD-10 Medical Diagnosis Codes
class ICD10Recognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "ICD10",
            r"\b([A-TV-Z][0-9]{2}(?:\.[0-9]{1,4})?)\b",
            0.9,
        ),
    ]

    CONTEXT = ["diagnóstico", "diagnostico", "cie", "cie-10", "enfermedad", "patología"]

    def __init__(self):
        super().__init__(
            supported_entity="ICD10",
            patterns=self.PATTERNS,
            supported_language="es",
            context=self.CONTEXT,
        )


# Expediente number (EXP-YYYY-NNNN or similar)
class ExpedienteRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "EXPEDIENTE",
            r"\b(?:EXP|EXPTE|EXPEDIENTE)[-/ ][0-9]{4}[-/ ][0-9]{4,}\b",
            0.85,
        ),
    ]

    CONTEXT = ["expediente", "expedient", "número de expediente", "num. expediente"]

    def __init__(self):
        super().__init__(
            supported_entity="EXPEDIENTE",
            patterns=self.PATTERNS,
            supported_language="es",
            context=self.CONTEXT,
        )


# Professional license number (Colegiado)
class ColegiadoRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern(
            "COLEGIADO",
            r"\b(?:COL|COLEGIADO|Nº COLEGIADO)[-/ ][0-9]{4,}\b",
            0.85,
        ),
    ]

    CONTEXT = ["colegiado", "número de colegiado", "nº colegiado", "colegiats"]

    def __init__(self):
        super().__init__(
            supported_entity="COLEGIADO",
            patterns=self.PATTERNS,
            supported_language="es",
            context=self.CONTEXT,
        )
