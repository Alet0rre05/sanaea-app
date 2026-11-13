import { useState } from 'react';
import { MessageCircle, MessagesSquare, LifeBuoy, ShieldCheck, Send, Clock3, Info, CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';

type Channel = 'support' | 'context' | 'visit';

export function ChatsPage() {
  const [channel, setChannel] = useState<Channel>('support');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('timesheet');
  const [targetId, setTargetId] = useState('');
  const [visitId, setVisitId] = useState('');
  const [threadId, setThreadId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(''); setStatus('');
    if (!body.trim()) { setError('Escribí un mensaje antes de enviarlo.'); return; }
    setBusy(true);
    try {
      if (channel === 'support') {
        await api.post('/support/messages/', { body: body.trim(), known_names: [] });
        setStatus('Tu consulta fue enviada al equipo de soporte AJR Data.');
      } else if (channel === 'context') {
        if (!threadId && (!targetId.trim() || !title.trim())) throw new Error('Ingresá el ID del registro y un título para crear el hilo.');
        let activeThread = threadId;
        if (!activeThread) {
          const created = await api.post<{id:string}>('/context-threads/', {
            target_type: targetType, target_id: targetId.trim(), title: title.trim()
          });
          activeThread = created.data.id;
          setThreadId(activeThread);
        }
        await api.post(`/context-threads/${activeThread}/comments/`, { body: body.trim() });
        setStatus(`Comentario agregado al hilo ${activeThread}.`);
      } else {
        if (!visitId.trim()) throw new Error('Ingresá el identificador de la visita habilitada.');
        await api.post(`/visits/${visitId.trim()}/chat/`, { body: body.trim() });
        setStatus('Mensaje enviado a la conversación de la visita.');
      }
      setBody('');
    } catch (e) { setError(errorMessage(e, e instanceof Error ? e.message : 'No se pudo enviar el mensaje.')); }
    finally { setBusy(false); }
  };

  const channels = [
    { id:'support' as const, label:'Soporte AJR Data', icon:LifeBuoy, desc:'Consultas sobre el uso de Sanae.' },
    { id:'context' as const, label:'Comentarios internos', icon:MessagesSquare, desc:'Comentarios asociados a una planilla o liquidación.' },
    { id:'visit' as const, label:'Coordinación de visita', icon:MessageCircle, desc:'Mensajes logísticos entre prestador y familia.' },
  ];
  return <div className="page-stack">
    <header className="page-heading"><div><p className="eyebrow">COMUNICACIÓN</p><h1 className="font-display text-3xl font-extrabold">Centro de conversaciones</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Elegí un canal y enviá tu mensaje. Cada conversación respeta los permisos de tu perfil.</p></div>
      <span className="status-pill status-pill--green"><ShieldCheck size={15}/> Canales protegidos</span></header>
    <section className="chat-intro-panel"><div className="chat-intro-orb" aria-hidden="true"/><div className="relative z-10 max-w-2xl">
      <span className="eyebrow eyebrow--light">SANAE · COMUNICACIÓN</span><h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Hablar también es parte del cuidado.</h2>
      <p className="mt-2 text-sm leading-6 text-white/75">Usá el canal correcto para que tu consulta llegue al contexto adecuado.</p></div><div className="chat-intro-symbol"><MessageCircle size={42}/></div></section>
    <div className="grid gap-3 md:grid-cols-3">{channels.map(c=>{const Icon=c.icon;return <button key={c.id} type="button" onClick={()=>{setChannel(c.id);setError('');setStatus('');}} className={`card text-left transition hover:-translate-y-1 ${channel===c.id?'ring-2 ring-primary border-transparent':''}`}>
      <span className="feature-icon feature-icon--mint"><Icon size={21}/></span><span className="mt-4 block text-sm font-bold">{c.label}</span><span className="mt-1 block text-xs leading-5 text-muted">{c.desc}</span><span className="mt-3 block text-xs font-semibold text-primary">{channel===c.id?'Canal seleccionado':'Elegir canal →'}</span></button>})}</div>
    <section className="card space-y-4">
      <div className="flex items-center gap-2"><Send size={18} className="text-primary"/><h2 className="font-display text-lg font-bold">Nuevo mensaje · {channels.find(c=>c.id===channel)?.label}</h2></div>
      {channel==='context' && <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">Tipo de registro<select className="input mt-1" value={targetType} onChange={e=>setTargetType(e.target.value)}><option value="timesheet">Planilla</option><option value="settlement">Liquidación</option></select></label>
        <label className="text-xs font-semibold text-muted">ID del registro<input className="input mt-1" value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="UUID del registro" disabled={!!threadId}/></label>
        <label className="text-xs font-semibold text-muted sm:col-span-2">Título del hilo<input className="input mt-1" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Consulta sobre horas declaradas" disabled={!!threadId}/></label>
        {threadId && <p className="text-xs text-muted sm:col-span-2">Hilo activo: <code>{threadId}</code></p>}
      </div>}
      {channel==='visit' && <label className="block text-xs font-semibold text-muted">Identificador de visita habilitada<input className="input mt-1" value={visitId} onChange={e=>setVisitId(e.target.value)} placeholder="UUID de la visita"/></label>}
      <label className="block text-xs font-semibold text-muted">Tu mensaje<textarea className="input mt-1 min-h-28 resize-y" value={body} onChange={e=>setBody(e.target.value)} maxLength={channel==='context'?5000:channel==='visit'?2000:4000} placeholder={channel==='support'?'Contanos qué necesitás. No incluyas datos de pacientes.':'Escribí tu mensaje…'}/></label>
      {channel==='visit' && <p className="chat-safety-note">Solo coordinación logística. Urgencias: 107/911</p>}
      {channel==='support' && <p className="flex items-start gap-2 text-xs text-muted"><Info size={15}/> No incluyas nombres, diagnósticos ni información clínica de pacientes.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {status && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16}/>{status}</p>}
      <button type="button" className="btn-primary" disabled={busy || !body.trim()} onClick={()=>void submit()}>{busy?'Enviando…':'Enviar mensaje'} <Send size={15} className="ml-2"/></button>
    </section>
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface/70 p-4 text-xs leading-5 text-muted"><Clock3 size={17} className="mt-0.5 shrink-0"/> La coordinación con familia se habilita únicamente dentro de la ventana de la visita definida por el sistema (2 horas antes y después). Los mensajes se consultan desde su visita; esta pantalla permite iniciar un envío cuando tenés su identificador.</div>
  </div>;
}
