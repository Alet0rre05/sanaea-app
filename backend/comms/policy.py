"""Reglas puras del módulo de comunicaciones."""
from datetime import datetime, timedelta


CHAT_WINDOW_HOURS = 2


def is_chat_open(visit, now: datetime) -> bool:
    """Indica si el chat operativo está habilitado para una visita.

    Esta regla no depende del ORM para que pueda reutilizarse y probarse sin
    inicializar Django. El llamador debe proporcionar el instante actual.
    """
    window = timedelta(hours=CHAT_WINDOW_HOURS)
    return (visit.scheduled_start - window) <= now <= (visit.scheduled_end + window)
