export interface Faq {
  id: string;
  question: string;
  simple: string;
  detailed: string;
}

/**
 * Preguntas frecuentes. Cada respuesta refleja el comportamiento actual de Sanae
 * y las decisiones de docs/DECISIONES.md. Lo pendiente se dice como pendiente.
 */
export const FAQS: Faq[] = [
  {
    id: 'ocr',
    question: '¿Sanae lee las planillas automáticamente?',
    simple: 'Todavía no. Cargás los datos a mano.',
    detailed: 'El motor de lectura automática (OCR) no está definido aún. Por ahora, la planilla se revisa en Split-Screen y los campos se completan manualmente.',
  },
  {
    id: 'calculo',
    question: '¿Cómo se calcula una liquidación?',
    simple: 'Valor hora más recargos.',
    detailed: 'Se suma el valor hora con los recargos por feriado (sobre todos los minutos de la visita) y por franja nocturna (sobre los minutos dentro de la franja). Se redondea a centavos. La regla de recargos todavía debe validarse con el área de negocio.',
  },
  {
    id: 'validada',
    question: '¿Puedo modificar una liquidación validada?',
    simple: 'No. Queda cerrada.',
    detailed: 'Una liquidación validada es inmutable. Solo los borradores se pueden regenerar.',
  },
  {
    id: 'cambiar-datos',
    question: '¿Cómo cambio mi email o mi usuario?',
    simple: 'Desde Mi cuenta, con un código.',
    detailed: 'Elegí el dato, escribí el nuevo valor y confirmá con el código de 6 dígitos que llega al email de la cuenta. Sin el código, el cambio no se aplica.',
  },
  {
    id: 'quien-ve',
    question: '¿Quién ve los datos de los pacientes?',
    simple: 'Solo lo que corresponde a tu rol.',
    detailed: 'El prestador ve solo sus pacientes y visitas. El liquidador ve el resumen de visitas sin el historial médico. El auditor médico ve las evoluciones y no la facturación. El familiar ve solo a su paciente vinculado.',
  },
  {
    id: 'vinculo',
    question: '¿Cómo verifica un familiar su vínculo?',
    simple: 'Con un código enviado por correo.',
    detailed: 'La agencia asigna el vínculo. El familiar pide el código, lo recibe en su correo y lo ingresa en Vínculos. Recién después puede firmar consentimientos.',
  },
  {
    id: 'chat',
    question: '¿Cuándo está abierto el chat de la visita?',
    simple: '2 horas antes y después de la visita.',
    detailed: 'El chat solo escribe dentro de esa ventana, y solo participan el prestador asignado y el familiar vinculado. Es para coordinación logística. En urgencias, llamá al 107 o al 911.',
  },
  {
    id: 'baja',
    question: '¿Qué pasa si doy de baja la agencia?',
    simple: 'Se desactiva. No se borran datos.',
    detailed: 'La baja desactiva la agencia y registra la solicitud de forma inmutable. No borra datos. Solo la puede realizar el propietario.',
  },
  {
    id: 'borrado',
    question: '¿Se borran datos de pacientes?',
    simple: 'No se borran de forma física.',
    detailed: 'Los registros con datos de salud usan borrado lógico (soft delete). Se dejan de mostrar, pero no se eliminan de la base.',
  },
  {
    id: 'cifrado',
    question: '¿Los datos médicos están cifrados?',
    simple: 'Sí, los campos sensibles.',
    detailed: 'Nombre, documento, dirección, evoluciones, firmas y planillas extraídas se guardan cifrados. Falta confirmar si el requisito es AES-256 estricto, porque hoy se usa Fernet (AES-128 con HMAC).',
  },
  {
    id: 'buscar',
    question: '¿Puedo buscar un paciente por documento?',
    simple: 'Todavía no.',
    detailed: 'Los campos cifrados no se pueden buscar en SQL. Para buscar por documento hace falta un hash de búsqueda adicional, que todavía está pendiente.',
  },
  {
    id: 'soporte',
    question: '¿Qué pasa con lo que escribo a soporte?',
    simple: 'Se limpia antes de guardarse.',
    detailed: 'El mensaje enmascara correos, teléfonos, DNI y nombres de pacientes conocidos. No detecta todo dato clínico en texto libre, así que no escribas datos de pacientes.',
  },
  {
    id: 'sin-modulo',
    question: '¿Por qué no veo algún módulo?',
    simple: 'Depende de tu rol.',
    detailed: 'Cada módulo se habilita según el rol que te asignó tu agencia. Si necesitás acceso, pedíselo a un propietario o administrador.',
  },
  {
    id: 'privacidad',
    question: '¿Qué hace el modo privacidad?',
    simple: 'Oculta nombres y montos.',
    detailed: 'Difumina nombres y montos en pantalla con el ícono de ojo. Es útil si mostrás la pantalla a otra persona. Se puede desactivar con el mismo botón.',
  },
  {
    id: 'sin-senal',
    question: '¿Puedo trabajar sin señal?',
    simple: 'Solo en algunas pantallas.',
    detailed: 'El modo offline con sincronización automática está disponible en algunas pantallas. No todas las pantallas funcionan sin conexión todavía.',
  },
  {
    id: 'codigos',
    question: '¿Llegan los códigos de verificación por correo?',
    simple: 'El envío depende de la configuración.',
    detailed: 'El proveedor de correo (SMTP) todavía no está definido. En desarrollo, los códigos se muestran en consola. Hasta que se configure, los códigos no llegan a un correo real.',
  },
];
