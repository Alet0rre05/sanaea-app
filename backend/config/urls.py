"""Enrutamiento raíz del proyecto. La API vive bajo /api/v1/."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Health check para Render. No consulta la base para no acoplar el despliegue a Neon."""
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("healthz/", healthz),
    path("admin/", admin.site.urls),
    path("api/v1/", include("iam.urls")),
    path("api/v1/", include("legal.urls")),
    path("api/v1/", include("operations.urls")),
    path("api/v1/", include("comms.urls")),
]
