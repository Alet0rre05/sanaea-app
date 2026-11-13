from rest_framework import serializers

from legal.models import LegalDocument, LegalKind


class LegalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalDocument
        fields = ["id", "kind", "version", "title", "body", "content_hash", "published_at"]
        read_only_fields = fields


class PublishLegalDocumentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=LegalKind.choices)
    title = serializers.CharField(max_length=200)
    body = serializers.CharField()


class AcceptDocumentSerializer(serializers.Serializer):
    document_id = serializers.UUIDField()


class WithdrawalSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class InformedConsentSerializer(serializers.Serializer):
    patient_id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    signature_data = serializers.CharField(max_length=500_000)

    def validate_signature_data(self, value):
        if not value.startswith("data:image/png;base64,"):
            raise serializers.ValidationError("La firma debe ser una imagen PNG en data URL.")
        return value
