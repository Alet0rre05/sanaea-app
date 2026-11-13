# Plataforma SaaS Multi-Tenant — Prestaciones Médicas Domiciliarias

Sistema B2B para digitalizar, auditar y liquidar planillas de prestaciones médicas domiciliarias (enfermeros, cuidadores, kinesiólogos). Lo desarrolla AJR Data según el documento maestro del proyecto.

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | README, `.env.example`, proyecto Django, `core` (UUIDv7, auditoría, soft delete, multi-tenant, cifrado) | Código entregado |
| 2 | `iam` (CustomUser, validador de 15 caracteres sin triple repetición, OTP por correo, Turnstile, JWT con refresh rotativo, roles) y `legal` (versiones, aceptaciones inmutables, consentimiento, baja) | Código entregado (backend) |
| 3 | `operations` (pacientes, prestadores, obras sociales, tarifarios, visitas, planillas con pHash, evoluciones, liquidaciones, `SettlementStrategy`) | Código entregado; motor de cálculo con pruebas unitarias |
| 4 | API DRF (ViewSets, errores estandarizados, telemetría sanitizada), chats `ScopedVisitChat` e `InternalContextThread`, soporte global | Código entregado |
| 5 | Frontend: Vite, React, TypeScript, Tailwind, temas Clinical Frost / Obsidian Aurora, `ThemeController`, layouts adaptativos | Código entregado; no compilado |
| 6 | Split-Screen OCR, widget de soporte, switch Vista Simple/Detallada, Blur Privacidad, autoguardado, offline (IndexedDB), deshacer con toast | Código entregado; no compilado |

