# Plataforma SaaS Multi-Tenant — Prestaciones Médicas Domiciliarias

Sistema B2B SaaS para la **digitalización, auditoría y liquidación automática** de planillas de prestaciones médicas domiciliarias (enfermeros, cuidadores, kinesiólogos).

Objetivos de negocio del documento maestro:

- Eliminar la fricción del papel en la carga de planillas de visitas.
- Automatizar los cruces tarifarios y el cálculo de liquidaciones.
- Ofrecer interfaces adaptadas a cada tipo de usuario: administrativos, prestadores en terreno, familiares de pacientes y el equipo de soporte interno (**AJR Data**).

> **Estado actual: Fase 1 entregada.** Según el documento maestro, el desarrollo avanza por fases y **cada fase requiere confirmación explícita antes de continuar**. Ver [Roadmap](#roadmap-por-fases).

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura](#arquitectura)
3. [Modelo de roles](#modelo-de-roles)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Modelos base (Fase 1)](#modelos-base-fase-1)
6. [Variables de entorno](#variables-de-entorno)
7. [Instalación local](#instalación-local)
8. [Despliegue](#despliegue)
9. [Seguridad y cumplimiento normativo](#seguridad-y-cumplimiento-normativo)
10. [Roadmap por fases](#roadmap-por-fases)
11. [Decisiones abiertas y supuestos](#decisiones-abiertas-y-supuestos)
12. [Verificación](#verificación)

---

## Stack tecnológico

### Backend

| Componente | Tecnología | Notas |
|---|---|---|
| Framework | Django 5.x + Django REST Framework | `Django>=5.1,<6.0` |
| Base de datos | PostgreSQL alojada en **Neon** | SSL obligatorio (`DB_SSLMODE=require`) |
| Adaptador DB | `psycopg` 3 (`psycopg[binary,pool]`) | Pool de conexiones nativo (`OPTIONS.pool = True`) |
| Autenticación | JWT (Access 15 min + Refresh rotativo) y OTP por correo | **Fase 2** |
| Seguridad | Cloudflare Turnstile en login, registro y recuperación | **Fase 2** |
| Cifrado de PHI | Fernet (`cryptography`) a nivel de campo | Implementado en Fase 1 (helper) |
| Despliegue | Render / Railway | Decisión pendiente, ver [Despliegue](#despliegue) |

### Frontend (Fases 5 y 6)

| Componente | Tecnología |
|---|---|
| Framework | React 18+ con Vite y TypeScript |
| Estilos | Tailwind CSS 3.x + Headless UI / Radix UI |
| Internacionalización | `react-i18next` (es-AR por defecto, en) |
| Estado y datos | TanStack Query (React Query) + Axios con interceptores JWT |
| Iconografía | Lucide React |
| Mobile | Arquitectura PWA / Mobile-First preparada para Capacitor (APK/iOS) |
| Despliegue | Vercel |

---

## Arquitectura

### Principios

- **POO y SOLID**, con patrones de diseño para mantenibilidad.
- **Shared Database / Shared Schema** con filtrado estricto por `tenant_id`.
- **Service Layer**: la lógica de negocio vive en servicios (`TimesheetProcessingService`, `LegalComplianceService`, etc.). Las vistas solo serializan y validan.
- **Strategy** para el motor de liquidación (`SettlementStrategy`).

### Aislamiento multi-tenant

Tres capas de defensa:

1. **`TenantMiddleware`** reinicia el contexto de tenant en cada petición (sin fugas entre solicitudes).
2. **`TenantManager`** (manager por defecto de `TenantAwareModel`) filtra automáticamente por el tenant activo y excluye registros con soft delete. Sin tenant activo devuelve un queryset vacío (*fail-closed*).
3. **`TenantAwareModel.save()`** asigna el tenant activo a los registros nuevos y rechaza escrituras de otro tenant (`CrossTenantWriteError`).

El contexto se guarda en un `ContextVar`, por lo que es seguro con hilos y con código asíncrono.

### Capas

```
┌──────────────────────────────────────────────┐
│ Vistas DRF (serializan / validan)            │  Fase 4
├──────────────────────────────────────────────┤
│ Services (lógica de negocio)                 │  Fases 2–4
│  - LegalComplianceService                    │
│  - TimesheetProcessingService                │
├──────────────────────────────────────────────┤
│ Strategies de liquidación                    │  Fase 3
│  - BaseBillingCalculator (abstracta)         │
│  - HourlyBillingStrategy                     │
│  - PerVisitBillingStrategy                   │
├──────────────────────────────────────────────┤
│ Modelos (core: BaseAuditModel,               │  Fase 1
│          TenantAwareModel, Tenant)           │
├──────────────────────────────────────────────┤
│ PostgreSQL (Neon) · psycopg3 + pool          │
└──────────────────────────────────────────────┘
```

---

## Modelo de roles

Principio de **privacidad inversa**: cada rol ve únicamente lo que necesita.

| Rol | Ámbito | Acceso |
|---|---|---|
| `PLATFORM_SUPERADMIN` | AJR Data | Gestiona infraestructura. **No ve datos médicos.** |
| `PLATFORM_SUPPORT` | AJR Data | Soporte técnico. **No ve datos médicos.** |
| `TENANT_OWNER` | Agencia | Gestiona agencia y facturación. Acceso al botón de arrepentimiento/baja. |
| `TENANT_ADMIN` | Agencia | Gestiona agencia y facturación. |
| `TENANT_LIQUIDATOR` | Agencia | Cálculos y OCR. Ve el **resumen** de la visita, no el historial médico profundo. |
| `TENANT_MEDICAL_AUDITOR` | Agencia | Ve evoluciones médicas completas. **No ve facturación.** |
| `TENANT_PROVIDER` (enfermero) | Agencia | Verificado por matrícula. Ve solo sus pacientes. |
| `TENANT_FAMILY_CLIENT` (familiar) | Agencia | Verificado por OTP. Ve solo su paciente asociado y valida firmas. |

> Los roles se implementarán en la **Fase 2** (app `iam`).

---

## Estructura del proyecto

```
prestaciones-saas/
├── README.md                  # Esta documentación
├── .env.example               # Plantilla de variables de entorno
├── .gitignore
├── requirements.txt           # Dependencias Python
├── manage.py                  # CLI de Django
├── config/                    # Configuración del proyecto
│   ├── __init__.py
│   ├── settings.py            # Settings leídos desde entorno
│   ├── urls.py                # Enrutamiento raíz
│   ├── wsgi.py
│   └── asgi.py
└── core/                      # Fase 1: base multi-tenant y auditoría
    ├── __init__.py
    ├── apps.py
    ├── models.py              # BaseAuditModel, TenantAwareModel, Tenant
    ├── managers.py            # SoftDeleteQuerySet, TenantManager
    ├── middleware.py          # TenantMiddleware
    ├── tenant_context.py      # ContextVar del tenant activo
    ├── exceptions.py          # CrossTenantWriteError, TenantNotSetError
    ├── migrations/
    │   └── __init__.py
    └── utils/
        ├── __init__.py
        ├── ids.py             # uuid7() — UUIDv7 (RFC 9562)
        └── crypto.py          # EncryptedTextField (Fernet)
```

Carpetas previstas para fases siguientes: `iam/`, `legal/`, `operations/`, y el frontend en `frontend/` (Fases 2, 3, 5 y 6).

---

## Modelos base (Fase 1)

### `BaseAuditModel` (abstracto)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `UUIDField` (UUIDv7) | Clave primaria, ordenable cronológicamente |
| `created_at` | `DateTimeField` | Fecha de creación (auto) |
| `updated_at` | `DateTimeField` | Fecha de última modificación (auto) |
| `created_by` | `UUIDField` (nullable) | UUID del usuario creador. Pasará a FK en Fase 2 |
| `is_deleted` | `BooleanField` | Soft delete. Indexado |

Método `soft_delete()`: marca `is_deleted=True` sin borrar el registro.

### `TenantAwareModel` (abstracto, hereda de `BaseAuditModel`)

| Campo | Tipo | Descripción |
|---|---|---|
| `tenant` | `ForeignKey(Tenant, PROTECT)` | Agencia propietaria del registro. Indexado |

Managers:

- `objects` → `TenantManager`: filtrado por tenant activo y soft delete.
- `unscoped` → `Manager` sin filtro. **Solo para procesos de plataforma.** Nunca usar en vistas.

### `Tenant`

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `CharField(200)` | Nombre de la agencia |
| `slug` | `SlugField(120)`, único | Identificador legible |
| `is_active` | `BooleanField` | Estado de la agencia |

> `Tenant` no figura como modelo explícito en el documento maestro. Se introduce porque `tenant_id` requiere una entidad de referencia. Ver [Decisiones abiertas](#decisiones-abiertas-y-supuestos).

### `EncryptedTextField`

`TextField` que cifra su contenido con Fernet al escribir y lo descifra al leer. Previsto para datos de PHI (diagnósticos, evoluciones, etc.) desde la Fase 3.

### `uuid7()`

Generador de UUIDv7 incluido en `core/utils/ids.py`, porque Python 3.13 no lo trae en la biblioteca estándar.

---

## Variables de entorno

Definidas en `.env.example`. Copiar a `.env` y completar. **Nunca commitear `.env`.**

| Variable | Obligatoria | Fase | Descripción |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | Sí | 1 | Clave secreta de Django |
| `DJANGO_DEBUG` | No | 1 | `False` en producción (por defecto) |
| `DJANGO_ALLOWED_HOSTS` | Sí en producción | 1 | Hosts separados por coma |
| `DJANGO_SECURE_SSL_REDIRECT` | No | 1 | Redirección HTTPS (activa si `DEBUG=False`) |
| `DJANGO_HSTS_SECONDS` | No | 1 | Duración de HSTS. `0` por defecto, subir en producción tras validar |
| `DB_NAME` | Sí | 1 | Base de datos en Neon |
| `DB_USER` | Sí | 1 | Usuario de base de datos |
| `DB_PASSWORD` | Sí | 1 | Contraseña de base de datos |
| `DB_HOST` | Sí | 1 | Host de Neon |
| `DB_PORT` | No | 1 | `5432` por defecto |
| `DB_SSLMODE` | No | 1 | `require` por defecto |
| `FIELD_ENCRYPTION_KEY` | Sí | 1 | Clave Fernet para cifrado de PHI |
| `JWT_SIGNING_KEY` | Sí | 2 | Clave de firma de JWT |
| `JWT_ACCESS_TOKEN_MINUTES` | No | 2 | `15` según el documento maestro |
| `JWT_REFRESH_TOKEN_DAYS` | Sí | 2 | **Pendiente de definir** |
| `TURNSTILE_SECRET_KEY` | Sí | 2 | Secret key de Cloudflare Turnstile |
| `TURNSTILE_VERIFY_URL` | No | 2 | Endpoint oficial de verificación de Turnstile |
| `DEFAULT_FROM_EMAIL` | No | 2 | `no-reply@ajrdata.com.ar` según el documento maestro |
| `EMAIL_BACKEND` | No | 2 | Consola en desarrollo, SMTP en producción |
| `EMAIL_HOST` / `EMAIL_PORT` | Sí (SMTP) | 2 | **Proveedor SMTP pendiente de definir** |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Sí (SMTP) | 2 | Credenciales SMTP |
| `EMAIL_USE_TLS` | No | 2 | `True` por defecto |

Generación de claves:

```bash
# Django
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Fernet (cifrado de campos)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Instalación local

Requisitos: Python 3.12+ (probado en diseño con 3.13), una base PostgreSQL (Neon u otra) con SSL.

```bash
# 1. Crear y activar entorno virtual
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar entorno
cp .env.example .env
# Completar .env con valores reales (ver tabla anterior)

# 4. Generar migraciones de la app core y aplicarlas
python manage.py makemigrations core
python manage.py migrate

# 5. Crear superusuario de plataforma (Django admin, temporal hasta Fase 2)
python manage.py createsuperuser

# 6. Levantar servidor de desarrollo
python manage.py runserver
```

> **Importante:** la primera migración de `core` debe generarse con `makemigrations` y versionarse en el repositorio. Cuando se incorpore el modelo `CustomUser` (Fase 2), la base de datos debe crearse desde cero, porque Django no permite cambiar `AUTH_USER_MODEL` después de la primera migración.

---

## Despliegue

El documento maestro indica **Render / Railway** para el backend y **Vercel** para el frontend. Esa elección queda pendiente. Requisitos ya previstos en la configuración:

- Variables de entorno gestionadas por la plataforma (nunca en el repositorio).
- `DJANGO_DEBUG=False` y `DJANGO_ALLOWED_HOSTS` con el dominio final.
- Proxy HTTPS: `SECURE_PROXY_SSL_HEADER` configurado para `X-Forwarded-Proto`.
- Base de datos en Neon con SSL obligatorio.

Comando de arranque para producción (un servidor WSGI como Gunicorn debe agregarse a `requirements.txt` antes de desplegar; **no incluido en Fase 1**):

```bash
python manage.py migrate && gunicorn config.wsgi:application
```

---

## Seguridad y cumplimiento normativo

### Requisitos del documento maestro

- **HIPAA / Ley 25.326 (Argentina)**: protección de datos personales y de salud.
- **Cifrado de PHI**: a nivel de campo (Fernet / AES-256 según el documento).
- **Contraseñas**: mínimo 15 caracteres; prohibidos 3 caracteres idénticos consecutivos (`/(.)\1\1/`). **Fase 2.**
- **Tokens**: Access 15 min + Refresh rotativo, en cookies `HttpOnly; Secure; SameSite=None` o headers. **Fase 2.**
- **Protección de endpoints** de login, registro y recuperación con Cloudflare Turnstile. **Fase 2.**
- **OTP** por correo para recuperación y cambios críticos de email, email de respaldo y username. **Fase 2.**
- **Consentimiento inmutable**: registros con timestamp, IP y hash SHA-256 del documento aceptado. **Fase 2.**
- **Telemetría sanitizada** y errores estandarizados. **Fase 4.**

### Estado en Fase 1

| Control | Estado |
|---|---|
| Aislamiento por tenant (manager + middleware + save) | Implementado |
| Soft delete | Implementado |
| Fail-closed sin tenant activo | Implementado |
| Cifrado de campos (helper Fernet) | Implementado, sin uso aún |
| Cookies seguras y HSTS en producción | Configurado |
| DRF denegando por defecto | Configurado |
| Autenticación, roles y OTP | Pendiente (Fase 2) |
| Auditoría de accesos a PHI | Pendiente |

### Advertencia sobre el cifrado

El documento maestro menciona "Fernet / AES-256". **Fernet usa AES-128 en modo CBC con HMAC-SHA256**, no AES-256. Si el requisito es estrictamente AES-256, la alternativa es `AESGCM` de `cryptography` con clave de 32 bytes. Pendiente de confirmar antes de la Fase 3.

---

## Roadmap por fases

| Fase | Contenido | Estado |
|---|---|---|
| **1** | README, `.env.example`, proyecto Django, app `core` (BaseAuditModel, TenantAwareModel, TenantMiddleware, cifrado base) | **Entregada** |
| 2 | App `iam`: `CustomUser`, validador de contraseñas, OTP por correo, Turnstile, JWT, roles. App `legal`: documentos versionados, logs de aceptación inmutables | Pendiente de confirmación |
| 3 | App `operations`: pacientes, profesionales, obras sociales. `SettlementStrategy` para tarifarios. `TimesheetScan`, `DailyEvolution` | Pendiente |
| 4 | Serializers y ViewSets DRF. Chats: `ScopedVisitChat`, `InternalContextThread`. Telemetría sanitizada y errores estandarizados | Pendiente |
| 5 | Frontend: Vite, React, Tailwind, temas *Clinical Frost* / *Obsidian Aurora*, `ThemeController`, layouts adaptativos | Pendiente |
| 6 | Frontend: Split-Screen OCR, widget de soporte, switch Vista Simple/Detallada, modo Blur Privacidad | Pendiente |

Cada fase se entrega por separado y requiere confirmación explícita antes de comenzar.

---

## Decisiones abiertas y supuestos

Puntos que el documento maestro no define. Se resolvieron de la forma indicada o quedan pendientes:

| # | Tema | Decisión en Fase 1 | Acción requerida |
|---|---|---|---|
| 1 | Entidad `Tenant` | Se creó `core.Tenant` como referencia de `tenant_id`. | Confirmar campos adicionales (CUIT, datos fiscales, plan, etc.) |
| 2 | Resolución del tenant activo | El middleware deja el contexto en `None`. Lo establece la autenticación en Fase 2. | Confirmar cómo se asocia un usuario a uno o varios tenants |
| 3 | `created_by` | `UUIDField` nullable, sin FK. | Convertir en FK a `iam.CustomUser` en Fase 2 |
| 4 | Render vs Railway | Sin definir. | Elegir plataforma |
| 5 | Refresh token | Duración sin definir. | Definir tiempo de vida |
| 6 | Proveedor SMTP | Sin definir. Consola en desarrollo. | Elegir proveedor |
| 7 | Cifrado Fernet vs AES-256 | Fernet implementado. | Confirmar algoritmo |
| 8 | Rotación de claves de cifrado | No implementada (una sola clave). | Definir procedimiento (p. ej. `MultiFernet`) |
| 9 | Búsqueda sobre campos cifrados | No soportada en SQL. | Diseñar índices ciegos o columnas derivadas si se requieren |
| 10 | Admin de Django | Expuesto en `/admin/` como base. | Restringir o retirar en producción una vez definidos los roles |
| 11 | Frontend en repositorio | Fuera de alcance de Fase 1. | Definir si vive en el mismo repositorio |

---

## Verificación

**Estado:** los archivos de Fase 1 fueron revisados sintácticamente, pero **no se ejecutaron pruebas ni migraciones** en el entorno de generación, porque Django y las dependencias no estaban instaladas y la instalación de paquetes no estaba disponible.

Pasos recomendados antes de dar por cerrada la Fase 1:

```bash
pip install -r requirements.txt
python manage.py check
python manage.py makemigrations core
python manage.py migrate
python -c "import django, os; os.environ['DJANGO_SETTINGS_MODULE']='config.settings'; django.setup(); from core.utils.ids import uuid7; print(uuid7())"
```

Las pruebas automatizadas (aislamiento de tenant, soft delete, cifrado, UUIDv7) corresponden a la **Fase 4** ("Tests Base").
