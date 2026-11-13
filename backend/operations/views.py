"""ViewSets del dominio de salud.

Control de acceso en tres niveles:
  1. HasTenantRole: el rol de la agencia activa debe estar en `allowed_roles`.
  2. Escritura: los métodos no seguros requieren `write_roles`, salvo las acciones
     de autoservicio declaradas en `self_service_actions` (la lógica valida el alcance).
  3. Alcance de datos: `get_queryset` aplica `operations.scoping`.
"""
from datetime import datetime

from django.http import FileResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from iam.models import TenantRole as R
from iam.permissions import AGENCY_ADMIN, BILLING, HasTenantRole, MEDICAL_HISTORY, PATIENTS, SCANS, VISIT_SUMMARY
from legal.permissions import LegalAcceptedRequired
from operations import scoping, services
from operations.models import (
    FamilyLink, Holiday, HealthInsurance, Patient, Professional, Settlement, Tariff,
    TimesheetScan, Visit, DailyEvolution,
)
from operations.serializers import (
    CoverageQuerySerializer, EvolutionSerializer, FamilyLinkSerializer, HealthInsuranceSerializer,
    HolidaySerializer, PatientSerializer, ProfessionalSerializer, ScanCorrectionsSerializer,
    ScanSerializer, ScanUploadSerializer, SettlementGenerateSerializer, SettlementSerializer,
    SimulatorSerializer, TariffSerializer, VisitCompleteSerializer, VisitSerializer,
)


class OperationsViewSetMixin:
    permission_classes = [IsAuthenticated, HasTenantRole, LegalAcceptedRequired]
    allowed_roles = frozenset()
    write_roles = AGENCY_ADMIN
    self_service_actions = frozenset()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in SAFE_METHODS:
            return
        if getattr(self, "action", None) in self.self_service_actions:
            return
        if request.membership.role not in self.write_roles:
            raise PermissionDenied("Tu rol no permite modificar este recurso.")

    def perform_destroy(self, instance):
        # Soft delete: nunca se borran datos de salud físicamente.
        instance.soft_delete()


class TariffViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = BILLING
    write_roles = AGENCY_ADMIN
    serializer_class = TariffSerializer

    def get_queryset(self):
        return Tariff.objects.all()


class HealthInsuranceViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = BILLING
    write_roles = AGENCY_ADMIN
    serializer_class = HealthInsuranceSerializer

    def get_queryset(self):
        return HealthInsurance.objects.all()


class PatientViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = PATIENTS
    write_roles = AGENCY_ADMIN
    serializer_class = PatientSerializer

    def get_queryset(self):
        return scoping.visible_patients(self.request.membership)


class ProfessionalViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = VISIT_SUMMARY
    write_roles = AGENCY_ADMIN
    serializer_class = ProfessionalSerializer

    def get_queryset(self):
        qs = Professional.objects.all()
        if self.request.membership.role == R.PROVIDER:
            qs = qs.filter(membership=self.request.membership)
        return qs

    @action(detail=True, methods=["post"], url_path="verify-license")
    def verify_license(self, request, pk=None):
        professional = self.get_object()
        if professional.membership_id is None:
            raise NotFound("El prestador no tiene usuario vinculado.")
        services.verify_license(request.membership, professional.membership_id)
        return Response({"detail": "Matrícula verificada."})


class FamilyLinkViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = AGENCY_ADMIN | frozenset({R.FAMILY_CLIENT})
    write_roles = AGENCY_ADMIN
    self_service_actions = frozenset({"request_code", "verify"})
    serializer_class = FamilyLinkSerializer

    def get_queryset(self):
        membership = self.request.membership
        if membership.role == R.FAMILY_CLIENT:
            return FamilyLink.objects.filter(family_membership=membership)
        return FamilyLink.objects.all()

    @action(detail=True, methods=["post"], url_path="request-code")
    def request_code(self, request, pk=None):
        if request.membership.role != R.FAMILY_CLIENT:
            raise PermissionDenied("Solo el familiar puede verificar su vínculo.")
        services.request_family_link_code(request.membership, pk)
        return Response({"detail": "Código enviado a tu correo."}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        if request.membership.role != R.FAMILY_CLIENT:
            raise PermissionDenied("Solo el familiar puede verificar su vínculo.")
        code = request.data.get("code", "")
        link = services.verify_family_link(request.membership, pk, code)
        return Response(FamilyLinkSerializer(link, context={"request": request}).data)


class VisitViewSet(OperationsViewSetMixin, viewsets.ModelViewSet):
    allowed_roles = VISIT_SUMMARY
    write_roles = AGENCY_ADMIN
    self_service_actions = frozenset({"complete"})
    serializer_class = VisitSerializer

    def get_queryset(self):
        return scoping.visible_visits(self.request.membership)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        if request.membership.role not in {R.OWNER, R.ADMIN, R.PROVIDER}:
            raise PermissionDenied("Tu rol no puede registrar visitas.")
        serializer = VisitCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        visit = self.get_object()  # ya filtrada por alcance del rol
        services.complete_visit(request.membership, visit,
                                serializer.validated_data["actual_start"],
                                serializer.validated_data["actual_end"])
        return Response(VisitSerializer(visit, context={"request": request}).data)


class EvolutionViewSet(OperationsViewSetMixin, viewsets.GenericViewSet,
                       mixins.ListModelMixin, mixins.RetrieveModelMixin,
                       mixins.CreateModelMixin):
    allowed_roles = MEDICAL_HISTORY
    write_roles = frozenset({R.PROVIDER})
    serializer_class = EvolutionSerializer

    def get_queryset(self):
        return scoping.visible_evolutions(self.request.membership)

    def perform_create(self, serializer):
        serializer.instance = services.create_evolution(
            self.request.membership,
            serializer.validated_data["visit"].pk,
            serializer.validated_data["text"],
        )


class ScanViewSet(OperationsViewSetMixin, viewsets.GenericViewSet,
                  mixins.ListModelMixin, mixins.RetrieveModelMixin):
    allowed_roles = SCANS
    write_roles = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR, R.PROVIDER})
    serializer_class = ScanSerializer

    def get_queryset(self):
        return scoping.visible_scans(self.request.membership)

    def create(self, request):
        serializer = ScanUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = services.ingest_scan(
            request.membership, serializer.validated_data["image"],
            visit_id=serializer.validated_data.get("visit_id"),
        )
        return Response(ScanSerializer(scan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        scan = self.get_object()
        serializer = ScanCorrectionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.validate_scan(request.membership, scan, serializer.validated_data["corrections"])
        return Response(ScanSerializer(scan).data)

    @action(detail=True, methods=["get"])
    def image(self, request, pk=None):
        scan = self.get_object()
        return FileResponse(scan.image.open("rb"), content_type="image/jpeg")


class SettlementViewSet(OperationsViewSetMixin, viewsets.GenericViewSet,
                        mixins.ListModelMixin, mixins.RetrieveModelMixin):
    allowed_roles = BILLING
    write_roles = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR})
    serializer_class = SettlementSerializer

    def get_queryset(self):
        return Settlement.objects.prefetch_related("lines").all()

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = SettlementGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        settlement = services.generate_settlement(
            request.membership, data["health_insurance_id"], data["year"], data["month"],
        )
        return Response(SettlementSerializer(settlement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        settlement = self.get_object()
        services.validate_settlement(settlement)
        return Response(SettlementSerializer(settlement).data)


class SimulatorView(APIView):
    permission_classes = [IsAuthenticated, HasTenantRole, LegalAcceptedRequired]
    allowed_roles = BILLING

    def post(self, request):
        serializer = SimulatorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tariff = Tariff.objects.filter(pk=data["tariff_id"]).first()
        if tariff is None:
            raise NotFound("Tarifario no encontrado.")
        return Response(services.simulate_visit(
            tariff, data["start"], data["end"], data["is_holiday"]))


class CoverageView(APIView):
    permission_classes = [IsAuthenticated, HasTenantRole, LegalAcceptedRequired]
    allowed_roles = VISIT_SUMMARY

    def get(self, request):
        serializer = CoverageQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        patient = scoping.visible_patients(request.membership).filter(
            pk=data["patient_id"]).first()
        if patient is None:
            raise NotFound("Paciente no encontrado.")
        return Response(services.coverage_calendar(patient, data["year"], data["month"]))


class HolidayListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = HolidaySerializer
    queryset = Holiday.objects.all()
