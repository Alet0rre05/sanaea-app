/** Roles tal como los devuelve la API (TenantRole y PlatformRole). */
export type RoleCode =
  | 'TENANT_OWNER'
  | 'TENANT_ADMIN'
  | 'TENANT_LIQUIDATOR'
  | 'TENANT_MEDICAL_AUDITOR'
  | 'TENANT_PROVIDER'
  | 'TENANT_FAMILY_CLIENT'
  | 'PLATFORM_SUPERADMIN'
  | 'PLATFORM_SUPPORT';

export const ROLE_LABEL: Record<RoleCode, string> = {
  TENANT_OWNER: 'Propietario de agencia',
  TENANT_ADMIN: 'Administrador de agencia',
  TENANT_LIQUIDATOR: 'Liquidador',
  TENANT_MEDICAL_AUDITOR: 'Auditor médico',
  TENANT_PROVIDER: 'Prestador',
  TENANT_FAMILY_CLIENT: 'Familiar',
  PLATFORM_SUPERADMIN: 'Superadmin de plataforma',
  PLATFORM_SUPPORT: 'Soporte de plataforma',
};

export interface TutorialStep {
  title: string;
  simple: string;
  detailed: string;
  /** Ruta de la sección donde se realiza el paso. */
  to?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  summary: { simple: string; detailed: string };
  /** 'ALL' significa visible para cualquier usuario autenticado. */
  roles: RoleCode[] | 'ALL';
  tone: 'mint' | 'blue' | 'violet' | 'amber';
  steps: TutorialStep[];
}

const BILLING: RoleCode[] = ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_LIQUIDATOR'];

