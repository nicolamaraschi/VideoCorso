import React from "react";

export const MarqueeBanner: React.FC = () => {
  const words = [
    { text: "MICROBLADING", type: "solid" },
    { text: "MASTERCLASS", type: "stroke" },
    { text: "CHIARA MOROCUTTI", type: "gold" },
    { text: "DERMOPIGMENTAZIONE", type: "solid" },
    { text: "ACCADEMIA", type: "stroke" },
    { text: "CORSO PROFESSIONALE", type: "solid" },
    { text: "ATTESTATO UFFICIALE", type: "rose" },
    { text: "TECNICA ESCLUSIVA", type: "stroke" },
    { text: "PRATICA REALE", type: "solid" },
    { text: "PIATTAFORMA H24", type: "gold" },
    { text: "RISULTATI CERTIFICATI", type: "solid" },
  ];

  const renderWord = (item: { text: string; type: string }, idx: number) => {
    let styleClass = "text-white";
    if (item.type === "stroke") {
      styleClass = "text-stroke-white font-extrabold";
    } else if (item.type === "gold") {
      styleClass = "text-[#E5C378] font-black drop-shadow-[0_0_15px_rgba(229,195,120,0.4)]";
    } else if (item.type === "rose") {
      styleClass = "text-[#E4B5BD] font-black drop-shadow-[0_0_15px_rgba(228,181,189,0.4)]";
    }

    return (
      <span key={idx} className="flex items-center gap-6 sm:gap-8 shrink-0">
        <span className={`tracking-tight font-black ${styleClass}`}>
          {item.text}
        </span>
        <span className="text-[#E5C378]/70 text-2xl sm:text-3xl font-normal select-none">
          ✦
        </span>
      </span>
    );
  };

  return (
    <div className="w-full bg-[#1e0d11] py-4 sm:py-5 overflow-hidden border-y border-[#381b21] relative z-20 shadow-2xl select-none">
      {/* Sfumature laterali */}
      <div className="absolute top-0 bottom-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-[#1e0d11] to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-[#1e0d11] to-transparent z-10 pointer-events-none" />

      {/* Traccia animata continua */}
      <div className="animate-marquee flex items-center gap-6 sm:gap-8 text-2xl sm:text-4xl md:text-5xl uppercase">
        <div className="flex items-center gap-6 sm:gap-8 shrink-0">
          {words.map((item, idx) => renderWord(item, idx))}
        </div>
        <div className="flex items-center gap-6 sm:gap-8 shrink-0" aria-hidden="true">
          {words.map((item, idx) => renderWord(item, idx + 100))}
        </div>
      </div>
    </div>
  );
};
