"""Identidad, membresías por agencia y códigos de un solo uso."""
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from core.models import BaseAuditModel, Tenant


class PlatformRole(models.TextChoices):
    SUPERADMIN = "PLATFORM_SUPERADMIN", "Superadmin de plataforma"
    SUPPORT = "PLATFORM_SUPPORT", "Soporte de plataforma"


class TenantRole(models.TextChoices):
    OWNER = "TENANT_OWNER", "Propietario de agencia"
    ADMIN = "TENANT_ADMIN", "Administrador de agencia"
    LIQUIDATOR = "TENANT_LIQUIDATOR", "Liquidador"
    MEDICAL_AUDITOR = "TENANT_MEDICAL_AUDITOR", "Auditor médico"
    PROVIDER = "TENANT_PROVIDER", "Prestador (enfermero/cuidador/kinesiólogo)"
    FAMILY_CLIENT = "TENANT_FAMILY_CLIENT", "Familiar del paciente"


class OTPPurpose(models.TextChoices):
    REGISTER_VERIFY = "REGISTER_VERIFY", "Verificación de registro"
    PASSWORD_RESET = "PASSWORD_RESET", "Recuperación de contraseña"
    EMAIL_CHANGE = "EMAIL_CHANGE", "Cambio de email"
    BACKUP_EMAIL_CHANGE = "BACKUP_EMAIL_CHANGE", "Cambio de email de respaldo"
    USERNAME_CHANGE = "USERNAME_CHANGE", "Cambio de username"
    FAMILY_LINK_VERIFY = "FAMILY_LINK_VERIFY", "Verificación de vínculo familiar"


class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("El email es obligatorio.")
        user = self.model(email=self.normalize_email(email).lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("platform_role", PlatformRole.SUPERADMIN)
        return self.create_user(email, password, **extra_fields)


class CustomUser(BaseAuditModel, AbstractBaseUser, PermissionsMixin):
    """Usuario global. Sus permisos dentro de cada agencia viven en `Membership`.

    Login por email. `username` es un identificador visible, único y editable
    con verificación OTP.
    """

    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    backup_email = models.EmailField(blank=True, null=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    platform_role = models.CharField(
        max_length=32, choices=PlatformRole.choices, blank=True, null=True
    )
    is_active = models.BooleanField(default=False)  # se activa al verificar el OTP
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self) -> str:
        return self.email

    @property
    def is_platform_staff(self) -> bool:
        return self.platform_role in {PlatformRole.SUPERADMIN, PlatformRole.SUPPORT}


class Membership(BaseAuditModel):
    """Vincula un usuario con una agencia y le asigna un rol dentro de ella."""

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name="+")
    role = models.CharField(max_length=32, choices=TenantRole.choices)
    license_number = models.CharField(max_length=64, blank=True)  # matrícula (prestadores)
    license_verified_at = models.DateTimeField(null=True, blank=True)
    membership_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "membresía"
        verbose_name_plural = "membresías"
        constraints = [
            models.UniqueConstraint(fields=["user", "tenant"], name="unique_user_per_tenant"),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.tenant} ({self.role})"

    @property
    def is_usable(self) -> bool:
        return self.membership_active and self.tenant.is_active and not self.is_deleted


class OneTimeCode(BaseAuditModel):
    """Código OTP. Se almacena solo su HMAC; nunca el código en claro."""

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="otp_codes")
    purpose = models.CharField(max_length=32, choices=OTPPurpose.choices)
    target = models.CharField(max_length=254, blank=True)  # valor nuevo a confirmar
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "purpose", "consumed_at"])]


class RefreshToken(BaseAuditModel):
    """Registro de refresh tokens para rotación y detección de reutilización.

    `family` agrupa todos los tokens de una misma sesión. Si se reutiliza un
    token ya rotado, se revoca la familia completa.
    """

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="refresh_tokens")
    jti = models.UUIDField(unique=True)
    family = models.UUIDField(db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
