"""Generación de identificadores UUIDv7 (RFC 9562).

Python 3.13 no incluye `uuid.uuid7()` en la biblioteca estándar (disponible
desde 3.14), por lo que se implementa aquí.

Estructura (128 bits):
    48 bits  timestamp Unix en milisegundos
     4 bits  versión (0b0111)
    12 bits  rand_a
     2 bits  variante (0b10)
    62 bits  rand_b

Los UUIDv7 ordenan cronológicamente, lo que favorece los índices B-tree
de PostgreSQL frente a UUIDv4.
"""
import os
import time
import uuid


def uuid7() -> uuid.UUID:
    unix_ts_ms = time.time_ns() // 1_000_000
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & ((1 << 62) - 1)

    value = (
        (unix_ts_ms & ((1 << 48) - 1)) << 80
        | 0x7 << 76
        | rand_a << 64
        | 0b10 << 62
        | rand_b
    )
    return uuid.UUID(int=value)
