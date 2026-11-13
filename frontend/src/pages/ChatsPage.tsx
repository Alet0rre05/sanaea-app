import { MessageCircle, MessagesSquare, LifeBuoy, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';

const modes = [
  { icon: MessageCircle, title: 'Coordinación de visitas', text: 'Conversaciones operativas entre enfermería y familia, vinculadas a una visita.', detail: 'Disponible dentro de cada visita habilitada.', tone: 'mint' },
  { icon: MessagesSquare, title: 'Comentarios internos', text: 'Hilos contextuales para conversar sobre planillas y liquidaciones.', detail: 'Se vinculan al registro correspondiente.', tone: 'blue' },
  { icon: LifeBuoy, title: 'Soporte AJR Data', text: 'Canal de asistencia para consultas sobre el uso de la plataforma.', detail: 'Usá el acceso flotante de soporte para enviar un mensaje.', tone: 'violet' },
];

export function ChatsPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div><p className="eyebrow">COMUNICACIÓN</p><h1 className="font-display text-3xl font-extrabold tracking-tight">Centro de conversaciones</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Cada conversación conserva su contexto y respeta los permisos del perfil activo.</p></div>
        <span className="status-pill status-pill--green"><ShieldCheck size={15} /> Comunicación protegida</span>
      </header>
      <section className="chat-intro-panel">
        <div className="chat-intro-orb" aria-hidden="true" />
        <div className="relative z-10 max-w-2xl"><span className="eyebrow eyebrow--light">SANAE · CONECTADOS</span>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">La coordinación también es cuidado.</h2>
          <p className="mt-2 text-sm leading-6 text-white/75">Elegí el canal adecuado para cada necesidad. Los mensajes operativos se mantienen separados de la información clínica y de los datos de facturación.</p>
        </div>
        <div className="chat-intro-symbol" aria-hidden="true"><MessageCircle size={42} /></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {modes.map(({ icon: Icon, title, text, detail, tone }) => <article className="card feature-card" key={title}>
          <div className={`feature-icon feature-icon--${tone}`}><Icon size={21} /></div><h3 className="mt-5 text-base font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
          <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-xs text-muted"><Clock3 size={15} className="mt-0.5 shrink-0" /><span>{detail}</span></div>
        </article>)}
      </div>
      <section className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="feature-icon feature-icon--neutral"><LockKeyhole size={20} /></div>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Bandeja general de mensajes</h3>
          <p className="mt-1 text-sm text-muted">La API actual permite abrir chats operativos por visita y comentarios por registro. Todavía no expone una bandeja unificada; por eso no mostramos mensajes ficticios.</p></div>
        <span className="status-pill status-pill--amber">En preparación</span>
      </section>
      <p className="chat-safety-note">Solo coordinación logística. Urgencias: 107/911</p>
    </div>
  );
}
