from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from iam.permissions import HasTenantRole, IsPlatformSuperadmin
from iam.models import TenantRole
from legal import services
from legal.models import LegalDocument
from legal.serializers import (
    AcceptDocumentSerializer, InformedConsentSerializer, LegalDocumentSerializer,
    PublishLegalDocumentSerializer, WithdrawalSerializer,
)
from iam.turnstile import client_ip
from legal.permissions import LegalAcceptedRequired  # noqa: F401 (disponible para otras apps)


class LatestDocumentsView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LegalDocumentSerializer

    def get_queryset(self):
        return services.latest_documents()

    def list(self, request, *args, **kwargs):
        return Response(LegalDocumentSerializer(self.get_queryset(), many=True).data)


class PublishDocumentView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformSuperadmin]

    def post(self, request):
        serializer = PublishLegalDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = services.publish_document(**serializer.validated_data)
        return Response(LegalDocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class PendingDocumentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending = services.pending_documents(request.user)
        return Response(LegalDocumentSerializer(pending, many=True).data)


class AcceptDocumentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AcceptDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log = services.accept_document(request.user, serializer.validated_data["document_id"],
                                       client_ip(request))
        return Response({"accepted_at": log.accepted_at, "document_hash": log.document_hash},
                        status=status.HTTP_201_CREATED)


class WithdrawalView(APIView):
    """Arrepentimiento / baja de la agencia activa. Solo TENANT_OWNER."""

    permission_classes = [IsAuthenticated, HasTenantRole]
    allowed_roles = frozenset({TenantRole.OWNER})

    def post(self, request):
        serializer = WithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.withdraw_tenant(request.membership, serializer.validated_data.get("reason", ""),
                                 client_ip(request))
        return Response({"detail": "Solicitud de baja registrada. La agencia quedó desactivada."},
                        status=status.HTTP_201_CREATED)


class InformedConsentView(APIView):
    """Firma en pantalla del familiar vinculado al paciente."""

    permission_classes = [IsAuthenticated, HasTenantRole]
    allowed_roles = frozenset({TenantRole.FAMILY_CLIENT})

    def post(self, request):
        serializer = InformedConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        consent = services.sign_informed_consent(
            request.membership, data["patient_id"], data["document_id"],
            data["signature_data"], client_ip(request),
        )
        return Response({"id": consent.id, "signed_at": consent.signed_at},
                        status=status.HTTP_201_CREATED)
