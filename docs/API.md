# API REST — referencia

Base: `/api/v1/`. Autenticación: `Authorization: Bearer <access>`. Para recursos de agencia: `X-Tenant-ID: <uuid>`.

**Formato de error:**

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

## Identidad (`iam`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `auth/register/` | Público + Turnstile | Alta. Envía OTP de verificación. Responde 202 aunque el email exista. |
| POST | `auth/verify-registration/` | Público + Turnstile | Activa la cuenta con el OTP. |
| POST | `auth/login/` | Público + Turnstile | Devuelve `access` y `user`. Setea cookie de refresh. |
| POST | `auth/refresh/` | Cookie de refresh | Rota el refresh y devuelve nuevo `access`. |
| POST | `auth/logout/` | Cookie de refresh | Revoca la sesión. |
| POST | `auth/password/check/` | Público | Devuelve los 2 checks de contraseña. |
| POST | `auth/password/reset/request/` | Público + Turnstile | Envía OTP de recuperación. |
| POST | `auth/password/reset/confirm/` | Público + Turnstile | Cambia la contraseña y revoca sesiones. |
| GET | `me/` | Autenticado | Usuario y membresías. |
| POST | `me/change/request/` | Autenticado | Inicia cambio de `email`, `backup_email` o `username` con OTP. |
| POST | `me/change/confirm/` | Autenticado | Confirma el cambio con el OTP. |
| GET | `tenants/` | Autenticado | Agencias del usuario. |
| POST | `platform/tenants/` | `PLATFORM_SUPERADMIN` | Crea una agencia. |
| POST | `tenants/<id>/memberships/` | `OWNER` / `ADMIN` | Asigna un usuario verificado a la agencia. |

Turnstile: el cliente envía `turnstile_token` en el cuerpo.

## Legal (`legal`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `legal/documents/` | Autenticado | Última versión de cada documento. |
| POST | `legal/documents/publish/` | `PLATFORM_SUPERADMIN` | Publica una nueva versión (inmutable). |
| GET | `legal/pending/` | Autenticado | Documentos requeridos sin aceptar. |
| POST | `legal/accept/` | Autenticado | Registra la aceptación (`document_id`). |
| POST | `legal/withdrawal/` | `OWNER` | Baja de la agencia activa. |
| POST | `legal/informed-consent/` | `FAMILY_CLIENT` | Firma el consentimiento (`patient_id`, `document_id`, `signature_data`). |

## Operaciones (`operations`)

Los recursos usan `ModelViewSet` salvo indicación. Las escrituras requieren `OWNER`/`ADMIN` salvo las acciones de autoservicio.

| Recurso | Ruta | Lectura | Escritura |
|---|---|---|---|
| Tarifas | `tariffs/` | OWNER, ADMIN, LIQUIDATOR | OWNER, ADMIN |
| Obras sociales | `health-insurances/` | OWNER, ADMIN, LIQUIDATOR | OWNER, ADMIN |
| Pacientes | `patients/` | Según alcance del rol | OWNER, ADMIN |
| Prestadores | `professionals/` | Según rol | OWNER, ADMIN. `POST {id}/verify-license/` |
| Vínculos familiares | `family-links/` | ADMIN y familiar | OWNER, ADMIN. Familiar: `POST {id}/request-code/`, `POST {id}/verify/` |
| Visitas | `visits/` | Según alcance | OWNER, ADMIN. Prestador: `POST {id}/complete/` |
| Evoluciones | `evolutions/` | AUDITOR (todas), PROVIDER (propias) | PROVIDER (sobre visita completada) |
| Planillas | `scans/` | OWNER, ADMIN, LIQUIDATOR, PROVIDER (propias) | `POST /` (multipart `image`), `POST {id}/validate/`, `GET {id}/image/` |
| Liquidaciones | `settlements/` | OWNER, ADMIN, LIQUIDATOR | `POST generate/`, `POST {id}/validate/` |
| Simulador | `simulator/` | OWNER, ADMIN, LIQUIDATOR | `POST` |
| Cobertura | `coverage/?patient_id&year&month` | Según alcance | — |
| Feriados | `holidays/` | Autenticado | — |

El borrado de estos recursos es lógico (`is_deleted`).

## Comunicaciones (`comms`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET / POST | `visits/<id>/chat/` | PROVIDER, FAMILY_CLIENT | Chat operativo. Solo escribe dentro de la ventana de 2 h. |
| GET / POST | `context-threads/` | Staff (sin familiar) | Hilos internos sobre planilla o liquidación. |
| POST | `context-threads/<id>/comments/` | Staff | Comentario en hilo. |
| POST | `support/messages/` | Staff | Mensaje a AJR Data (sanitizado). |
| GET | `platform/support/inbox/` | Plataforma | Bandeja de soporte. |

Todas las respuestas son JSON, salvo `GET scans/{id}/image/` que devuelve la imagen.
