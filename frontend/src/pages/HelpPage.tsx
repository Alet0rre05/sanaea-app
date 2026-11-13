import type { CSSProperties } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { FAQS } from '../content/faqs';
import { Adaptive } from '../components/ui/Adaptive';

/** Preguntas frecuentes desplegables. Las respuestas cambian con la Vista simple o detallada. */
export function HelpPage() {

  return (
    <div className="bento">
      <section className="card bento-in col-span-12 xl:col-span-5 space-y-3" style={{ '--i': 0 } as CSSProperties}>
        <span className="feature-icon feature-icon--blue"><CircleHelp size={20} /></span>
        <h1 className="font-display text-xl font-bold tracking-tight">Preguntas frecuentes</h1>
        <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Respuestas cortas sobre cómo funciona Sanae." detailed="Respuestas sobre cálculos, permisos, privacidad y estado de cada función. Lo que todavía está pendiente se indica como pendiente." />
      </section>

      <div className="col-span-12 xl:col-span-7 space-y-3">
        {FAQS.map((faq, index) => (
          <Disclosure key={faq.id} as="div" defaultOpen={index === 0}
            className="card bento-in p-0 overflow-hidden" style={{ '--i': index + 1 } as CSSProperties}>
            {({ open }) => (
              <>
                <DisclosureButton className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-sm font-semibold">{faq.question}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                </DisclosureButton>
                <DisclosurePanel className="faq-panel px-5 pb-4">
                  <Adaptive as="p" className="text-sm leading-6 text-muted" simple={faq.simple} detailed={faq.detailed} />
                </DisclosurePanel>
              </>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
