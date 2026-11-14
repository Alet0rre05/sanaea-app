"""Crea o actualiza un superadmin de plataforma desde variables de entorno.

Uso (Render Shell del servicio de API, una sola vez):

    SANAE_ADMIN_EMAIL=tu@correo.com SANAE_ADMIN_PASSWORD='clave-segura' \
    SANAE_ADMIN_TENANT=slug-de-la-agencia \
    python manage.py bootstrap_superadmin

Variables:
- SANAE_ADMIN_EMAIL (obligatoria): email del superadmin.
- SANAE_ADMIN_PASSWORD (opcional): se asigna solo si el usuario no existe o si
  se pasa --reset-password. Sin esta variable no se toca la contraseña.
- SANAE_ADMIN_TENANT (opcional): slug de una agencia. Si se indica, también se
  crea la membresía de propietario en esa agencia (necesaria para ver Planillas
  y las fichas dentro de una agencia).

El comando no envía OTP: deja la cuenta activa directamente. Por eso conviene
ejecutarlo a mano y quitar la contraseña de las variables de entorno después.
"""
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Tenant
from iam.models import CustomUser, Membership, PlatformRole, TenantRole


class Command(BaseCommand):
    help = "Crea o actualiza un superadmin de plataforma desde SANAE_ADMIN_* (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reemplaza la contraseña aunque el usuario ya exista.",
        )

    def handle(self, *args, **options):
        email = (os.environ.get("SANAE_ADMIN_EMAIL") or "").strip().lower()
        password = os.environ.get("SANAE_ADMIN_PASSWORD") or ""
        tenant_slug = (os.environ.get("SANAE_ADMIN_TENANT") or "").strip()

        if not email:
            raise CommandError("Falta la variable SANAE_ADMIN_EMAIL.")

        tenant = None
        if tenant_slug:
            tenant = Tenant.objects.filter(slug=tenant_slug).first()
            if tenant is None:
                raise CommandError(f"No existe una agencia con slug '{tenant_slug}'.")

        with transaction.atomic():
            user = CustomUser.objects.filter(email=email).first()
            created = user is None
            if created:
                if not password:
                    raise CommandError("Usuario nuevo: definí SANAE_ADMIN_PASSWORD.")
                user = CustomUser.objects.create_superuser(email=email, password=password)
            else:
                if password and (options["reset_password"] or not user.has_usable_password()):
                    user.set_password(password)
                user.is_active = True
                user.is_staff = True
                user.is_superuser = True
                user.platform_role = PlatformRole.SUPERADMIN
                user.save()

            membership_msg = ""
            if tenant is not None:
                membership, m_created = Membership.objects.get_or_create(
                    user=user,
                    tenant=tenant,
                    defaults={"role": TenantRole.OWNER, "membership_active": True},
                )
                if not m_created and (membership.is_deleted or not membership.membership_active):
                    membership.is_deleted = False
                    membership.membership_active = True
                    membership.save()
                membership_msg = f" Membresía activa en '{tenant.slug}' como propietario."

        verb = "Creado" if created else "Actualizado"
        self.stdout.write(self.style.SUCCESS(f"{verb} superadmin {email}.{membership_msg}"))
        self.stdout.write("Quitá SANAE_ADMIN_PASSWORD de las variables de entorno.")
