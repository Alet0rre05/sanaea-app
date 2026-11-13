import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, ClipboardList, WalletCards, ArrowUpRight, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';

interface LegalDoc { id:string; title:string; version:number; kind:string }
interface Scan { id:string; status:string }
interface Settlement { id:string; status?:string; total?:string|number }

export function DocumentsPage() {
  const legal = useQuery({queryKey:['documents','legal'],queryFn:async()=> (await api.get<LegalDoc[]>('/legal/pending/')).data});
  const scans = useQuery({queryKey:['documents','scans'],queryFn:async()=> (await api.get<Scan[]>('/scans/')).data});
  const settlements = useQuery({queryKey:['documents','settlements'],queryFn:async()=> (await api.get<Settlement[]>('/settlements/')).data});
  const loading = legal.isLoading || scans.isLoading || settlements.isLoading;
  const error = legal.error || scans.error || settlements.error;
  const items = [
    {title:'Documentos legales',desc:'Versiones vigentes pendientes de lectura y aceptación.',count:legal.data?.length,icon:ShieldCheck,to:'/legal',tone:'violet'},
    {title:'Planillas digitalizadas',desc:'Archivos cargados y su estado de revisión.',count:scans.data?.length,icon:ClipboardList,to:'/scans',tone:'mint'},
    {title:'Liquidaciones',desc:'Registros de liquidación disponibles para tu perfil.',count:settlements.data?.length,icon:WalletCards,to:'/settlements',tone:'blue'},
  ];
  return <div className="page-stack">
    <header className="page-heading"><div><p className="eyebrow">ARCHIVO Y DOCUMENTACIÓN</p><h1 className="font-display text-3xl font-extrabold">Mis documentos</h1><p className="mt-2 text-sm text-muted">Un acceso central a los documentos y registros que tu cuenta tiene permiso para consultar.</p></div><span className="status-pill status-pill--green"><FolderOpen size={15}/> Espacio documental</span></header>
    <section className="grid gap-4 lg:grid-cols-3">{items.map(item=>{const Icon=item.icon;return <Link to={item.to} key={item.to} className="card feature-card group">
      <div className={`feature-icon feature-icon--${item.tone}`}><Icon size={22}/></div><div className="mt-5 flex items-center justify-between gap-2"><h2 className="font-display font-bold">{item.title}</h2><ArrowUpRight size={17} className="text-muted group-hover:text-primary"/></div>
      <p className="mt-2 text-sm leading-6 text-muted">{item.desc}</p><p className="mt-5 text-2xl font-extrabold tabular-nums">{loading?'—':item.count ?? '—'} <span className="text-xs font-medium text-muted">registros</span></p>
    </Link>})}</section>
    <section className="card space-y-3"><div className="flex items-center gap-2"><FileText size={18} className="text-primary"/><h2 className="font-display font-bold">Actividad documental</h2></div>
      {loading && <p className="text-sm text-muted">Consultando los documentos de tu cuenta…</p>}
      {error && <p role="alert" className="text-sm text-warning">No se pudo consultar alguna categoría. Revisá tu conexión o permisos e intentá nuevamente.</p>}
      {!loading && !error && <p className="text-sm leading-6 text-muted">Se encontraron {legal.data?.length ?? 0} documentos legales pendientes, {scans.data?.length ?? 0} planillas y {settlements.data?.length ?? 0} liquidaciones accesibles. Abrí cada sección para ver el detalle real.</p>}
      <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0"/> Sanae no completa esta biblioteca con archivos de ejemplo: solo se muestran registros devueltos por el servidor.</p>
    </section>
  </div>;
}
