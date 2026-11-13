"""Pruebas del motor de liquidación. No requieren base de datos."""
from datetime import datetime, time
from decimal import Decimal
from types import SimpleNamespace
from unittest import TestCase

from operations.billing import (
    HourlyBillingStrategy, PerVisitBillingStrategy, TariffError, VisitInput,
    calculator_for, count_night_minutes,
)


def tariff(**overrides):
    base = dict(
        billing_method="HOURLY", hour_value=Decimal("1000.00"), visit_value=None,
        holiday_surcharge_percent=None, night_surcharge_percent=None,
        night_start=None, night_end=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class HourlyBillingTests(TestCase):
    def test_base_amount_proportional_to_minutes(self):
        calc = HourlyBillingStrategy(tariff())
        result = calc.calculate(VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 10, 30)))
        self.assertEqual(result.amount, Decimal("2500.00"))
        self.assertEqual(result.breakdown["minutes"], 150)

    def test_holiday_surcharge_applies_to_all_minutes(self):
        calc = HourlyBillingStrategy(tariff(holiday_surcharge_percent=Decimal("50")))
        result = calc.calculate(VisitInput(datetime(2026, 12, 25, 8), datetime(2026, 12, 25, 10),
                                           is_holiday=True))
        # base 2000 + 50% de 2000 = 3000
        self.assertEqual(result.amount, Decimal("3000.00"))

    def test_holiday_surcharge_ignored_on_normal_day(self):
        calc = HourlyBillingStrategy(tariff(holiday_surcharge_percent=Decimal("50")))
        result = calc.calculate(VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 10)))
        self.assertEqual(result.amount, Decimal("2000.00"))

    def test_night_surcharge_only_on_night_minutes(self):
        calc = HourlyBillingStrategy(tariff(
            night_surcharge_percent=Decimal("100"),
            night_start=time(21, 0), night_end=time(6, 0),
        ))
        # 20:00 a 22:00: 60 minutos nocturnos (21:00-22:00)
        result = calc.calculate(VisitInput(datetime(2026, 11, 10, 20), datetime(2026, 11, 10, 22)))
        self.assertEqual(result.breakdown["night_minutes"], 60)
        # base 2000 + nocturno: 1000 horas * 100% = 1000
        self.assertEqual(result.amount, Decimal("3000.00"))

    def test_night_window_crossing_midnight(self):
        minutes = count_night_minutes(datetime(2026, 11, 10, 23), datetime(2026, 11, 11, 7),
                                      time(21, 0), time(6, 0))
        self.assertEqual(minutes, 7 * 60)  # 23:00 a 06:00 son 7 h nocturnas; 06:00-07:00 no lo son

    def test_hourly_requires_hour_value(self):
        with self.assertRaises(TariffError):
            HourlyBillingStrategy(tariff(hour_value=None))

    def test_night_surcharge_requires_window(self):
        with self.assertRaises(TariffError):
            HourlyBillingStrategy(tariff(night_surcharge_percent=Decimal("10")))

    def test_rounding_to_cents(self):
        calc = HourlyBillingStrategy(tariff(hour_value=Decimal("100")))
        result = calc.calculate(VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 8, 20)))
        self.assertEqual(result.amount, Decimal("33.33"))

    def test_zero_duration_rejected(self):
        calc = HourlyBillingStrategy(tariff())
        with self.assertRaises(TariffError):
            calc.calculate(VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 8)))


class PerVisitBillingTests(TestCase):
    def test_fixed_value_per_visit(self):
        calc = PerVisitBillingStrategy(tariff(billing_method="PER_VISIT",
                                              hour_value=None, visit_value=Decimal("4500.5")))
        result = calc.calculate(VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 9)))
        self.assertEqual(result.amount, Decimal("4500.50"))

    def test_requires_visit_value(self):
        with self.assertRaises(TariffError):
            PerVisitBillingStrategy(tariff(billing_method="PER_VISIT", visit_value=None))


class RegistryTests(TestCase):
    def test_factory_selects_strategy(self):
        self.assertIsInstance(calculator_for(tariff()), HourlyBillingStrategy)
        per = tariff(billing_method="PER_VISIT", hour_value=None, visit_value=Decimal("1"))
        self.assertIsInstance(calculator_for(per), PerVisitBillingStrategy)

    def test_unknown_method_rejected(self):
        with self.assertRaises(TariffError):
            calculator_for(tariff(billing_method="MONTHLY"))

    def test_calculate_many_totals(self):
        calc = HourlyBillingStrategy(tariff())
        visits = [VisitInput(datetime(2026, 11, 10, 8), datetime(2026, 11, 10, 9)),
                  VisitInput(datetime(2026, 11, 11, 8), datetime(2026, 11, 11, 8, 30))]
        _, total = calc.calculate_many(visits)
        self.assertEqual(total, Decimal("1500.00"))
