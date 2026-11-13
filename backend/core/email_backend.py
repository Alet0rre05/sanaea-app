import json
import logging
import urllib.error
import urllib.request
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ResendAPIBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        sent = 0
        for msg in email_messages:
            payload = json.dumps({
                "from": msg.from_email or settings.DEFAULT_FROM_EMAIL,
                "to": list(msg.to),
                "subject": msg.subject,
                "text": msg.body,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {settings.EMAIL_HOST_PASSWORD}",
                    "Content-Type": "application/json",
                    "User-Agent": "Sanae-Backend/1.0",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if 200 <= resp.status < 300:
                        sent += 1
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                logger.error("Resend API error %s: %s", exc.code, detail)
                raise
        return sent
