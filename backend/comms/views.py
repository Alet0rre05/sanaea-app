from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from comms import services
from iam.models import TenantRole as R
from iam.permissions import HasTenantRole, IsPlatformStaff
from legal.permissions import LegalAcceptedRequired

PARTICIPANTS = frozenset({R.PROVIDER, R.FAMILY_CLIENT})
STAFF = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR, R.MEDICAL_AUDITOR, R.PROVIDER})


class ProtectedAPIView(APIView):
    permission_classes = [IsAuthenticated, HasTenantRole, LegalAcceptedRequired]


class VisitChatView(ProtectedAPIView):
    allowed_roles = PARTICIPANTS

    def get(self, request, visit_id):
        return Response(services.list_chat(request.membership, visit_id))

    def post(self, request, visit_id):
        body = (request.data.get("body") or "").strip()
        if not body or len(body) > 2000:
            raise ValidationError({"body": ["Mensaje vacío o demasiado largo (máx. 2000)."]})
        message = services.post_chat_message(request.membership, visit_id, body)
        return Response({"id": str(message.id), "created_at": message.created_at},
                        status=status.HTTP_201_CREATED)


class ContextThreadView(ProtectedAPIView):
    allowed_roles = STAFF

    def get(self, request):
        target_type = request.query_params.get("target_type", "")
        target_id = request.query_params.get("target_id", "")
        threads = services.list_threads(request.membership, target_type, target_id)
        return Response([{"id": str(t.id), "title": t.title} for t in threads])

    def post(self, request):
        target_type = request.data.get("target_type", "")
        target_id = request.data.get("target_id", "")
        thread = services.create_thread(request.membership, target_type, target_id,
                                        (request.data.get("title") or "")[:200])
        return Response({"id": str(thread.id), "title": thread.title},
                        status=status.HTTP_201_CREATED)


class ContextCommentView(ProtectedAPIView):
    allowed_roles = STAFF

    def post(self, request, thread_id):
        body = (request.data.get("body") or "").strip()
        if not body or len(body) > 5000:
            raise ValidationError({"body": ["Comentario vacío o demasiado largo (máx. 5000)."]})
        comment = services.add_comment(request.membership, thread_id, body)
        return Response({"id": str(comment.id), "created_at": comment.created_at},
                        status=status.HTTP_201_CREATED)


class SupportMessageView(ProtectedAPIView):
    allowed_roles = STAFF

    def post(self, request):
        body = (request.data.get("body") or "").strip()
        if not body or len(body) > 4000:
            raise ValidationError({"body": ["Mensaje vacío o demasiado largo (máx. 4000)."]})
        names = request.data.get("known_names") or []
        message = services.send_support_message(
            request.membership, body, known_names=[str(n) for n in names][:50],
        )
        return Response({"id": str(message.id), "body": message.body},
                        status=status.HTTP_201_CREATED)


class PlatformSupportInboxView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        rows = services.platform_support_inbox()
        return Response([
            {"id": str(m.id), "tenant_id": str(m.tenant_id), "body": m.body,
             "created_at": m.created_at}
            for m in rows
        ])
