import React, { useState } from 'react';
import { WhatsAppIcon } from './SocialIcons';

export { WhatsAppIcon };

const WHATSAPP_URL = 'https://wa.me/393428077768?text=Ciao%20Chiara,%20vorrei%20informazioni%20sui%20corsi%20di%20Microblading';

export const FloatingWhatsAppButton: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside
      aria-label="Assistenza rapida WhatsApp"
      className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-50 flex items-center gap-3 select-none"
    >
      {/* Tooltip / Badge espandibile al passaggio del mouse */}
      <div
        className={`hidden sm:flex items-center bg-[#18181B] text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg border border-white/10 transition-all duration-300 pointer-events-none ${
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
        <span>Scrivici su WhatsApp</span>
      </div>

      {/* Pulsante Rotondo WhatsApp Flottante */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group flex items-center justify-center w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.4)] hover:shadow-[0_12px_32px_rgba(37,211,102,0.6)] hover:scale-108 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        aria-label="Contattaci direttamente su WhatsApp"
        title="Contattaci su WhatsApp Business"
      >
        {/* Radar ping animato di fondo per catturare l'attenzione in modo discreto */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-35 group-hover:opacity-60 animate-ping pointer-events-none" />

        {/* Icona WhatsApp */}
        <WhatsAppIcon className="w-7 h-7 sm:w-8 sm:h-8 relative z-10 transition-transform duration-300 group-hover:rotate-6" />
      </a>
    </aside>
  );
};
