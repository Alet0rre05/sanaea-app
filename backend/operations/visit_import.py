"""Importación de visitas desde CSV o XLSX.

Encabezados en la primera fila (sin distinguir mayúsculas, acentos ni espacios):
    paciente_id, prestador_id, inicio, fin

- paciente_id / prestador_id: UUID de la ficha dentro de la agencia activa.
- inicio / fin: "AAAA-MM-DD HH:MM" o "DD/MM/AAAA HH:MM", en hora de Buenos Aires.
  En XLSX también se aceptan celdas de fecha y hora.

Flujo: la misma petición valida el archivo y devuelve la vista previa. Con
commit=true crea las visitas solo si TODAS las filas son válidas (todo o nada).
"""
import csv
import io
import unicodedata
import uuid
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from operations.models import Patient, Professional, Visit, VisitStatus

MAX_ROWS = 2000
MAX_BYTES = 5 * 1024 * 1024
REQUIRED = ("paciente_id", "prestador_id", "inicio", "fin")
DATETIME_FORMATS = ("%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%dT%H:%M")
PREVIEW_LIMIT = 20


class ImportFormatError(ValueError):
    """El archivo no se puede leer o le faltan columnas."""


def _normalize(header) -> str:
    text = unicodedata.normalize("NFKD", str(header or "")).encode("ascii", "ignore").decode()
    return text.strip().lower().replace(" ", "_")


def _read_table(uploaded_file) -> tuple[list[str], list[list]]:
    """Devuelve (encabezados normalizados, filas sin vacías)."""
    if uploaded_file.size > MAX_BYTES:
        raise ImportFormatError("El archivo supera 5 MB.")
    name = (uploaded_file.name or "").lower()
    data = uploaded_file.read()

    if name.endswith(".xlsx"):
        from openpyxl import load_workbook  # import diferido: solo si se usa XLSX

        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        raw = [list(r) for r in workbook.worksheets[0].iter_rows(values_only=True)]
    elif name.endswith(".csv"):
        text = data.decode("utf-8-sig", errors="replace")
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;")
        except csv.Error:
            dialect = csv.excel
        raw = list(csv.reader(io.StringIO(text), dialect))
    else:
        raise ImportFormatError("Formato no admitido. Subí un archivo .csv o .xlsx.")

    if not raw:
        raise ImportFormatError("El archivo está vacío.")
    headers = [_normalize(h) for h in raw[0]]
    missing = [column for column in REQUIRED if column not in headers]
    if missing:
        raise ImportFormatError(f"Faltan columnas: {', '.join(missing)}.")
    rows = [r for r in raw[1:] if any(str(v).strip() not in ("", "None") for v in r if v is not None)]
    if len(rows) > MAX_ROWS:
        raise ImportFormatError(f"Máximo {MAX_ROWS} filas por archivo.")
    return headers, rows


def _parse_uuid(value, label: str, row: int, errors: list[dict]):
    try:
        return uuid.UUID(str(value).strip())
    except (ValueError, AttributeError, TypeError):
        errors.append({"row": row, "message": f"{label} no es un UUID válido."})
        return None


def _parse_datetime(value, label: str, row: int, errors: list[dict]):
    tz = timezone.get_current_timezone()
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value or "").strip()
        dt = None
        for fmt in DATETIME_FORMATS:
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            errors.append({"row": row, "message": f"{label}: usá AAAA-MM-DD HH:MM."})
            return None
    return timezone.make_aware(dt, tz) if timezone.is_naive(dt) else dt


def build_report(membership, uploaded_file) -> tuple[dict, list[dict]]:
    """Valida el archivo. Devuelve (reporte para la API, filas válidas listas para crear)."""
    headers, rows = _read_table(uploaded_file)
    index = {column: headers.index(column) for column in REQUIRED}
    errors: list[dict] = []
    items: list[dict] = []

    for offset, row in enumerate(rows):
        number = offset + 2  # la fila 1 es el encabezado
        cell = lambda column: row[index[column]] if index[column] < len(row) else None  # noqa: E731
        patient_id = _parse_uuid(cell("paciente_id"), "paciente_id", number, errors)
        professional_id = _parse_uuid(cell("prestador_id"), "prestador_id", number, errors)
        start = _parse_datetime(cell("inicio"), "inicio", number, errors)
        end = _parse_datetime(cell("fin"), "fin", number, errors)
        if None in (patient_id, professional_id, start, end):
            continue
        if end <= start:
            errors.append({"row": number, "message": "fin debe ser posterior a inicio."})
            continue
        items.append({"row": number, "patient_id": patient_id, "professional_id": professional_id,
                      "start": start, "end": end})

    # Existencia dentro de la agencia activa (los managers filtran por tenant).
    patient_ids = {i["patient_id"] for i in items}
    professional_ids = {i["professional_id"] for i in items}
    known_patients = set(Patient.objects.filter(pk__in=patient_ids).values_list("pk", flat=True))
    known_professionals = set(Professional.objects.filter(pk__in=professional_ids).values_list("pk", flat=True))

    seen: set[tuple] = set()
    accepted: dict = {}  # prestador -> intervalos aceptados en este mismo archivo
    valid: list[dict] = []
    for item in items:
        if item["patient_id"] not in known_patients:
            errors.append({"row": item["row"], "message": "El paciente no existe en esta agencia."})
            continue
        if item["professional_id"] not in known_professionals:
            errors.append({"row": item["row"], "message": "El prestador no existe en esta agencia."})
            continue
        key = (item["patient_id"], item["professional_id"], item["start"])
        if key in seen:
            errors.append({"row": item["row"], "message": "Fila repetida dentro del archivo."})
            continue
        seen.add(key)
        if Visit.objects.filter(patient_id=key[0], professional_id=key[1], scheduled_start=key[2]).exists():
            errors.append({"row": item["row"], "message": "Ya existe una visita con esos datos."})
            continue
        overlaps_db = Visit.objects.filter(
            professional_id=item["professional_id"],
            scheduled_start__lt=item["end"], scheduled_end__gt=item["start"],
        ).exclude(status=VisitStatus.MISSED).exists()
        if overlaps_db:
            errors.append({"row": item["row"], "message": "El prestador ya tiene una visita en ese horario."})
            continue
        intervals = accepted.setdefault(item["professional_id"], [])
        if any(item["start"] < end and item["end"] > start for start, end in intervals):
            errors.append({"row": item["row"], "message": "Se superpone con otra fila del archivo para el mismo prestador."})
            continue
        intervals.append((item["start"], item["end"]))
        valid.append(item)

    errors.sort(key=lambda e: e["row"])
    report = {
        "total": len(rows),
        "valid": len(valid),
        "errors": errors,
        "preview": [
            {"row": i["row"], "paciente_id": str(i["patient_id"]), "prestador_id": str(i["professional_id"]),
             "inicio": timezone.localtime(i["start"]).strftime("%d/%m/%Y %H:%M"),
             "fin": timezone.localtime(i["end"]).strftime("%d/%m/%Y %H:%M")}
            for i in valid[:PREVIEW_LIMIT]
        ],
    }
    return report, valid


def create_visits(membership, items: list[dict]) -> int:
    """Crea las visitas en una transacción. Usa save() para que TenantAwareModel asigne la agencia."""
    with transaction.atomic():
        for item in items:
            visit = Visit(
                patient_id=item["patient_id"],
                professional_id=item["professional_id"],
                scheduled_start=item["start"],
                scheduled_end=item["end"],
                created_by=membership.user_id,
            )
            visit.save()
    return len(items)