> **Importante:** el código se escribió y se revisó sin poder ejecutar Django ni `npm` en el entorno de generación (sin instalación de paquetes). Lo verificado está en la sección [Verificación](#verificación). **No hay migraciones generadas**: deben crearse con `makemigrations` antes de desplegar (ver [Instalación](#instalación-backend)).

Documentación adicional: [`docs/API.md`](docs/API.md) (endpoints) y [`docs/DECISIONES.md`](docs/DECISIONES.md) (decisiones y supuestos).

---

## Stack

**Backend:** Django 5.1+, Django REST Framework, PostgreSQL en Neon (psycopg 3 con pool nativo), PyJWT, `cryptography` (Fernet), Pillow + imagehash (pHash), django-cors-headers.

**Frontend:** React 18, Vite, TypeScript, Tailwind CSS 3, Headless UI, TanStack Query, Axios, react-i18next (es-AR y en), lucide-react, IndexedDB para modo offline.

**Despliegue:** Render (backend y frontend, ver `render.yaml`). La decisión Render vs Railway queda resuelta a favor de Render.

---

## Arquitectura

### Multi-tenancy (Shared Database / Shared Schema)

Tres capas de defensa, descritas en `core/`:

1. **`TenantMiddleware`** reinicia el contexto de tenant en cada petición.
2. **`TenantManager`** (manager por defecto de `TenantAwareModel`) filtra por el tenant activo y excluye registros con soft delete. Sin tenant activo devuelve `none()` (fail-closed).
3. **`TenantAwareModel.save()`** asigna el tenant activo y rechaza escrituras de otra agencia (`CrossTenantWriteError`).

El tenant activo se fija en la autenticación a partir de la cabecera `X-Tenant-ID`, validada contra una membresía activa. El contexto usa `ContextVar`.

### Capas

- **Vistas DRF:** validan y serializan. Permisos declarados por recurso (`allowed_roles`, `write_roles`).
- **Servicios** (`iam/services.py`, `legal/services.py`, `operations/services.py`, `comms/services.py`): toda la lógica de negocio.
- **Strategies de liquidación** (`operations/billing.py`): `BaseBillingCalculator` abstracta, `HourlyBillingStrategy`, `PerVisitBillingStrategy`. Módulo puro, sin ORM.
- **Modelos** y **utilidades** (`core/`).

### Apps

| App | Responsabilidad |
|---|---|
| `core` | `BaseAuditModel`, `TenantAwareModel`, `Tenant`, middleware, contexto, UUIDv7, cifrado, telemetría, manejador de errores, registros inmutables |
| `iam` | Usuario, membresías por agencia, OTP, JWT, Turnstile, permisos por rol |
| `legal` | Documentos versionados, aceptaciones inmutables, consentimiento informado, baja de agencia |
| `operations` | Dominio de salud y liquidación |
| `comms` | Chat operativo de visita, hilos internos, soporte global sanitizado |

### Roles

| Rol | Alcance |
|---|---|
| `PLATFORM_SUPERADMIN` / `PLATFORM_SUPPORT` | AJR Data. Gestionan infraestructura y soporte. |
| `TENANT_OWNER` / `TENANT_ADMIN` | Agencia y facturación. Solo `OWNER` puede dar de baja la agencia y crear otros `OWNER`. |
| `TENANT_LIQUIDATOR` | Liquidaciones, planillas y resumen de visitas. |
| `TENANT_MEDICAL_AUDITOR` | Evoluciones médicas completas. Sin facturación. |
| `TENANT_PROVIDER` | Solo sus visitas y pacientes. Matrícula verificada por la agencia. |
| `TENANT_FAMILY_CLIENT` | Solo su paciente vinculado, tras verificar el vínculo por OTP. Firma consentimientos. |

La autorización por recurso se resume en `iam/permissions.py` y `operations/scoping.py`.

---

## Seguridad

- **Contraseñas:** mínimo 15 caracteres y prohibidos 3 caracteres idénticos consecutivos (`(.)\1\1`), validadores en `iam/validators.py`. El frontend muestra los 2 checks en verde (`PasswordChecks`).
- **JWT:** access de 15 minutos. Refresh rotativo en cookie `HttpOnly; Secure; SameSite=None`, limitada a `/api/v1/auth/`. Reutilizar un refresh ya rotado revoca toda su familia.
- **OTP:** 6 dígitos, se guarda solo su HMAC-SHA256, expira y tiene un máximo de intentos. Un código nuevo invalida los anteriores.
- **Turnstile:** verificación en login, registro y recuperación. Falla cerrada si Cloudflare no responde.
- **Enumeración:** registro y recuperación responden igual exista o no la cuenta.
- **Cifrado de PHI:** `EncryptedTextField` (Fernet) en nombre, documento, dirección, evoluciones, firmas, planillas extraídas y mensajes de chat.
- **Registros legales inmutables:** `LegalAcceptanceLog`, `InformedConsent`, `TenantWithdrawal`. No admiten UPDATE ni DELETE.
- **Telemetría:** `core/telemetry.py` enmascara claves de PHI y patrones de correo, teléfono y DNI en logs y respuestas de error.
- **Chat operativo:** solo abierto 2 horas antes y después de la visita, con el banner "Solo coordinación logística. Urgencias: 107/911".
- **Soporte:** el texto que el tenant envía a AJR Data se sanitiza antes de guardarse.

---

## Instalación local (backend)

Requisitos: Python 3.12 o superior y una base PostgreSQL con SSL (Neon).

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # completar todas las variables CHANGE_ME

python manage.py check
python manage.py makemigrations core iam legal operations comms
python manage.py migrate
python manage.py createsuperuser  # superadmin de plataforma
python manage.py runserver
```

Las variables obligatorias están en `.env.example`. Si falta alguna, el proceso no arranca.

> Crear `CustomUser` (`AUTH_USER_MODEL = iam.CustomUser`) requiere una base de datos nueva. Django no permite cambiar `AUTH_USER_MODEL` después de la primera migración.

Generación de claves:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"                         # DJANGO_SECRET_KEY, JWT_SIGNING_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEY
```

## Instalación local (frontend)

```bash
cd frontend
cp .env.example .env              # VITE_API_URL y VITE_TURNSTILE_SITE_KEY
npm install
npm run typecheck
npm run dev
```

---

## Pruebas

Las pruebas sin base de datos se ejecutan directamente:

```bash
python -m unittest operations.tests.test_billing comms.tests
```

Las pruebas que requieren base de datos (aislamiento de tenant, cifrado de campos, soft delete) corren con:

```bash
python manage.py test
```

---

## Despliegue en Render

El repositorio tiene dos servicios definidos en `render.yaml` (Blueprint):

| Servicio | Tipo | Carpeta | Build | Start |
|---|---|---|---|---|
| `sanaea-api` | Web (Python) | `backend/` | `pip install -r requirements.txt && python manage.py collectstatic --noinput` | `gunicorn config.wsgi:application` |
| `sanaea-web` | Sitio estático | `frontend/` | `npm ci && npm run build` | publica `dist/` con reescritura SPA |

Pasos:

1. Subir el repositorio a GitHub o GitLab.
2. En Render: **New > Blueprint** y seleccionar el repositorio. Render lee `render.yaml`.
3. Completar las variables marcadas como `sync: false` (ver tabla abajo).
4. Esperar el primer deploy del backend. `preDeployCommand` ejecuta `migrate` antes de cada despliegue.
5. Crear el superadmin desde la Shell del servicio `sanaea-api`: `python manage.py createsuperuser`.
6. Cargar los documentos legales vigentes y configurar `LEGAL_REQUIRED_KINDS` si corresponde.

### Variables que hay que completar

| Variable | Servicio | Valor |
|---|---|---|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | api | Datos de conexión de Neon (copiar desde console.neon.tech) |
| `FIELD_ENCRYPTION_KEY` | api | Clave Fernet: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `JWT_REFRESH_TOKEN_DAYS`, `OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS` | api | **Pendientes de definir por el equipo** |
| `TURNSTILE_SECRET_KEY` | api | Secret key de Cloudflare Turnstile |
| `CORS_ALLOWED_ORIGINS` | api | URL del sitio, ej. `https://sanaea-web.onrender.com` |
| `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | api | **Proveedor SMTP pendiente de definir** |
| `VITE_API_URL` | web | URL de la API, ej. `https://sanaea-api.onrender.com/api/v1` |
| `VITE_TURNSTILE_SITE_KEY` | web | Site key pública de Turnstile |

`DJANGO_SECRET_KEY` y `JWT_SIGNING_KEY` se generan solas (`generateValue`). Las dos se deben mantener en secreto y no se deben reutilizar.

> `VITE_*` se incrustan en el build del frontend. Si cambian, hay que volver a desplegar `sanaea-web`.

### Notas de despliegue

- **Planillas escaneadas:** se guardan en el disco persistente `planillas` montado en `/var/data/planillas` (10 GB). El disco requiere un plan pago; por eso el backend usa `starter`.
- **Base de datos:** Neon queda fuera de Render. Neon exige SSL (`DB_SSLMODE=require`).
- **Health check:** `GET /healthz/` responde sin consultar la base.
- **Dominio propio:** agregarlo en Render y actualizar `CORS_ALLOWED_ORIGINS` y `VITE_API_URL`.
- **Vercel:** el archivo `frontend/vercel.json` no se usa con Render. Puede eliminarse.
- **Gunicorn y WhiteNoise:** incluidos en `requirements.txt`. WhiteNoise sirve los estáticos del admin de Django.

- Variables de entorno en la plataforma, nunca en el repositorio.
- `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS` con el dominio final, `CORS_ALLOWED_ORIGINS` con el frontend.
- Gunicorn no está en `requirements.txt`. Debe agregarse antes de desplegar: `gunicorn config.wsgi:application`.
- Los archivos de planillas se guardan en `MEDIA_ROOT`, que no debe ser público. En Render o Railway, usar un disco persistente.
- Ejecutar `python manage.py migrate` antes de iniciar el servicio.

---

## Verificación

| Qué | Resultado |
|---|---|
| Sintaxis de todo el backend (`py_compile`) | Pasa |
| `render.yaml` parsea como YAML | Pasa |
| Imports relativos del frontend resuelven a archivos existentes | Pasa |
| Motor de liquidación (14 pruebas unitarias) | Pasó en una corrida anterior |
| `pip install`, `manage.py check`, migraciones, pruebas con base de datos | **No ejecutado**: el entorno de generación no puede descargar paquetes (PyPI devuelve 403) |
| `npm ci`, `typecheck`, `build` del frontend | **No ejecutado** por la misma razón |

Antes del primer deploy: `python manage.py check --deploy` y `python manage.py makemigrations` en local con Neon, y `npm run build`.

## Limitaciones conocidas

- **Frontend incompleto frente al backend:** existen pantallas para login, planillas (incluido Split-Screen), liquidaciones, simulador, cobertura y soporte. **Faltan pantallas** para registro, verificación de cuenta, recuperación de contraseña, cambio de email/username, aceptación de documentos legales, vínculo familiar, evoluciones, chat operativo, firma de consentimiento y baja de agencia. Los endpoints correspondientes sí están implementados.
- **OCR:** el motor no está definido en el documento maestro. Por defecto (`NullOCRExtractor`) no extrae datos y la carga se completa manualmente.
- **Búsqueda sobre campos cifrados:** no es posible con SQL. Ver `docs/DECISIONES.md`.
- **Liquidación con recargo nocturno:** el cálculo recorre minuto a minuto. Es correcto pero lento para visitas muy largas.

Las decisiones que el documento maestro no define están en [`docs/DECISIONES.md`](docs/DECISIONES.md).
