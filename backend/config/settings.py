"""
Configuración de Django — Plataforma SaaS de prestaciones médicas domiciliarias.

Todos los secretos y parámetros se leen desde variables de entorno (o `.env`).
Los parámetros que el documento maestro no define son OBLIGATORIOS: el sistema
no arranca hasta que se configuren explícitamente (ver README, "Decisiones abiertas").
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(name, default=None, required=False):
    value = os.environ.get(name, default)
    if required and (value is None or str(value).strip() == ""):
        raise ImproperlyConfigured(f"Falta la variable de entorno obligatoria: {name}")
    return value


def env_bool(name, default=False):
    return str(os.environ.get(name, str(default))).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Núcleo
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", required=True)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render expone el hostname público en esta variable automáticamente.
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h not in {"localhost", "127.0.0.1"}]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "core",
    "iam",
    "legal",
    "operations",
    "comms",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.TenantMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# Base de datos — PostgreSQL (Neon), psycopg3 con pool nativo
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", required=True),
        "USER": env("DB_USER", required=True),
        "PASSWORD": env("DB_PASSWORD", required=True),
        "HOST": env("DB_HOST", required=True),
        "PORT": env("DB_PORT", "5432"),
        "CONN_MAX_AGE": 0,  # requerido por el pool nativo de psycopg
        "OPTIONS": {"sslmode": env("DB_SSLMODE", "require"), "pool": True},
    }
}


# ---------------------------------------------------------------------------
# Identidad
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "iam.CustomUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "iam.validators.MinLength15Validator"},
    {"NAME": "iam.validators.NoTripleRepeatValidator"},
]

JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", required=True)
JWT_ACCESS_TOKEN_MINUTES = int(env("JWT_ACCESS_TOKEN_MINUTES", "15"))
JWT_REFRESH_TOKEN_DAYS = int(env("JWT_REFRESH_TOKEN_DAYS", required=True))
JWT_REFRESH_COOKIE_NAME = "refresh_token"

OTP_EXPIRY_MINUTES = int(env("OTP_EXPIRY_MINUTES", required=True))
OTP_MAX_ATTEMPTS = int(env("OTP_MAX_ATTEMPTS", required=True))

TURNSTILE_SECRET_KEY = env("TURNSTILE_SECRET_KEY", required=True)
TURNSTILE_VERIFY_URL = env(
    "TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify"
)


# ---------------------------------------------------------------------------
# API REST
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["iam.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "core.exceptions_handler.standard_exception_handler",
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept", "authorization", "content-type", "x-tenant-id",
]


# ---------------------------------------------------------------------------
# Cifrado de campos (PHI)
# ---------------------------------------------------------------------------
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", required=True)


# ---------------------------------------------------------------------------
# Archivos privados (planillas escaneadas). No se sirven por URL pública.
# ---------------------------------------------------------------------------
MEDIA_ROOT = env("MEDIA_ROOT", str(BASE_DIR / "private_media"))
OCR_EXTRACTOR = env("OCR_EXTRACTOR", "operations.ocr.NullOCRExtractor")


# ---------------------------------------------------------------------------
# Legal
# ---------------------------------------------------------------------------
# Tipos de documento que deben aceptarse antes de operar (ej. "TOS,PRIVACY").
LEGAL_REQUIRED_KINDS = env_list("LEGAL_REQUIRED_KINDS")


# ---------------------------------------------------------------------------
# Correo electrónico
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "no-reply@ajrdata.com.ar")


# ---------------------------------------------------------------------------
# Internacionalización
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-ar"
LANGUAGES = [("es-ar", "Español (Argentina)"), ("en", "English")]
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}


# ---------------------------------------------------------------------------
# Logging con redacción de PHI
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "phi": {"()": "core.telemetry.PHIRedactionFilter"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "filters": ["phi"]},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}


# ---------------------------------------------------------------------------
# Seguridad HTTP
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDS", "0"))
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
