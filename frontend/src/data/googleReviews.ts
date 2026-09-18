export interface GoogleReview {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  text: string;
  date: string;
}

export const GOOGLE_REVIEWS_DATA: GoogleReview[] = [
  {
    id: "70c54377-e751-4591-97ef-b2ce889c86ca",
    author: "Matilde",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocJTQh00M6xcKR2XVtmQNvXSZU5I88baD-7akODePqAZZ0IkbQ=s64-c-rp-mo-ba12-br100",
    rating: 5,
    text: "Grazie Chiara, sei veramente bravissima e molto gentile, con tanta esperienza e professionalità!! Affidatevi a lei per il microblading con tranquillità, siete in buone mani!",
    date: "Recensione verificata"
  },
  {
    id: "71aa9671-9fec-4a8e-8328-f41bd5fd6842",
    author: "Elisa M.",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjVg2tOlcH_tVJfYBqqDzhsMtWBsW0_4HRBbXOLhMalQ1ea1IFxvVw=s64-c-rp-mo-ba12-br100",
    rating: 5,
    text: "Sono davvero soddisfatta delle mie nuove sopracciglia! Non avevo mai fatto colorazioni o usato la matita, ma a distanza di pochi giorni l'effetto è assolutamente naturale e più passa il tempo più mi piacciono. Lo sguardo è lo stesso di prima, ma valorizzato da sopracciglia più folte e definite. Chi mi guarda ora non nota che ho fatto qualcosa, ho solo delle bellissime sopracciglia. A tornare indietro lo farei prima! Grazie ❤️",
    date: "Recensione verificata"
  },
  {
    id: "a0df4012-11b0-47dc-8841-b729128d7654",
    author: "Elisa Papini",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocKzpuXzpFmXv1FBLDDS4f6TvRVN13F7p_ObYCQ3NwHy5h9MaA=s64-c-rp-mo-br100",
    rating: 5,
    text: "Ho sempre temuto tantissimo di modificare parti del viso, ma le mie sopracciglia erano asimmetriche e sottili dagli anni 2000. Ho trovato Chiara su Instagram e dopo lo studio personalizzato effettuato su di me mi ha convinto la sua sicurezza. Lo rifarei altre mille volte. La migliore in assoluto ♥️",
    date: "Recensione verificata"
  },
  {
    id: "e48b5dfc-bee0-4bf3-aab7-5bf5a054ceaf",
    author: "Alessia Grendene",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocKApxynIUmdRhBY2XksYNoyNObz4K1-k9a5bCfT8SVnPAEojA=s64-c-rp-mo-br100",
    rating: 5,
    text: "Ho trovato Chiara guardando Instagram… ho visto i suoi lavori e avevo capito subito che era una professionista. A me ha fatto un vero miracolo! Preparatissima… è riuscita a cambiare completamente le mie sopracciglia che erano praticamente inesistenti! Un lavoro fatto meravigliosamente!! Brava Chiara, mi hai reso davvero felice!! La consiglio a tutti 😊",
    date: "Recensione verificata"
  },
  {
    id: "4f5a6710-c8f7-4624-81a5-e2f386a7c812",
    author: "Barbara Femiano",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocIVffJEowxCE2uoZLctDUm-aB1fBWr9dMYVqyG0Ktoux3_BiQ=s64-c-rp-mo-br100",
    rating: 5,
    text: "Ho conosciuto Chiara e mi sono fidata della sua professionalità consigliata da un'amica, e non mi sono affatto pentita! È stata molto comprensiva poiché ero scettica, mi ha spiegato nel dettaglio in cosa consisteva il microblading e mi sono affidata alle sue capacità! Fantastico risultato e fantastica lei!! Lo consiglio a chi come me ha impiegato anni a convincersi: fatelo subito!",
    date: "Recensione verificata"
  },
  {
    id: "3b45426b-50b7-4618-aacf-c9fe92a5755b",
    author: "Esther De",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjUcOS8vcGSauWBFLYYJ97JqMRpthtg82xogHvVQ-tpRjfh6T7TP=s64-c-rp-mo-br100",
    rating: 5,
    text: "Cercavo una professionista di microblading e ho trovato Chiara su Instagram per caso. Si è dimostrata da subito una VERA professionista e anche una persona empatica e sincera. Le mie sopracciglia erano un disastro: sottili e storte e lei ha saputo fare un vero e proprio miracolo, oltre al fatto che finalmente ho delle sopracciglia che mi valorizzano. Grazie Chiara.",
    date: "Recensione verificata"
  },
  {
    id: "96e75886-bb4b-4a91-a120-20c85e45996e",
    author: "Eva Licitra",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjWdFv02oOmE9O_j03q5bEbNl0YdYXB4jVyj6wp_HngJNcDEf1zk=s64-c-rp-mo-br100",
    rating: 5,
    text: "Ho trovato Chiara su Instagram e l'ho seguita per un po'. Ho visto la differenza con molte altre per la sua cura e attenzione ai dettagli. Mi sono trovata benissimo e a mio agio. È gentile e bravissima, una vera professionista. La consiglio a chiunque sia titubante... ho fatto il ritocco e mi vedo bellissima 🥰",
    date: "Recensione verificata"
  },
  {
    id: "e6cc02de-0fa8-48a3-ae93-7923f26a76d3",
    author: "Mr M",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocI-GfJhU2Ww15xhdXMsm2glVSoCTL9nc82KOEUE-7kVH9eMiQ=s64-c-rp-mo-ba12-br100",
    rating: 5,
    text: "Ho trovato Chiara per caso, posso dire che è stata una fortuna. Ho trovato professionalità, cortesia, attenzione alla persona e ai particolari. La consiglio a chi cerca una valida professionista. Grazie Chiara per il tuo splendido lavoro sulle mie sopracciglia.",
    date: "Recensione verificata"
  },
  {
    id: "5174eacd-66a8-4b17-ba29-7620dd8d98c6",
    author: "Moira Galimberti",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjUu_bgXSRiOcuUb0geu3lLxLaDoO38EsH774Z9yqC4uOs0VynrQ=s64-c-rp-mo-br100",
    rating: 5,
    text: "Dopo anni di ricerca finalmente ho trovato Chiara ed i suoi lavori mi hanno subito convinta! Precisa, empatica, paziente… ora la mattina risparmio un sacco di tempo 😄!!! Grazie mille!",
    date: "Recensione verificata"
  },
  {
    id: "5e5d3296-7ae2-4f22-8b5e-03819bca62ef",
    author: "Nadia Guarino",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocKY3HRvxkQZZd_t6tC0hc7vgbfIvUjGZh04SLliuaIelcm7KQ=s64-c-rp-mo-br100",
    rating: 5,
    text: "Chiara è una professionista bravissima. La sua tecnica, precisione e gentilezza sono da 5 stelle e più 😊",
    date: "Recensione verificata"
  },
  {
    id: "2ebcc1b6-05e4-42fc-85aa-c8abea7ebce3",
    author: "Daniela Oddo",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocIvSWCbV3axe2OeMAqlw4RZup5NcwL1rKwctRc1-azKCUr0tg=s64-c-rp-mo-br100",
    rating: 5,
    text: "Grazie alla professionale, dolcissima e disponibilissima Chiara dopo anni mi sono decisa e affidata a lei: ho fatto benissimo! Ora ho sopracciglia perfette e curate anche da struccata, basta un po' di rimmel e sono in ordine. Grazie 🥰",
    date: "Recensione verificata"
  },
  {
    id: "5d1117fa-aa70-4ff1-ab19-50fda031223d",
    author: "Vicky Volpe",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocKCNPBLZYK2rrBmW3nhHgR8uk0xN_SCnvbFL3mTmbBldwXTzw=s64-c-rp-mo-ba12-br100",
    rating: 5,
    text: "Ho trovato una persona molto professionale e che è riuscita a farmi sentire a mio agio fidandomi di lei. Bravissima davvero!",
    date: "Recensione verificata"
  },
  {
    id: "f6d76338-0d2c-4df5-b658-ff85c70cb46d",
    author: "Elisabetta Loiacono",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocJPx7sqFL5Nt8zhHMUsqIVf_6_WktKx6-2Tn8zACqKb5OaT9A=s64-c-rp-mo-br100",
    rating: 5,
    text: "Ho conosciuto Chiara, eccellente! Avevo le sopracciglia rovinate e lei mi ha ridato il sorriso... la consiglio a tutti davvero.",
    date: "Recensione verificata"
  },
  {
    id: "f2b2ce7d-3a0e-474a-890a-594d034abd8a",
    author: "Francisca Chilan",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjX7E8S9OGoEshqDkn0MDWHeuRFRVPc4En5L-PdRdI49UMJF1YiZRg=s64-c-rp-mo-br100",
    rating: 5,
    text: "Chiara è stata bravissima, mi sono trovata benissimo e sono contenta del lavoro che ha fatto. La consiglio sicuramente!",
    date: "Recensione verificata"
  },
  {
    id: "8f3a59d0-0c51-4471-944d-e63ce775b4b1",
    author: "Adele Trabucchi",
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjVtllM-gmdrmJQWbPUJpNDUcc6Yp_uCajEGU2-lU9qfomuohPHC=s64-c-rp-mo-ba12-br100",
    rating: 5,
    text: "Professionalità, gentilezza e perfezione assoluta!!",
    date: "Recensione verificata"
  }
];
