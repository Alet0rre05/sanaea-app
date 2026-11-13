from django.urls import path

from legal import views

urlpatterns = [
    path("legal/documents/", views.LatestDocumentsView.as_view()),
    path("legal/documents/publish/", views.PublishDocumentView.as_view()),
    path("legal/pending/", views.PendingDocumentsView.as_view()),
    path("legal/accept/", views.AcceptDocumentView.as_view()),
    path("legal/withdrawal/", views.WithdrawalView.as_view()),
    path("legal/informed-consent/", views.InformedConsentView.as_view()),
]
