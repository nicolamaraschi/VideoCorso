import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Layers, 
  Compass, 
  Eye, 
  Rotate3d, 
  Maximize2, 
  Info
} from 'lucide-react';

interface Hotspot {
  id: string;
  x: number; // percentage
  y: number; // percentage
  title: string;
  subtitle: string;
  description: string;
  tag: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: 'head',
    x: 48,
    y: 31,
    title: 'La Testa del Sopracciglio',
    subtitle: 'Pelo a Pelo Iper-Realistico',
    description: 'Incisioni nano a 0.18mm con angolazione a 45° che replicano fedelmente la direzione naturale dei peli, evitando l\'effetto "tatuaggio finto" o blocco monolitico.',
    tag: 'Nano-Blade 0.18mm',
  },
  {
    id: 'arch',
    x: 65,
    y: 26,
    title: 'Il Punto di Slancio (Arco Aurea)',
    subtitle: 'Calcolo Proporzione Phi 1:1.618',
    description: 'Allineamento millimetrico sul piano cantale dell\'occhio: apre lo sguardo e conferisce un lifting visivo immediato senza stravolgere i lineamenti autentici.',
    tag: 'Formula Phi 1.618',
  },
  {
    id: 'tail',
    x: 82,
    y: 36,
    title: 'La Coda & Transizione di Pigmento',
    subtitle: 'Profondità e Durata Garantita',
    description: 'Rilascio controllato nel derma papillare: pigmenti organici privi di metalli pesanti che non virano mai al rosso o al grigio, con tenuta fino a 18 mesi.',
    tag: 'Tenuta 12-18 Mesi',
  },
];

