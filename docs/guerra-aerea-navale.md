# Guerra aerea e navale

Schede **Aviazione** e **Marina** (pannelli in `game/js/panels/`). Le missioni si assegnano a
**regioni strategiche**: blocchi di terra e zone di mare generati dalla mappa (`buildRegions`).

## Aviazione
- **Stormi** da 50 aerei, basati su capitale e città controllate. Ogni missione richiede che il
  centro della regione sia entro l'autonomia (km) del modello.
- Missioni: superiorità aerea, intercettazione, appoggio ravvicinato (CAS), bombardamento
  strategico, attacco navale, pattugliamento navale.
- **Combattimento aereo**: attacco aereo, agilità (differenza = probabilità di colpire), difesa aerea;
  i caccia in superiorità attirano gli attacchi e scortano i bombardieri, l'intercettazione caccia i bombardieri.
- **Superiorità aerea**: chi non ce l'ha perde organizzazione ogni giorno in battaglia (fino a −35% di efficacia).
- **CAS**: danni a organizzazione e forza delle divisioni nemiche in battaglia nella regione.
- **Bombardamento strategico**: danneggia l'industria nemica (fino a −40%), che si ripara col tempo.
- **Designer**: telaio (1936/1940/1944) + moduli (armamento, bombe, razzi, siluri, serbatoi, corazzatura, motore, radar).
- **Produzione**: linee con fabbriche militari dedicate (tolte all'equipaggiamento terrestre) ed
  **efficienza** dal 10% al tetto del 50% (crescita = 0,001 / efficienza al giorno: veloce all'inizio, poi lenta).
  Cambiare modello conserva il 30% dell'efficienza se il ruolo è lo stesso. Se l'economia definisce
  `c.effCap` / `c.effRetention`, vengono usati quelli.

## Marina
- **Flotte** in porto o in una zona di mare, con missioni: pattugliamento, forza d'attacco, scorta
  convogli, guerra ai convogli, in porto. Rientro automatico per riparazioni sotto il 50% degli scafi.
- **Avvistamento**: rilevamento di superficie / sottomarino contro visibilità; il pattugliamento
  avvista 2,5 volte meglio, i bombardieri navali aiutano.
- **Battaglie** (4 scontri al giorno, fino a 3 giorni): linee di schermo (CT, CL), navi capitali (CA, BB),
  portaerei e sottomarini. **Screening**: servono 3 navi di scorta per nave capitale/portaerei, altrimenti
  siluri e cannoni leggeri arrivano alle navi capitali. **Corazza contro perforazione**: sotto la corazza
  il danno crolla (fino al 10%). I sottomarini vanno prima scoperti (rilevamento sottomarino, sonar).
- **Convogli**: servono al commercio (fabbisogno ∝ fabbriche) e al trasporto truppe; se mancano,
  fino a −25% di produzione. La guerra ai convogli li affonda nelle zone dove passa il traffico del
  nemico; le scorte li proteggono e contrattaccano i sottomarini.
- **Supremazia navale**: le divisioni che attraversano una zona dominata dal nemico rischiano di essere
  affondate; chi domina il mare vicino a una battaglia costiera bombarda le divisioni nemiche.
- **Cantieri navali** separati dalle fabbriche (si costruiscono dalla scheda Marina), max 15 per linea, niente efficienza.

## Aggancio agli altri sistemi
Il modulo non modifica `game.js`: avvolge `newGame`, `tick` ed `economy` al caricamento.
Funzioni utili per gli altri sistemi: `anAirShare(regione, paese)`, `anNavalShare(regione, paese)`,
`anIndustryMult(paese)`, `regionOfTile(casella)`, `anTechYear(paese, 'air'|'naval')` (la ricerca può
impostare `c.anTech = { air: 1940, naval: 1940 }`; senza, si usa l'anno corrente).
