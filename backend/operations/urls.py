from django.urls import path
from rest_framework.routers import SimpleRouter

from operations import views

router = SimpleRouter(trailing_slash=True)
router.register("tariffs", views.TariffViewSet, basename="tariff")
router.register("health-insurances", views.HealthInsuranceViewSet, basename="health-insurance")
router.register("patients", views.PatientViewSet, basename="patient")
router.register("professionals", views.ProfessionalViewSet, basename="professional")
router.register("family-links", views.FamilyLinkViewSet, basename="family-link")
router.register("visits", views.VisitViewSet, basename="visit")
router.register("evolutions", views.EvolutionViewSet, basename="evolution")
router.register("scans", views.ScanViewSet, basename="scan")
router.register("settlements", views.SettlementViewSet, basename="settlement")

urlpatterns = router.urls + [
    path("simulator/", views.SimulatorView.as_view()),
    path("coverage/", views.CoverageView.as_view()),
    path("holidays/", views.HolidayListView.as_view()),
]