export const Microblading3DShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 3D Tilt state
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  
  // Interactive features
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [activeMode, setActiveMode] = useState<'strokes' | 'phi' | 'depth'>('phi');
  const [isExploded, setIsExploded] = useState(false);
  const [isAutoOrbit, setIsAutoOrbit] = useState(true);

  // Auto-orbit cinematic animation when user is idle
  useEffect(() => {
    if (!isAutoOrbit || isHovered) return;
    
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.02;
      const x = Math.sin(angle) * 7;
      const y = Math.cos(angle * 0.8) * 11;
      setRotateX(-x);
      setRotateY(y);
      setGlarePos({
        x: 50 + Math.cos(angle) * 25,
        y: 50 + Math.sin(angle) * 25,
        opacity: 0.35,
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isAutoOrbit, isHovered]);

  // Mouse tilt tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Normalized coordinates from -1 to 1
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;
    
    // Smooth responsive tilt
    const rY = mouseX * 24; // degrees
    const rX = -mouseY * 20; // degrees
    
    setRotateX(rX);
    setRotateY(rY);
    
    // Specular glare reflection coordinates
    const glareX = ((e.clientX - rect.left) / width) * 100;
    const glareY = ((e.clientY - rect.top) / height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.7 });
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isAutoOrbit) {
      setRotateX(0);
      setRotateY(0);
      setGlarePos((prev) => ({ ...prev, opacity: 0 }));
    }
  };

  return (
    <section className="py-20 sm:py-28 bg-[#120508] relative overflow-hidden text-white border-y border-[#381b21] select-none">
      {/* Dynamic ambient gold background aura */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[500px] bg-gradient-to-b from-[#E5C378]/15 via-[#E4B5BD]/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-40 left-1/4 w-[500px] h-[400px] bg-[#E5C378]/10 blur-3xl pointer-events-none rounded-full" />

      <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2a1017] border border-[#E5C378]/40 text-[#E5C378] text-xs sm:text-sm font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(229,195,120,0.25)]">
            <Sparkles className="w-4 h-4 text-[#E5C378] animate-pulse" />
            <span>Esperienza Interattiva 3D</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-tight">
            L'Anatomia del <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E5C378] via-[#FFF3CD] to-[#E5C378]">Microblading 3D</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-gray-300 leading-relaxed font-light">
            Esplora da vicino l'architettura millimetrica del pelo a pelo e la proporzione aurea. 
            <span className="hidden sm:inline"> Muovi il cursore per ruotare la visuale in 3D e tocca i punti chiave per scoprire i segreti della tecnica.</span>
          </p>
        </div>

        {/* Toolbar Interattiva dei Controlli 3D */}
        <div className="flex flex-wrap items-center justify-between gap-4 max-w-5xl mx-auto mb-8 bg-[#1f0b11]/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-[#E5C378]/25 shadow-xl">
          
          {/* Modalità di Visualizzazione */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mr-2 hidden md:inline">
              Filtro Vista:
            </span>
            
            <button
              onClick={() => setActiveMode('phi')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'phi'
                  ? 'bg-gradient-to-r from-[#E5C378] to-[#d4af37] text-gray-950 shadow-[0_0_15px_rgba(229,195,120,0.4)]'
                  : 'bg-[#2a1017] text-gray-300 hover:text-white border border-[#E5C378]/20 hover:border-[#E5C378]/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Proporzione Aurea (Phi)</span>
            </button>

            <button
              onClick={() => setActiveMode('strokes')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'strokes'
                  ? 'bg-gradient-to-r from-[#E5C378] to-[#d4af37] text-gray-950 shadow-[0_0_15px_rgba(229,195,120,0.4)]'
                  : 'bg-[#2a1017] text-gray-300 hover:text-white border border-[#E5C378]/20 hover:border-[#E5C378]/50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Tecnica Pelo a Pelo</span>
            </button>

            <button
              onClick={() => setActiveMode('depth')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'depth'
                  ? 'bg-gradient-to-r from-[#E5C378] to-[#d4af37] text-gray-950 shadow-[0_0_15px_rgba(229,195,120,0.4)]'
                  : 'bg-[#2a1017] text-gray-300 hover:text-white border border-[#E5C378]/20 hover:border-[#E5C378]/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Profondità & Pigmenti</span>
            </button>
          </div>

          {/* Azioni 3D speciali: Auto-Orbita ed Esploso 3D */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setIsExploded(!isExploded)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isExploded
                  ? 'bg-[#E4B5BD] text-gray-950 border-[#E4B5BD] shadow-[0_0_12px_rgba(228,181,189,0.5)]'
                  : 'bg-[#2a1017] text-gray-300 hover:text-white border-[#E5C378]/20'
              }`}
              title="Separa i livelli fisici di lavoro in profondità 3D"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isExploded ? 'Livelli Compatti' : 'Vista Esplosa 3D'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAutoOrbit(!isAutoOrbit)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isAutoOrbit
                  ? 'bg-[#2a1217] text-[#E5C378] border-[#E5C378]/40'
                  : 'bg-[#18090d] text-gray-400 border-gray-800'
              }`}
              title="Attiva/Disattiva rotazione automatica cinematica"
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>Auto 3D</span>
            </button>
          </div>

        </div>

        {/* 3D VIEWPORT CONTAINER */}
        <div 
          className="max-w-5xl mx-auto"
          style={{ perspective: '1400px' }}
        >
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative w-full aspect-[16/9] min-h-[360px] sm:min-h-[460px] md:min-h-[540px] rounded-3xl cursor-grab active:cursor-grabbing transition-transform duration-100 ease-out select-none"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`,
            }}
          >
            
            {/* LAYER 0: BASE CARD & OBSIDIAN GLOW (Depth: 0px) */}
            <div 
              className="absolute inset-0 rounded-3xl bg-[#19090e] border-2 border-[#E5C378]/40 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(229,195,120,0.15)] overflow-hidden"
              style={{ transform: 'translateZ(0px)' }}
            >
              {/* Immagine Macro Artwork HD */}
              <img
                src="/images/microblading-3d-showcase.jpg"
                alt="Microblading 3D Precisione Chiara Morocutti"
                className={`w-full h-full object-cover object-center transition-all duration-700 ${
                  activeMode === 'depth' ? 'contrast-125 saturate-150 filter' : ''
                }`}
              />

              {/* Sfumatura luxury cinematica */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#120508]/90 via-transparent to-[#120508]/40 pointer-events-none" />

              {/* Specular Glare Holographic Reflection */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle 400px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 235, 175, ${glarePos.opacity * 0.45}), transparent 70%)`,
                }}
              />
            </div>

            {/* LAYER 1: GOLDEN RATIO OVERLAY (Depth: 35px o 85px in Exploded) */}
            <div
              className={`absolute inset-0 pointer-events-none transition-transform duration-500 ${
                activeMode === 'phi' ? 'opacity-100' : 'opacity-20'
              }`}
              style={{
                transform: `translateZ(${isExploded ? '90px' : '35px'})`,
                transformStyle: 'preserve-3d',
              }}
            >
              <svg className="w-full h-full" viewBox="0 0 1920 1080" fill="none">
                {/* Geometria Aurea Dinamica */}
                <circle cx="1250" cy="380" r="140" stroke="#E5C378" strokeWidth="2" strokeDasharray="6 6" opacity="0.6" />
                <line x1="820" y1="440" x2="1550" y2="390" stroke="#E5C378" strokeWidth="1.5" strokeOpacity="0.4" />
                <line x1="1250" y1="240" x2="1250" y2="520" stroke="#E5C378" strokeWidth="1.5" strokeOpacity="0.4" />
                <path d="M 820 440 Q 1200 220 1550 400" stroke="#E5C378" strokeWidth="3" fill="none" opacity="0.8" className="filter drop-shadow-[0_0_8px_rgba(229,195,120,0.8)]" />
              </svg>
            </div>

            {/* LAYER 2: INTERACTIVE 3D HOTSPOTS (Depth: 65px o 140px in Exploded) */}
            <div
              className="absolute inset-0 pointer-events-auto"
              style={{
                transform: `translateZ(${isExploded ? '150px' : '65px'})`,
                transformStyle: 'preserve-3d',
              }}
            >
              {HOTSPOTS.map((spot) => (
                <div
                  key={spot.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  onClick={() => setActiveHotspot(activeHotspot?.id === spot.id ? null : spot)}
                >
                  {/* Pin Glowing 3D Pulse */}
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-8 h-8 rounded-full bg-[#E5C378]/30 animate-ping pointer-events-none" />
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#E5C378] to-[#FFF3CD] text-[#120508] flex items-center justify-center font-bold text-xs shadow-[0_0_20px_rgba(229,195,120,0.9)] border-2 border-[#120508] hover:scale-125 transition-transform duration-200">
                      ✦
                    </span>
                  </div>

                  {/* Hotspot Floating Label */}
                  <div className="mt-2 px-2.5 py-1 rounded-full bg-[#1b080f]/90 backdrop-blur-md border border-[#E5C378]/40 text-[10px] sm:text-xs font-bold text-[#E5C378] whitespace-nowrap shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all">
                    {spot.tag}
                  </div>
                </div>
              ))}
            </div>

            {/* LAYER 3: FLOATING 3D CORNER BADGES (Depth: 95px o 200px in Exploded) */}
            <div
              className="absolute inset-0 pointer-events-none p-4 sm:p-8 flex flex-col justify-between"
              style={{
                transform: `translateZ(${isExploded ? '210px' : '95px'})`,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Badge Top Left */}
              <div className="self-start inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-[#1b080f]/85 backdrop-blur-md border border-[#E5C378]/50 shadow-2xl text-xs sm:text-sm font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Microblading Masterclass</span>
                <span className="text-[#E5C378] text-xs font-mono">| 100% Pelo a Pelo</span>
              </div>

              {/* Badge Bottom Left */}
              <div className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 text-xs text-gray-300">
                <Info className="w-3.5 h-3.5 text-[#E5C378]" />
                <span>Trascina con il mouse per esplorare in 3D</span>
              </div>
            </div>

          </div>
        </div>

        {/* MODAL DETTAGLIO PUNTO CHIAVE (Quando un hotspot viene cliccato) */}
        <AnimatePresence>
          {activeHotspot && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="max-w-2xl mx-auto mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#1f0b12] to-[#2a0e18] border border-[#E5C378]/40 shadow-2xl relative"
            >
              <button
                onClick={() => setActiveHotspot(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E5C378]/20 border border-[#E5C378]/50 flex items-center justify-center text-[#E5C378] shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>

                <div>
                  <div className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#E5C378] bg-[#E5C378]/10 px-2.5 py-0.5 rounded-full mb-1">
                    {activeHotspot.tag}
                  </div>
                  <h3 className="text-xl font-serif font-bold text-white">
                    {activeHotspot.title}
                  </h3>
                  <p className="text-sm font-semibold text-[#E4B5BD] mt-0.5">
                    {activeHotspot.subtitle}
                  </p>
                  <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                    {activeHotspot.description}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3 CARD METRICHE INFORMATIVE SOTTOSTANTI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
          <div className="p-6 rounded-2xl bg-[#1b080f]/60 border border-[#381b21] hover:border-[#E5C378]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#2a1017] border border-[#E5C378]/30 flex items-center justify-center text-[#E5C378] mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-base">Architettura del Volto</h4>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Il microblading di Chiara non si basa su stencil uguali per tutte, ma sull'analisi morfologica e proporzionale unica di ogni cliente.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#1b080f]/60 border border-[#381b21] hover:border-[#E5C378]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#2a1017] border border-[#E5C378]/30 flex items-center justify-center text-[#E5C378] mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-base">Incisioni Ultra-Sottili</h4>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Lame monouso calibrate per depositare il pigmento alla profondità corretta senza provocare cicatrici né migrazioni di colore nel tempo.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#1b080f]/60 border border-[#381b21] hover:border-[#E5C378]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#2a1017] border border-[#E5C378]/30 flex items-center justify-center text-[#E5C378] mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-base">Metodo Insegnato Passo-Passo</h4>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Nei 10 moduli del videocorso ogni passaggio pratico è ripreso in macro 4K da diverse angolazioni per apprendere come fossi in cabina.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Microblading3DShowcase;
