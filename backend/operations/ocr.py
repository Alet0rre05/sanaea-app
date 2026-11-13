"""Extracción de datos de planillas (OCR) mediante una interfaz intercambiable.

El documento maestro describe el flujo (subida de foto, edición en split-screen)
pero NO define el motor de OCR. Por eso el motor es configurable vía
`settings.OCR_EXTRACTOR` (ruta de importación). Por defecto se usa
`NullOCRExtractor`, que no extrae nada: la carga se completa manualmente.

Para incorporar un motor, implementar `OCRExtractor.extract` y configurar
OCR_EXTRACTOR con su ruta completa.
"""
from abc import ABC, abstractmethod

from django.conf import settings
from django.utils.module_loading import import_string


class OCRExtractor(ABC):
    @abstractmethod
    def extract(self, image_path: str) -> dict:
        """Devuelve un dict con los campos detectados en la planilla."""


class NullOCRExtractor(OCRExtractor):
    def extract(self, image_path: str) -> dict:
        return {}


def get_extractor() -> OCRExtractor:
    return import_string(settings.OCR_EXTRACTOR)()
