from django.urls import path

from iam import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/verify-registration/", views.VerifyRegistrationView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", views.RefreshView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/password/check/", views.PasswordCheckView.as_view()),
    path("auth/password/reset/request/", views.PasswordResetRequestView.as_view()),
    path("auth/password/reset/confirm/", views.PasswordResetConfirmView.as_view()),
    path("me/", views.MeView.as_view()),
    path("me/change/request/", views.SensitiveChangeRequestView.as_view()),
    path("me/change/confirm/", views.SensitiveChangeConfirmView.as_view()),
    path("tenants/", views.TenantListView.as_view()),
    path("platform/tenants/", views.PlatformTenantCreateView.as_view()),
    path("tenants/<uuid:tenant_id>/memberships/", views.TenantMembershipsView.as_view()),
]
