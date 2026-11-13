# Decisiones y supuestos

El documento maestro no define los puntos siguientes. Cada uno se resolvió como se indica. Los que dicen **pendiente** necesitan una decisión del equipo.

| # | Tema | Decisión tomada | Estado |
|---|---|---|---|
| 1 | Entidad `Tenant` | `core.Tenant` con `name`, `slug`, `is_active`. Faltan CUIT, datos fiscales y plan. | Pendiente de confirmar campos |
| 2 | Usuario en varias agencias | Un usuario puede tener una membresía por agencia (`Membership`, restricción única). El frontend permite cambiar de agencia. | Implementado |
| 3 | Plataforma de despliegue | Sin definir: Render o Railway. | **Pendiente** |
| 4 | Duración del refresh token | Variable obligatoria `JWT_REFRESH_TOKEN_DAYS`. El arranque falla si falta. | **Pendiente** |
| 5 | Duración del OTP y reintentos | Variables obligatorias `OTP_EXPIRY_MINUTES` y `OTP_MAX_ATTEMPTS`. | **Pendiente** |
| 6 | Proveedor SMTP | Sin definir. En desarrollo se usa la consola. | **Pendiente** |
| 7 | Algoritmo de cifrado | El documento dice "Fernet / AES-256". Fernet usa AES-128-CBC con HMAC-SHA256. Se implementó Fernet. Si el requisito es AES-256 estricto, cambiar a AES-GCM. | **Pendiente de confirmar** |
| 8 | Rotación de claves de cifrado | No implementada. Una sola clave. `MultiFernet` es la vía natural. | **Pendiente** |
| 9 | Búsqueda sobre campos cifrados | No soportada en SQL (cifrado no determinista). Para buscar por documento se requiere un hash ciego adicional. | **Pendiente** |
| 10 | Motor de OCR | No definido. Interfaz `OCRExtractor` con implementación nula por defecto. | **Pendiente** |
| 11 | Feriados | Tabla global `Holiday`, cargada desde el admin de plataforma. El documento no indica la fuente. | Implementado; carga manual |
| 12 | Cálculo de liquidación | Recargo por feriado sobre todos los minutos de la visita. Recargo nocturno sobre los minutos dentro de la franja. Ambos aditivos sobre el valor hora. Redondeo a centavos (ROUND_HALF_UP). | **Supuesto a validar con el negocio** |
| 13 | Franja nocturna | Configurable (inicio y fin). Si cruza medianoche, se maneja. | Implementado |
| 14 | Liquidación validada | Inmutable. Solo los borradores se regeneran. | Implementado |
| 15 | Matrícula de prestador | Campo en `Membership` con fecha de verificación. Solo `OWNER`/`ADMIN` la verifican. El documento no indica el proceso de verificación contra el colegio profesional. | Verificación manual |
| 16 | Vínculo familiar | Verificado con OTP enviado al correo del familiar. | Implementado |
| 17 | Chat operativo | Abierto 2 h antes y después de la visita. Solo prestador asignado y familiar vinculado. | Implementado |
| 18 | Sanitización de soporte | Enmascara correos, teléfonos, DNI y nombres de pacientes conocidos. No detecta todo dato clínico en texto libre. | Limitación conocida |
| 19 | Bandeja de soporte para AJR Data | Accesible a `PLATFORM_SUPERADMIN` y `PLATFORM_SUPPORT`. Solo texto sanitizado. | Revisar si `SUPPORT` debe ver mensajes |
| 20 | Admin de Django | Expuesto en `/admin/`. Se recomienda restringirlo en producción. | Pendiente |
| 21 | Frontend en el mismo repositorio | Sí, en `frontend/`. | Decidido |
| 22 | Gunicorn | No incluido en `requirements.txt`. | **Pendiente de agregar** |
| 23 | Consentimiento informado | Firma en PNG como data URL, cifrada. Requiere vínculo familiar verificado. | Implementado |
| 24 | Baja de agencia | Desactiva la agencia (`is_active=False`) y registra la solicitud de forma inmutable. No borra datos. | Implementado |

## Notas técnicas

- **Soft delete:** nunca se borran físicamente registros con datos de salud.
- **Matrícula:** `Membership.license_verified_at` queda vacío hasta que un administrador la verifica.
- **Tokens de access sin tenant:** la agencia activa va en la cabecera `X-Tenant-ID`, validada en cada petición.
