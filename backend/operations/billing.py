"""Motor de liquidación con patrón Strategy.

    BaseBillingCalculator (abstracta)
        ├── HourlyBillingStrategy   valor hora + recargos por feriado y nocturnidad
        └── PerVisitBillingStrategy valor fijo por visita

Supuestos de cálculo (documentados en README, "Decisiones abiertas"):
  - Recargo por feriado: se aplica sobre todos los minutos de la visita.
  - Recargo nocturno: se aplica sobre los minutos dentro de la franja nocturna.
  - Ambos recargos son aditivos sobre el valor hora base.
  - Las horas se calculan con precisión de minutos y el resultado se redondea a centavos.

Este módulo es puro (sin ORM): se puede probar sin base de datos.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
HUNDRED = Decimal("100")
SIXTY = Decimal("60")


class TariffError(ValueError):
    """El tarifario no tiene los datos necesarios para el método de cálculo."""


def q(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class VisitInput:
    start: datetime
    end: datetime
    is_holiday: bool = False


@dataclass(frozen=True)
class CalculationResult:
    amount: Decimal
    breakdown: dict = field(default_factory=dict)


def _in_night_window(moment: time, start: time, end: time) -> bool:
    if start <= end:
        return start <= moment < end
    return moment >= start or moment < end  # la franja cruza medianoche


def count_night_minutes(start: datetime, end: datetime, night_start: time, night_end: time) -> int:
    if end <= start:
        return 0
    total = 0
    cursor = start
    while cursor < end:
        if _in_night_window(cursor.time(), night_start, night_end):
            total += 1
        cursor += timedelta(minutes=1)
    return total


class BaseBillingCalculator(ABC):
    def __init__(self, tariff):
        self.tariff = tariff
        self.validate()

    @abstractmethod
    def validate(self) -> None:
        """Verifica que el tarifario tenga los valores necesarios."""

    @abstractmethod
    def calculate(self, visit: VisitInput) -> CalculationResult:
        """Calcula el monto de una visita."""

    def calculate_many(self, visits: list[VisitInput]) -> tuple[list[CalculationResult], Decimal]:
        results = [self.calculate(v) for v in visits]
        total = q(sum((r.amount for r in results), Decimal("0")))
        return results, total


class HourlyBillingStrategy(BaseBillingCalculator):
    def validate(self) -> None:
        if self.tariff.hour_value is None or self.tariff.hour_value < 0:
            raise TariffError("El tarifario por hora requiere un valor hora válido.")
        has_night_window = self.tariff.night_start is not None and self.tariff.night_end is not None
        has_night_surcharge = self.tariff.night_surcharge_percent is not None
        if has_night_surcharge and not has_night_window:
            raise TariffError("El recargo nocturno requiere franja horaria de inicio y fin.")

    def calculate(self, visit: VisitInput) -> CalculationResult:
        minutes = Decimal(int((visit.end - visit.start).total_seconds() // 60))
        if minutes <= 0:
            raise TariffError("La visita debe tener duración positiva.")

        hour_value = Decimal(self.tariff.hour_value)
        base = hour_value * minutes / SIXTY

        holiday_extra = Decimal("0")
        if visit.is_holiday and self.tariff.holiday_surcharge_percent is not None:
            holiday_extra = base * Decimal(self.tariff.holiday_surcharge_percent) / HUNDRED

        night_minutes = 0
        night_extra = Decimal("0")
        if (self.tariff.night_surcharge_percent is not None
                and self.tariff.night_start is not None and self.tariff.night_end is not None):
            night_minutes = count_night_minutes(
                visit.start, visit.end, self.tariff.night_start, self.tariff.night_end
            )
            night_extra = (hour_value * Decimal(night_minutes) / SIXTY
                           * Decimal(self.tariff.night_surcharge_percent) / HUNDRED)

        amount = q(base + holiday_extra + night_extra)
        return CalculationResult(
            amount=amount,
            breakdown={
                "method": "HOURLY",
                "minutes": int(minutes),
                "base": str(q(base)),
                "holiday_surcharge": str(q(holiday_extra)),
                "night_minutes": night_minutes,
                "night_surcharge": str(q(night_extra)),
            },
        )


class PerVisitBillingStrategy(BaseBillingCalculator):
    def validate(self) -> None:
        if self.tariff.visit_value is None or self.tariff.visit_value < 0:
            raise TariffError("El tarifario por visita requiere un valor fijo válido.")

    def calculate(self, visit: VisitInput) -> CalculationResult:
        return CalculationResult(
            amount=q(Decimal(self.tariff.visit_value)),
            breakdown={"method": "PER_VISIT", "visit": str(q(Decimal(self.tariff.visit_value)))},
        )


# Registro de estrategias: agregar un método nuevo no modifica el código existente (OCP).
STRATEGIES = {
    "HOURLY": HourlyBillingStrategy,
    "PER_VISIT": PerVisitBillingStrategy,
}


def calculator_for(tariff) -> BaseBillingCalculator:
    strategy = STRATEGIES.get(tariff.billing_method)
    if strategy is None:
        raise TariffError(f"Método de cobro no soportado: {tariff.billing_method}")
    return strategy(tariff)
