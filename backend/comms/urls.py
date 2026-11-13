from django.urls import path

from comms import views

urlpatterns = [
    path("visits/<uuid:visit_id>/chat/", views.VisitChatView.as_view()),
    path("context-threads/", views.ContextThreadView.as_view()),
    path("context-threads/<uuid:thread_id>/comments/", views.ContextCommentView.as_view()),
    path("support/messages/", views.SupportMessageView.as_view()),
    path("platform/support/inbox/", views.PlatformSupportInboxView.as_view()),
]