export const TUTORIALS: Tutorial[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    summary: { simple: 'Recorré la pantalla de inicio.', detailed: 'Conocé el inicio, los modos de vista, los avisos y la privacidad de pantalla.' },
    roles: 'ALL',
    tone: 'mint',
    steps: [
      { title: 'Tu inicio', simple: 'Accesos y pendientes.', detailed: 'El inicio muestra tus pendientes, accesos directos y lo que corresponde a tu perfil.', to: '/' },
      { title: 'Elegí la vista', simple: 'Usá Simple o Detallada arriba.', detailed: 'Simple muestra lo esencial. Detallada agrega identificadores y contexto. Los textos se adaptan en cada pantalla.' },
      { title: 'Revisá los avisos', simple: 'La campana tiene lo pendiente.', detailed: 'La campana reúne avisos del sistema. Se marcan como leídos en este dispositivo.' },
      { title: 'Protegé la pantalla', simple: 'Activá el ojo para ocultar datos.', detailed: 'El modo privacidad difumina nombres y montos mientras mostrás la pantalla a otra persona.' },
    ],
  },
  {
    id: 'cuenta-segura',
    title: 'Cambiar email o usuario',
    summary: { simple: 'Cambiá datos con código.', detailed: 'Cambios sensibles requieren confirmar un código enviado al email de la cuenta.' },
    roles: 'ALL',
    tone: 'violet',
    steps: [
      { title: 'Abrí Mi cuenta', simple: 'Ícono de persona, arriba.', detailed: 'Desde la barra superior entrás a tus datos de acceso.', to: '/cuenta' },
      { title: 'Elegí el dato', simple: 'Email, respaldo o usuario.', detailed: 'Seleccioná qué querés cambiar y escribí el nuevo valor.' },
      { title: 'Confirmá el código', simple: 'Código de 6 dígitos.', detailed: 'Ingresá el código que llega al email de la cuenta. Sin el código no se aplica el cambio.' },
    ],
  },
  {
    id: 'cargar-planilla',
    title: 'Cargar una planilla',
    summary: { simple: 'Subí la foto y validá.', detailed: 'Subí la planilla, revisá la imagen y los datos en Split-Screen y validá.' },
    roles: ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_LIQUIDATOR', 'TENANT_PROVIDER'],
    tone: 'mint',
    steps: [
      { title: 'Subí la planilla', simple: 'Foto de la planilla física.', detailed: 'Desde Planillas, subí la imagen. Si la misma foto ya fue cargada, se detecta como duplicada.', to: '/scans' },
      { title: 'Revisá en Split-Screen', simple: 'Imagen y formulario juntos.', detailed: 'La mitad muestra la imagen con zoom y la otra mitad, el formulario editable.' },
      { title: 'Completá los campos', simple: 'Cargá los datos a mano.', detailed: 'Todavía no hay lectura automática: completá los campos con lo que dice la planilla.' },
      { title: 'Validá', simple: 'Confirmá la planilla.', detailed: 'Al validar, la planilla queda revisada y lista para liquidar.' },
    ],
  },
  {
    id: 'generar-liquidacion',
    title: 'Generar una liquidación',
    summary: { simple: 'Del borrador a la validación.', detailed: 'Generá el borrador, revisá líneas y total, y validá la liquidación.' },
    roles: BILLING,
    tone: 'blue',
    steps: [
      { title: 'Generá el borrador', simple: 'Botón Generar borrador.', detailed: 'Se calcula cada visita según el tarifario vigente.', to: '/settlements' },
      { title: 'Revisá el detalle', simple: 'Líneas y total.', detailed: 'Cada línea muestra el monto y su desglose: valor hora, recargos por feriado y por franja nocturna.' },
      { title: 'Validá', simple: 'Quedá cerrada.', detailed: 'Una liquidación validada no se modifica. Solo los borradores se regeneran.' },
    ],
  },
  {
    id: 'simulador-tarifas',
    title: 'Simulador de tarifas',
    summary: { simple: 'Calculá un monto estimado.', detailed: 'Probá cuánto saldría una visita con distintos horarios y feriados.' },
    roles: BILLING,
    tone: 'amber',
    steps: [
      { title: 'Elegí el tarifario', simple: 'ID del tarifario.', detailed: 'Indicá el tarifario que querés usar en la simulación.', to: '/' },
      { title: 'Cargá inicio y fin', simple: 'Horario de la visita.', detailed: 'Si la visita cruza medianoche, el cálculo lo contempla.' },
      { title: 'Marcá el feriado', simple: 'Si es feriado.', detailed: 'El recargo por feriado se aplica sobre todos los minutos de la visita.' },
    ],
  },
  {
    id: 'evolucion-diaria',
    title: 'Registrar una evolución',
    summary: { simple: 'Notas de la visita completada.', detailed: 'Registrá la evolución sobre una visita ya completada.' },
    roles: ['TENANT_PROVIDER', 'TENANT_MEDICAL_AUDITOR'],
    tone: 'violet',
    steps: [
      { title: 'Elegí la visita', simple: 'Solo visitas completadas.', detailed: 'Las evoluciones se registran sobre visitas que ya figuran como completadas.', to: '/evoluciones' },
      { title: 'Escribí la nota', simple: 'Texto breve y claro.', detailed: 'Describí lo que observaste y lo que hiciste durante la visita.' },
      { title: 'Guardá', simple: 'Queda con fecha.', detailed: 'Cada evolución queda con su fecha de registro y no se edita después.' },
    ],
  },
  {
    id: 'vinculo-familiar',
    title: 'Vincular a un familiar',
    summary: { simple: 'Alta y verificación del vínculo.', detailed: 'La agencia crea el vínculo y el familiar lo verifica con un código por correo.' },
    roles: ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_FAMILY_CLIENT'],
    tone: 'blue',
    steps: [
      { title: 'La agencia crea el vínculo', simple: 'Administración.', detailed: 'Propietario o administrador asigna el familiar al paciente.' },
      { title: 'El familiar pide el código', simple: 'Enviar código al correo.', detailed: 'Desde Vínculos, el familiar solicita el código de verificación.', to: '/vinculos' },
      { title: 'Ingresa el código', simple: 'Código de 6 dígitos.', detailed: 'Al verificarlo, el vínculo queda confirmado y se habilitan visitas y consentimientos.' },
    ],
  },
  {
    id: 'firmar-consentimiento',
    title: 'Firmar el consentimiento',
    summary: { simple: 'Firma en pantalla.', detailed: 'Firmá el documento vigente una vez verificado el vínculo.' },
    roles: ['TENANT_FAMILY_CLIENT'],
    tone: 'violet',
    steps: [
      { title: 'Elegí paciente y documento', simple: 'Dos selectores.', detailed: 'Solo aparecen pacientes con vínculo verificado.', to: '/consentimiento' },
      { title: 'Firmá en el recuadro', simple: 'Con el dedo o el mouse.', detailed: 'La firma se guarda como imagen junto con el documento y la fecha.' },
      { title: 'Guardá', simple: 'Queda registrada.', detailed: 'La firma queda registrada y no se puede editar.' },
    ],
  },
  {
    id: 'chat-visita',
    title: 'Chat de coordinación',
    summary: { simple: 'Logística de la visita.', detailed: 'El chat se abre 2 horas antes y después de la visita.' },
    roles: ['TENANT_PROVIDER', 'TENANT_FAMILY_CLIENT'],
    tone: 'blue',
    steps: [
      { title: 'Abrí el chat', simple: 'Desde Chat.', detailed: 'Solo se habilita en la ventana de la visita. Fuera de ella, se muestra cerrado.', to: '/chat' },
      { title: 'Solo logística', simple: 'Horarios y accesos.', detailed: 'El chat es para coordinar la visita. No reemplaza la historia clínica.' },
      { title: 'Urgencias', simple: '107 o 911.', detailed: 'En una urgencia, llamá al 107 o al 911. El chat no se usa para urgencias.' },
    ],
  },
  {
    id: 'baja-agencia',
    title: 'Dar de baja la agencia',
    summary: { simple: 'Acción del propietario.', detailed: 'Desactiva la agencia y deja registro inmutable. No borra datos.' },
    roles: ['TENANT_OWNER'],
    tone: 'amber',
    steps: [
      { title: 'Abrí Mi cuenta', simple: 'Sección de baja.', detailed: 'La baja está al final de Mi cuenta y solo la ve el propietario.', to: '/cuenta' },
      { title: 'Escribí el motivo', simple: 'Opcional.', detailed: 'El motivo queda registrado junto con la solicitud.' },
      { title: 'Confirmá el nombre', simple: 'Escribí el nombre de la agencia.', detailed: 'Sin el nombre exacto, el botón de baja no se habilita.' },
    ],
  },
  {
    id: 'soporte-ajr',
    title: 'Hablar con soporte',
    summary: { simple: 'Mensaje al equipo.', detailed: 'Escribí a AJR Data desde el widget de soporte, sin datos de pacientes.' },
    roles: 'ALL',
    tone: 'mint',
    steps: [
      { title: 'Abrí el widget', simple: 'Abajo a la derecha.', detailed: 'El widget de soporte está disponible en todas las pantallas.' },
      { title: 'Describí el problema', simple: 'Sin datos de pacientes.', detailed: 'Contá qué necesitás. No incluyas nombres, documentos ni datos clínicos.' },
      { title: 'Enviá', simple: 'Se sanitiza antes de guardarse.', detailed: 'El texto se limpia de correos, teléfonos y DNI. No detecta todo dato clínico en texto libre, por eso conviene no escribirlo.' },
    ],
  },
];

/**
 * Tutoriales visibles para el usuario.
 * El superadmin de plataforma ve todos; el resto, los de su rol y los generales.
 */
export function tutorialsFor(role: string | undefined, platformRole: string | null | undefined): Tutorial[] {
  if (platformRole === 'PLATFORM_SUPERADMIN') return TUTORIALS;
  return TUTORIALS.filter((tutorial) => tutorial.roles === 'ALL' || (role !== undefined && tutorial.roles.includes(role as RoleCode)));
}
