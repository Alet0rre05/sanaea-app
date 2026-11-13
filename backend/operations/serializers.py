from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from iam.models import Membership, TenantRole
from operations.billing import TariffError, calculator_for
from operations.models import (
    DailyEvolution, FamilyLink, Holiday, HealthInsurance, Patient, Professional,
    Settlement, SettlementLine, Tariff, TimesheetScan, Visit,
)


class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = ["id", "name", "billing_method", "valid_from", "valid_to", "hour_value",
                  "visit_value", "holiday_surcharge_percent", "night_surcharge_percent",
                  "night_start", "night_end"]

    def validate(self, attrs):
        instance = Tariff(**{**({} if self.instance is None else
                                {f: getattr(self.instance, f) for f in self.Meta.fields if f != "id"}),
                             **attrs})
        try:
            calculator_for(instance)
        except TariffError as exc:
            raise serializers.ValidationError({"billing_method": [str(exc)]}) from exc
        if instance.valid_to and instance.valid_to < instance.valid_from:
            raise serializers.ValidationError({"valid_to": ["Debe ser posterior a valid_from."]})
        return attrs


class HealthInsuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthInsurance
        fields = ["id", "name", "code", "tariff"]


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ["id", "full_name", "document_number", "address", "health_insurance", "is_active"]


class ProfessionalSerializer(serializers.ModelSerializer):
    membership = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = Professional
        fields = ["id", "membership", "full_name", "license_number", "specialty", "is_active"]

    def validate_membership(self, value):
        if value is None:
            return value
        request = self.context["request"]
        if value.tenant_id != request.membership.tenant_id or value.role != TenantRole.PROVIDER:
            raise serializers.ValidationError("Debe ser un prestador de la agencia activa.")
        return value


class FamilyLinkSerializer(serializers.ModelSerializer):
    family_membership = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.all())

    class Meta:
        model = FamilyLink
        fields = ["id", "patient", "family_membership", "relationship", "verified_at"]
        read_only_fields = ["verified_at"]

    def validate_family_membership(self, value):
        request = self.context["request"]
        if value.tenant_id != request.membership.tenant_id or value.role != TenantRole.FAMILY_CLIENT:
            raise serializers.ValidationError("Debe ser un familiar de la agencia activa.")
        return value


class VisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visit
        fields = ["id", "patient", "professional", "scheduled_start", "scheduled_end",
                  "actual_start", "actual_end", "status"]
        read_only_fields = ["actual_start", "actual_end", "status"]

    def validate(self, attrs):
        start = attrs.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
        end = attrs.get("scheduled_end", getattr(self.instance, "scheduled_end", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"scheduled_end": ["Debe ser posterior al inicio."]})
        return attrs


class VisitCompleteSerializer(serializers.Serializer):
    actual_start = serializers.DateTimeField()
    actual_end = serializers.DateTimeField()


class EvolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyEvolution
        fields = ["id", "visit", "text", "recorded_at"]
        read_only_fields = ["recorded_at"]


class ScanSerializer(serializers.ModelSerializer):
    payload = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = TimesheetScan
        fields = ["id", "visit", "status", "image_phash", "payload", "image_url",
                  "validated_at", "created_at"]
        read_only_fields = fields

    def get_payload(self, obj):
        import json
        return json.loads(obj.extracted_payload or "{}")

    def get_image_url(self, obj):
        # Relativa a la base de la API (el cliente ya antepone /api/v1).
        return f"/scans/{obj.pk}/image/"


class ScanUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()
    visit_id = serializers.UUIDField(required=False, allow_null=True)


class ScanCorrectionsSerializer(serializers.Serializer):
    corrections = serializers.DictField(child=serializers.JSONField(), default=dict)


class SettlementLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SettlementLine
        fields = ["id", "visit", "amount", "breakdown"]


class SettlementSerializer(serializers.ModelSerializer):
    lines = SettlementLineSerializer(many=True, read_only=True)

    class Meta:
        model = Settlement
        fields = ["id", "health_insurance", "period_year", "period_month", "status",
                  "total_amount", "validated_at", "lines"]
        read_only_fields = fields


class SettlementGenerateSerializer(serializers.Serializer):
    health_insurance_id = serializers.UUIDField()
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)


class SimulatorSerializer(serializers.Serializer):
    tariff_id = serializers.UUIDField()
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    is_holiday = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["end"] <= attrs["start"]:
            raise serializers.ValidationError({"end": ["Debe ser posterior al inicio."]})
        return attrs


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name"]


class CoverageQuerySerializer(serializers.Serializer):
    patient_id = serializers.UUIDField()
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)
