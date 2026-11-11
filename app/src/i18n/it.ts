// The Italian text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), in the Italian of
// Italy, whose conventions the dates and numbers follow too (see `index.ts`). It speaks to the player as "tu", as FM's
// Italian does ("Vuoi davvero…"). The comments in `en.ts` say what each string is for.
//
// The football words are the game's own: FM27 keeps every language in `languages.fmf`, and matching its English and
// Italian strings by key names attributes, positions, traits, clauses, squad statuses and jobs as the Italian game
// does ("Finalizzazione", "Abilità attuale", "Forma partita", "Svincolato"). The editor's own text is translated here.
//
// Italian puts the plural after every number but 1 ("0 modifiche", "1 modifica"), and the words after a count agree
// with its noun in gender and number ("1 modifica applicata", "3 modifiche applicate"; "1 giocatore escluso", "3
// giocatori esclusi"), so the sentences with a count are written out for one and for many.

import type { Entity } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("it-IT");
const percents = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12.345". */
const format = (value: number) => numbers.format(value);

/** "0 modifiche", "1 modifica", "12.345 modifiche". A change is feminine: "modifica applicata". */
const changes = (count: number) => (count === 1 ? "1 modifica" : `${format(count)} modifiche`);

/** For the places that say how many changes there are, which may be none: "Nessuna modifica", "3 modifiche". */
const changeCount = (count: number) => (count === 0 ? "Nessuna modifica" : changes(count));

/** "1 giocatore", "12 giocatori". */
const playerCount = (count: number) => (count === 1 ? "1 giocatore" : `${format(count)} giocatori`);

/** "1 valore lasciato invariato", "12 valori lasciati invariati". */
const valuesLeftAlone = (count: number) =>
  count === 1 ? "1 valore lasciato invariato" : `${format(count)} valori lasciati invariati`;

/**
 * What each list holds, for one and for many, and whether the words around it are feminine. A club is a "società", as
 * the Italian game calls it: feminine, and the same in the plural.
 */
const nouns: Record<Entity, { one: string; many: string; feminine: boolean }> = {
  player: { one: "giocatore", many: "giocatori", feminine: false },
  staff: { one: "membro dello staff", many: "membri dello staff", feminine: false },
  club: { one: "società", many: "società", feminine: true },
};

/** "237 giocatori", "1 membro dello staff", "12 società". */
const entityCount = (entity: Entity, count: number) =>
  `${format(count)} ${count === 1 ? nouns[entity].one : nouns[entity].many}`;

/** The ending of a masculine word after a count: "1 giocatore escluso", "3 giocatori esclusi". */
const masculine = (count: number) => (count === 1 ? "o" : "i");

/** The same for a feminine word: "1 modifica annullata", "3 modifiche annullate". */
const feminine = (count: number) => (count === 1 ? "a" : "e");

/** The ending of a word that agrees with what a list holds: "3 giocatori mostrati", "3 società mostrate". */
const agreeing = (entity: Entity, count: number) => (nouns[entity].feminine ? feminine(count) : masculine(count));

/** Squad statuses, by the codes contracts hold them as (see `en.ts`); named as the game's Italian text names them. */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Stella",
  2: "Giocatore importante",
  3: "Titolare fisso",
  4: "Elemento della rosa",
  5: "Riserva di lusso",
  7: "Giocatore marginale",
  9: "Riserva d'emergenza",
  10: "Potenziale campione",
  11: "Promessa",
  13: "Giovane",
  14: "Titolare della squadra B",
  15: "Portiere titolare",
  16: "Portiere di coppa",
  17: "Portiere per le coppe nazionali",
  20: "Riserva",
  21: "Riserva d'emergenza (portiere)",
  22: "In esubero",
};

/** The kinds of contract (see `en.ts`). */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Contratto part-time",
  1: "Contratto a tempo pieno",
  2: "Contratto dilettantistico",
  3: "Contratto giovanile",
  4: "Senza contratto",
  10: "Contratto senior a salario minimo",
  11: "Contratto senior",
};

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(it, key ?? "");

/** The noun of the kind of record a failure names, or "record" when it names none. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity].one : "record";

/** Whether that noun is feminine, as "società" is. */
const recordFeminine = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity].feminine : false;

/** The reasons the Rust side gives for a field that cannot be changed some way. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "una data si può solo impostare",
  "it is changed one person at a time": "si cambia una persona alla volta",
  "the new value is not one of the game's own records of that kind":
    "il nuovo valore non è uno dei record del gioco di quel tipo",
  "the in-game date is not known": "la data del gioco non è nota",
};

const reload = "ricarica i dati e riprova";

/** The lists of a club's staff, as `staff.noRoom` names them. */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "dello staff medico",
  coaching: "dello staff tecnico",
  scouting: "degli osservatori",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as (see `en.ts`); named as the game's
 * Italian contract screen names them where it has the kind.
 */
const CLAUSE_NAMES_IT: Partial<Record<number, string>> = {
  0: "Clausola di rescissione",
  1: "Rescissione in caso di retrocessione",
  2: "Rescissione per mancata promozione",
  3: "Aumento annuale di stipendio",
  4: "Aumento stipendio in caso di promozione",
  5: "Riduzione stipendio per retrocessione",
  6: "Rescissione per offerte di lavoro come staff",
  8: "Percentuale del valore della cessione",
  9: "Percentuale del guadagno della cessione",
  10: "Bonus per numero minimo di gol a stagione",
  11: "Proroga di un anno dopo presenze in campionato (ultima stagione)",
  12: "Clausola adeguamento all'ingaggio migliore",
  13: "Stipendio dopo un numero minimo di partite di campionato con la squadra",
  14: "Aumento di stipendio in caso di promozione in una serie maggiore",
  15: "Riduzione stipendio per retrocessione da una serie maggiore",
  16: "Clausola di rescissione (società straniere)",
  17: "Clausola di rescissione (società nazionali di serie superiore)",
  18: "Clausola di rescissione (società nazionali)",
  19: "Ingaggio dopo aver raggiunto il tetto di presenze in Nazionale",
  20: "Percentuale degli stipendi coperta dagli sponsor",
  21: "Percentuale dell'incasso dovuta al giocatore",
  22: "Opzione per il club di prolungare il contratto",
  23: "Rinuncia del club all'indennizzo per un ruolo da allenatore",
  25: "Proroga di un anno dopo presenze in campionato (promozione nell'ultima stagione)",
  26: "Proroga di un anno dopo presenze in campionato (salvezza nell'ultima stagione)",
  27: "Clausola di rescissione (società in UEFA Champions League)",
  28: "Clausola di contratto garantito MLS",
  29: "Prolungamento contratto dopo promozione",
  30: "Clausola rescissoria infortunio",
  31: "Clausola di rescissione (società in una competizione continentale)",
  32: "Premio presenza",
  33: "Bonus per gol segnato",
  34: "Bonus per porta inviolata",
  37: "Bonus presenza in Nazionale",
  38: "Bonus per presenza in panchina",
  39: "Bonus per gli assist",
  40: "Bonus per numero minimo di assist a stagione",
  41: "Bonus per numero minimo complessivo di gol e assist a stagione",
  54: "Non mostrata nel gioco (54)",
  55: "Rescissione in caso di retrocessione attivata",
  56: "Rescissione per mancata promozione attivata",
  58: "Non mostrata nel gioco (58)",
  63: "Non mostrata nel gioco (63)",
};

/** Reasons to be unhappy, by the codes the game keeps them as (see `en.ts`). */
const CONCERN_MOTIVES_IT: Partial<Record<number, string>> = {
  596: "Escluso dalla lista di una competizione",
  808: "Pensa che un compagno sia stato trattato ingiustamente",
  926: "Non crede che un compagno meriti il minutaggio che vuole",
};

/** Players' traits (preferred moves), by their bit in the game's mask (see `en.ts`); the game's Italian names. */
const TRAIT_NAMES_IT: readonly string[] = [
  "Corre con la palla verso sinistra",
  "Corre con la palla verso destra",
  "Corre con la palla per vie centrali",
  "Entra nell'area avversaria",
  "Si muove negli spazi",
  "Va avanti appena possibile",
  "Fa passaggi corti e semplici",
  "Prova spesso il passaggio decisivo",
  "Tira dalla distanza",
  "Tira con potenza",
  "Tira piazzando la palla",
  "Calcia ad effetto",
  "Ama scartare il portiere",
  "Gioca sul filo del fuorigioco",
  "Usa l'esterno del piede",
  "Marca in maniera asfissiante l'avversario",
  "Cerca di infastidire gli avversari",
  "Si lamenta con l'arbitro",
  "Gioca spalle alla porta",
  "Torna a prendere il pallone",
  "Abile negli uno-due",
  "Ama fare i pallonetti al portiere",
  "Detta i tempi",
  "Tenta le rovesciate",
  "Cerca il passaggio più della conclusione personale",
  "Non gioca palloni in profondità",
  "Cerca di addormentare il gioco",
  "Allunga per superare l'avversario",
  "Mette la palla sul destro prima di dribblare",
  "Mette la palla sul sinistro prima di dribblare",
  "Gestisce il pallone",
  "Arriva tardi nell'area avversaria",
  "Rischia il possesso invece di spazzare",
  "Sta sempre in difesa",
  "Evita di usare il piede debole",
  "Prova finte e giocate per scartare l'avversario",
  "Prova le punizioni dalla lunga distanza",
  "Entra deciso nei contrasti",
  "Temporeggia nei contrasti",
  "Si accentra",
  "Gioca sulle fasce",
  "Chiede il sostegno dei tifosi",
  "Tenta i tiri di prima",
  "Prova i passaggi lunghi",
  "Ama ricevere la palla sui piedi",
  "Calcia le punizioni con potenza",
  "Ama continuare a scartare l'avversario",
  "Ama cambiare gioco sull'altra fascia",
  "Si ritirerà all'apice",
  "Giocherà a calcio finché possibile",
  "Sa sparare fucilate",
  "Corre spesso con la palla",
  "Corre raramente con la palla",
  "Cerca di migliorare il piede debole",
  "Punta di riferimento statica",
  "Usa rimesse lunghe per far partire il contropiede",
  "Non tira da lontano",
  "Si accentra dalla fascia sinistra palla al piede",
  "Si accentra dalla fascia destra palla al piede",
  "Cross anticipati",
  "Esce palla al piede dalla difesa",
  "Gioca la palla con i piedi",
];

/** What a check is about, from the key a failure gives, with a capital. */
const checkName = (key: string | undefined) => {
  const name = (it.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) => (it.jobs as Partial<Record<number, string>>)[Number(code)] ?? code;

const errors: ErrorTexts = {
  "guard.unknownBuild": () =>
    "FMLibreEditor non è stato verificato con questa versione del gioco, quindi non vi scrive. «Modifica comunque», " +
    "nell'avviso in alto, attiva la modifica.",
  "guard.failed": (p) =>
    `${checkName(p.check)}: non hanno superato i controlli in questa versione del gioco, quindi FMLibreEditor non ` +
    "li cambia.",
  "guard.saveChanged": () =>
    "Il gioco ha caricato un salvataggio, o è tornato al menu principale, da quando FMLibreEditor lo ha letto, quindi " +
    "non cambia nulla finché non ricarichi i dati.",
  "edit.unknownField": (p) => `Qui non c'è nessun campo modificabile chiamato «${p.field}».`,
  "edit.outOfRange": (p) => `${p.value} non è un valore valido per ${field(p.field)}: accetta da ${p.min} a ${p.max}.`,
  "edit.notADate": (p) => `${p.value} non è una data valida per ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} non è uno dei valori che ${field(p.field)} accetta.`,
  "edit.taken": (p) =>
    `Il numero di maglia ${p.value} è già occupato: lo indossa ${p.name ?? `il giocatore con UID ${p.uid}`}.`,
  "edit.unsupported": (p) => `${field(p.field)} non si può cambiare così: ${UNSUPPORTED[p.reason] ?? p.reason}.`,
  "edit.moved": (p) => `${recordFeminine(p.entity) ? "Questa" : "Questo"} ${recordNoun(p.entity)} si è spostat${recordFeminine(p.entity) ? "a" : "o"} ` +
    `nella memoria del gioco; ${reload}.`,
  "edit.noRecord": (p) =>
    `${field(p.field)} non si può cambiare qui: il suo record manca o non supera il controllo.`,
  "edit.unset": (p) => `${field(p.field)} non è impostato nel gioco, quindi non è stato toccato.`,
  "edit.implausible": (p) =>
    `${field(p.field)} vale ${p.value}, un valore che non può avere; per sicurezza non è stato toccato.`,
  "edit.notApplied": (p) => `${field(p.field)}: è stato scritto ${p.wrote}, ma rileggendolo vale ${p.read}.`,
  "edit.conflict": (p) =>
    `${field(p.field)} ora vale ${p.found}, non ${p.expected}: il gioco l'ha cambiato nel frattempo.`,
  "move.moved": () => `Il giocatore si è spostato nella memoria del gioco; ${reload}.`,
  "move.notAClub": () => "Questa società non ha una prima squadra in cui il giocatore possa entrare.",
  "move.freeAgent": () => "Il giocatore è svincolato: non ha una società da lasciare né con cui fare uno scambio.",
  "move.sameClub": () => "Il giocatore è già in questa società.",
  "move.onLoan": () =>
    "Il giocatore è in prestito: richiamalo prima o rendi definitivo il prestito, nella parte Prestito del suo profilo.",
  "move.notOnLoan": () => "Il giocatore non è in prestito.",
  "move.playerCoach": () =>
    "I giocatori-allenatori non si possono trasferire: lavorano anche come membri dello staff.",
  "move.unusualContract": () => "Il contratto del giocatore non è un normale contratto da giocatore.",
  "move.humanClub": () =>
    "Il giocatore è in una società gestita da un allenatore umano. In questa versione del gioco l'editor non trova ancora " +
    "le formazioni della società, quindi può lasciare la società solo dal gioco stesso.",
  "move.menAndWomen": () => "Una delle società è maschile e l'altra femminile.",
  "move.notListed": () => "Le liste della rosa non hanno il giocatore dove dovrebbero.",
  "move.noRoom": (p) =>
    `La lista della rosa della società non ha posto per un altro giocatore (ora ${p.players}) e l'editor non può ` +
    "ingrandirla su questo sistema.",
  "sign.noPool": () =>
    "L'editor non trova dove il gioco tiene i suoi contratti in questa versione, quindi non può darne uno a uno " +
    "svincolato.",
  "sign.poolFull": () =>
    "Il gioco non ha posto per un altro contratto finché non ne crea uno lui, come fa con il passare dei giorni: " +
    "continua di un giorno nel gioco e riprova.",
  "sign.noModel": () =>
    "La società non ha in prima squadra nessun giocatore con un contratto normale su cui modellare quello nuovo.",
  "sign.noDate": () => "L'editor non riesce a leggere la data del gioco, da cui parte il nuovo contratto.",
  "move.outOfRange": (p) => `${p.value} non è un valore valido per ${field(p.field)}: accetta da ${p.min} a ${p.max}.`,
  "move.changed": () => `Il gioco ha cambiato quella memoria nel frattempo; ${reload}.`,
  "move.notApplied": () => "La memoria è stata scritta, ma rileggendola contiene altro.",
  "retirement.unknown": () => "L'editor non trova i ritiri previsti in questa versione del gioco.",
  "retirement.none": () =>
    "Il gioco non ha previsto il ritiro di questo giocatore, che vuole già continuare a giocare.",
  "clause.noContract": () => "Il giocatore non ha un contratto.",
  "clause.missing": () => `Questa clausola non è più nel contratto; ${reload}.`,
  "clause.notInClause": (p) =>
    `Questa clausola non ha ${p.field === "clause.amount" ? "un importo" : "una condizione"} da cambiare.`,
  "clause.same": () => "Il contratto ha già questo.",
  "clause.noRoom": () =>
    "La lista delle clausole del contratto non ha posto e l'editor non può ingrandirla; cambia invece una clausola.",
  "heal.notInjured": () => "Il giocatore non ha nessun infortunio da guarire.",
  "ban.notBanned": () => "Il giocatore non ha nessuna squalifica da revocare.",
  "relation.missing": () => `Quella nazionalità o formazione non è più nella lista del giocatore; ${reload}.`,
  "relation.noRoom": () =>
    "La lista del giocatore non ha posto e l'editor non può ingrandirla; cambia invece una delle sue voci.",
  "relation.target": () => "Non è una nazione né una società del gioco del tipo che questa voce accetta.",
  "relation.same": () => "Il giocatore ha già questo.",
  "relation.rule": (p) => `La regola dei cresciuti nel vivaio ${p.rule} non è tra quelle che l'editor scrive.`,
  "staff.you": () => "Sei tu, l'allenatore che controlli.",
  "staff.unemployed": () => "Questo membro dello staff non ha una società.",
  "staff.role": () =>
    "La società o una delle sue squadre punta direttamente a questo membro dello staff (come a un allenatore che è anche " +
    "il suo direttore sportivo, o a un presidente che guida la squadra); a spostarlo ci pensa il gioco stesso.",
  "staff.notListed": () => "Le liste dello staff della società non lo hanno dove dovrebbero.",
  "staff.noRoom": (p) =>
    `La lista ${STAFF_DEPARTMENTS[p.department] ?? `di ${p.department}`} della società non ha posto per nessun altro ` +
    `(ora ${p.staff}) e l'editor qui non può ingrandirla.`,
  "stadium.none": () => "Non si riesce a leggere lo stadio in cui gioca la prima squadra della società.",
  "stadium.shared": (p) =>
    `${p.holders} elementi del gioco condividono questo nome; non si può cambiare solo per lo stadio.`,
  "stadium.nameLength": (p) =>
    `Il nuovo nome di questo stadio deve occupare da ${p.min} a ${p.max} byte per stare dove il gioco lo tiene; ` +
    `questo ne occupa ${p.bytes}.`,
  "stadium.badName": () =>
    "Il nome di uno stadio non può essere vuoto, iniziare o finire con uno spazio né contenere caratteri di controllo.",
  "staff.job": (p) => `L'editor non sposta ancora lo staff con il ruolo di ${jobName(p.job)} né assegna quel ruolo.`,
  "staff.directorTaken": (p) =>
    `La società ha già un direttore sportivo: ${p.name ?? "un'altra persona"}. Dai a questo membro dello staff un altro ` +
    `ruolo lì, oppure sposta prima ${p.name ?? "quella persona"}.`,
  "staff.managerTaken": (p) =>
    `La società ha già un allenatore: ${p.name ?? "un'altra persona"}. Dai a questo membro dello staff un altro ruolo ` +
    `lì, oppure sposta prima ${p.name ?? "quella persona"}.`,
  "staff.yourClub": () =>
    "Questa società la gestisci tu. Dai a questo membro dello staff un altro ruolo lì: FMLibreEditor non prende mai il " +
    "tuo posto.",
  "staff.noJob": () => "Scegli il ruolo che avrà nella società.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Questa società non ha staff: il gioco non ne tiene nelle società dei campionati che non sono giocabili in questo " +
        "salvataggio."
      : "Nessuno dello staff di questa società ha un contratto completo suo su cui modellarne uno nuovo.",
  "squad.noTeam": () => `La società non ha quella squadra o non supera il controllo; ${reload}.`,
  "captain.notInTeam": () =>
    "Il giocatore non gioca in questa squadra; il capitano può essere solo uno dei giocatori della squadra stessa.",
  "captain.unchanged": () => "Il giocatore ha già quel ruolo.",
  "session.notRunning": () =>
    "Football Manager 27 non è in esecuzione. Avvia il gioco, carica un salvataggio e riprova.",
  "session.noSuchProcess": (p) => `Non c'è nessun ${p.exe ?? "fm.exe"} con il PID ${p.pid}.`,
  "session.severalRunning": (p) =>
    `Ci sono ${p.count} copie di ${p.exe ?? "fm.exe"} in esecuzione (${p.pids}); scegline una.`,
  "session.pluginNotLoaded": () =>
    "I dati del gioco non sono ancora stati caricati; attendi il menu principale e riprova.",
  "session.unsupportedEdition": (p) => `FM${p.edition} non è ancora supportato.`,
  "session.unknownEdition": () => "Non si riesce a capire quale Football Manager sia questo.",
  "session.playersNotFound": () =>
    "La lista dei giocatori non è stata trovata; carica un salvataggio (il menu principale non basta) e riprova.",
  "memory.win32": (p) => `Windows ha rifiutato un'operazione (${p.operation}, errore ${p.code}).`,
  "memory.read": (p) => `Non è stato possibile leggere la memoria del gioco (errore di sistema ${p.code}).`,
  "memory.write": (p) => `Non è stato possibile scrivere nella memoria del gioco (errore di sistema ${p.code}).`,
  "memory.readOnly": () => "Il gioco è stato aperto in sola lettura; Windows non ha permesso di scrivere.",
  "memory.notWritable": () =>
    "Quell'indirizzo non è nella memoria dati modificabile del gioco, quindi non è stato scritto.",
  "memory.invalidPe": () => "Non è stato possibile leggere il modulo del gioco.",
  "memory.invalidMachO": () => "Non è stato possibile leggere il modulo del gioco.",
  "memory.mach": (p) => `macOS ha rifiutato un'operazione (${p.operation}, errore ${p.code}).`,
  "memory.posix": (p) => `macOS ha rifiutato un'operazione (${p.operation}, errno ${p.code}).`,
  "memory.noBridge": () =>
    "macOS non lascia entrare FMLibreEditor nel gioco: il gioco è stato avviato senza il bridge di FMLibreEditor. " +
    "Installa il bridge, poi avvia di nuovo il gioco da Steam.",
  "memory.bridge": (p) => `Il bridge di FMLibreEditor nel gioco non ha consegnato la memoria (${p.reason}).`,
  "scout.noClub": () => "In questo salvataggio non gestisci nessuna società, quindi non c'è nessuno per cui osservare.",
  "scout.noTactic": (p) => `Non è stato possibile leggere dal gioco la tattica di ${p.club}.`,
  "scout.notPlaced": () => "Il giocatore non occupa nessuna posizione della tattica.",
  "scout.unknownRole": (p) => `L'editor non conosce il ruolo ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam è aperto, quindi le opzioni di avvio di FM27 non sono state toccate; il bridge in sé è installato. Chiudi " +
    "Steam e riprova, oppure inserisci tu l'opzione di avvio in Steam.",
  "setup.noSteamAccount": () =>
    "Non è stato trovato nessun account Steam su questo Mac; apri Steam e accedi almeno una volta.",
  "setup.noLibrary": (p) => `Nell'app manca un file del bridge: ${p.path}`,
  "setup.unknownConfig": (p) => `${p.path} non ha un formato che FMLibreEditor conosca, quindi non è stato toccato.`,
  "setup.io": (p) => `${p.path}: ${p.error}`,
  "app.internal": () => "Si è verificato un errore imprevisto nell'app.",
  "app.notConnected": () => "Non c'è connessione con il gioco.",
  "app.notFound": (p) =>
    `Nelle liste non c'è ${recordFeminine(p.entity) ? "nessuna" : "nessun"} ${recordNoun(p.entity)} con l'ID ${p.uid}; ricarica i dati.`,
  "app.dataChanged": () => `Questi dati sono cambiati nel gioco; ${reload}.`,
  "app.noChange": (p) => `La modifica ${p.id} non esiste.`,
  "app.alreadyUndone": () => "Questa modifica è già stata annullata.",
  "export.failed": (p) => `Non è stato possibile scrivere il file: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor non può scrivere in ${p.folder}. Se macOS ha chiesto se può usare la tua cartella Documenti, ` +
    "consentilo in Impostazioni di Sistema › Privacy e sicurezza › File e cartelle, poi esporta di nuovo.",
  "export.noFolder": () => "Non c'è nessuna cartella in cui esportare.",
  "export.notExported": () => "Questo non è un file esportato da FMLibreEditor.",
  "export.openFailed": (p) => `Non è stato possibile aprirlo: ${p.reason}`,
  "mass.noOperations": () => "Scegli almeno un campo da cambiare.",
  "mass.tooMany": (p) =>
    `Ci sono ${p.count} risultati. Per una modifica multipla, restringi la ricerca o i filtri a ${p.limit} al massimo.`,
  "mass.outOfDate": () => "Questa anteprima non è più aggiornata. Genera di nuovo l'anteprima della modifica multipla.",
};

export const it: Strings = {
  attributes: {
    // Tecnica
    corners: "Calci d'angolo",
    crossing: "Cross",
    dribbling: "Dribbling",
    finishing: "Finalizzazione",
    first_touch: "Controllo di palla",
    free_kicks: "Calci di punizione",
    heading: "Colpi di testa",
    long_shots: "Tiri da fuori",
    long_throws: "Rimesse lunghe",
    marking: "Marcatura",
    passing: "Passaggi",
    penalty_taking: "Rigori",
    tackling: "Contrasti",
    technique: "Tecnica",
    // Psicologia
    aggression: "Aggressività",
    anticipation: "Intuito",
    bravery: "Coraggio",
    composure: "Freddezza",
    concentration: "Concentrazione",
    decisions: "Decisioni",
    determination: "Determinazione",
    flair: "Fantasia",
    leadership: "Carisma",
    off_the_ball: "Senza palla",
    positioning: "Piazzamento",
    teamwork: "Gioco di squadra",
    vision: "Visione di gioco",
    work_rate: "Impegno",
    // Fisico
    acceleration: "Accelerazione",
    agility: "Agilità",
    balance: "Equilibrio",
    jumping_reach: "Massima elevazione",
    natural_fitness: "Integrità fisica",
    pace: "Velocità",
    stamina: "Resistenza",
    strength: "Forza",
    // Parate (il controllo di palla e i passaggi sono quelli della Tecnica)
    aerial_reach: "Palle alte",
    command_of_area: "Autorità in area",
    communication: "Comunicazione",
    eccentricity: "Eccentricità",
    handling: "Presa",
    kicking: "Rinvii",
    one_on_ones: "Uno contro uno",
    punching: "Respinte di pugno (tendenza)",
    reflexes: "Riflessi",
    rushing_out: "Uscite (tendenza)",
    throwing: "Lancio lungo",
    // Nascosti
    consistency: "Continuità",
    dirtiness: "Fallosità",
    important_matches: "Partite importanti",
    injury_proneness: "Propensione agli infortuni",
    versatility: "Versatilità",
    // Piedi
    left_foot: "Piede sinistro",
    right_foot: "Piede destro",
  },

  staffAttributes: {
    // Allenamento
    attacking: "Attacco",
    defending: "Difesa",
    fitness: "Condizione fisica",
    goalkeeping: "Portieri",
    possession: "Possesso",
    set_pieces: "Calci piazzati",
    tactical: "Tattica",
    technical: "Tecnica",
    working_with_youngsters: "Lavoro con i giovani",
    // Psicologia
    authority: "Autorità",
    determination: "Determinazione",
    motivating: "Motivazione",
    people_management: "Gestione del personale",
    // Conoscenze
    data_analysis: "Analisi dei dati",
    judging_ability: "Giudizio abilità",
    judging_potential: "Giudizio potenziale",
    judging_staff: "Giudizio dell'abilità dello staff",
    negotiating: "Negoziazione",
    tactical_knowledge: "Conoscenze tattiche",
    // Area medica
    physiotherapy: "Fisioterapia",
    sports_science: "Medicina sportiva",
  },

  personality: {
    adaptability: "Adattabilità",
    ambition: "Ambizione",
    loyalty: "Lealtà",
    pressure: "Pressione",
    professionalism: "Professionalità",
    sportsmanship: "Sportività",
    temperament: "Temperamento",
    controversy: "Controversia",
  },

  positions: {
    gk: "GK",
    sw: "SW",
    dl: "DL",
    dc: "DC",
    dr: "DR",
    dm: "DM",
    ml: "ML",
    mc: "MC",
    mr: "MR",
    aml: "AML",
    amc: "AMC",
    amr: "AMR",
    st: "ST",
    wbl: "WBL",
    wbr: "WBR",
  },

  clubFacilities: {
    training: "Allenamento",
    youth_facilities: "Strutture giovanili",
    youth_coaching: "Allenamento giovanili",
    youth_recruitment: "Ricerca dei giovani",
    corporate: "Aziendali",
  },

  supporterTraits: {
    loyalty: "Lealtà",
    passion: "Passione",
    patience: "Pazienza",
    affluence: "Affluenza",
    temperament: "Temperamento",
    expectations: "Aspettative",
  },

  supporterMix: {
    hardcore: "Sfegatati",
    core: "Appassionati",
    family: "Famiglia",
    fair_weather: "Occasionali",
    corporate: "Investitori",
    casual: "Casuali",
  },

  jobs: {
    1: "Giocatore",
    2: "Preparatore",
    4: "Presidente",
    6: "Dirigente",
    10: "Direttore sportivo",
    12: "Fisioterapista",
    14: "Osservatore",
    16: "Allenatore",
    20: "Allenatore in seconda",
    22: "Preparatore dei calci piazzati",
    26: "Preparatore atletico",
    34: "Allenatore dei portieri",
    // Named as the game's Italian text names them.
    38: "Capo medico",
    40: "Responsabile recupero infortunati",
    44: "Capo osservatore",
    46: "Medico sociale",
    48: "Preparatore recupero infortunati",
    50: "Capo fisioterapista",
    58: "Analista del reclutamento",
    60: "Analista delle performance",
    62: "Capo analista delle performance",
    64: "Responsabile settore giovanile",
    66: "Proprietario",
    70: "Presidente della società",
    86: "Gestore prestiti",
    88: "Direttore tecnico",
  },

  fields: {
    current_ability: "Abilità attuale",
    potential_ability: "Abilità potenziale",
    height: "Altezza (cm)",
    date_of_birth: "Data di nascita",
    asking_price: "Prezzo richiesto",
    nation: "Nazionalità",
    "reputation.home": "Reputazione casalinga",
    "reputation.current": "Reputazione attuale",
    "reputation.world": "Reputazione mondiale",
    "international.caps": "Presenze in Nazionale",
    "international.goals": "Gol in Nazionale",
    "international.u21_caps": "Presenze U21",
    "international.u21_goals": "Gol U21",
    condition: "Energia",
    match_sharpness: "Forma partita",
    jadedness: "Stanchezza",
    morale: "Morale",
    "contract.wage": "Stipendio settimanale",
    "contract.loyalty_bonus": "Bonus fedeltà settimanale",
    "contract.happiness": "Felicità",
    "contract.playing_time_happiness": "Felicità per il minutaggio",
    "contract.unhappiness": "Motivi di scontento",
    "contract.expires": "Scadenza contratto",
    "contract.squad_number": "Numero di maglia",
    "contract.squad_status": "Stato in rosa",
    "contract.transfer_listed": "In lista trasferimenti",
    "contract.loan_listed": "In lista prestiti",
    "loan.expires": "Fine del prestito",
    "loan.option_fee": "Diritto di riscatto",
    "contract.job": "Ruolo",
    "tie.nationality": "Seconda nazionalità",
    "tie.trainedInNation": "Vivaio nazionale",
    "tie.trainedAtClub": "Vivaio del club",
    "tie.workPermit": "Senza permesso di lavoro in",
    club: "Società",
    injuries: "Infortuni",
    cohesion: "Affiatamento",
    bans: "Squalifiche",
    retirement: "Ritiro",
    clause: "Clausola del contratto",
    "clause.amount": "Importo della clausola",
    "clause.condition": "Condizione della clausola",
    captain: "Capitano",
    vice_captain: "Vice capitano",
    reputation: "Reputazione",
    "facilities.training": "Strutture di allenamento",
    "facilities.youth_facilities": "Strutture giovanili",
    "facilities.youth_coaching": "Allenamento giovanili",
    "facilities.youth_recruitment": "Ricerca dei giovani",
    "facilities.corporate": "Strutture aziendali",
    "finance.balance": "Saldo",
    "finance.transfer_budget": "Budget trasferimenti",
    "finance.wage_budget": "Budget stipendi",
    "finance.total_wage_budget": "Budget stipendi complessivo",
    "stadium.capacity": "Capienza dello stadio",
    "stadium.name": "Nome dello stadio",
    "stadium.seating": "Posti a sedere",
    "stadium.used": "Capienza utilizzata",
    "stadium.expansion": "Capienza massima ampliabile",
  },

  profile: {
    close: "Chiudi profilo",
    loading: "Caricamento del profilo…",
    resize: "Ridimensiona il pannello del profilo",
    resizeHint: "Trascina per allargare o restringere il pannello; fai doppio clic per riportarlo com'era",
    none: "—",

    // Intestazione
    freeAgent: "Svincolato",
    born: "Nato il",
    height: (cm) => `${cm} cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Abilità attuale",
    currentAbilityShort: "AA",
    potentialAbility: "Abilità potenziale",
    potentialAbilityShort: "AP",
    potentialRange: "Potenziale impostato come intervallo",

    // Attributi
    technical: "Tecnica",
    goalkeeping: "Parate",
    mental: "Psicologia",
    physical: "Fisico",
    hidden: "Nascosti",
    feet: "Piedi",
    personality: "Personalità",
    raw: (raw, scale = 100) => `valore interno ${raw} / ${scale}`,
    lowerIsBetter: "più è basso, meglio è",
    age: (age) => `${age} anni`,

    // Ruoli
    positions: "Ruoli",
    positionsSummary: (best) => `Valutazioni per ruolo: ${best}`,
    positionRatings: "Valutazioni per ruolo",
    positionTiers: {
      natural: "Naturale",
      accomplished: "Abile",
      competent: "Competente",
      unconvincing: "Poco convincente",
      ineffective: "Fuori ruolo",
    },
    positionTooltip: (position, rating, tier) => `${position} · ${rating} · ${tier}`,

    // Contratto
    contract: "Contratto",
    wage: "Stipendio settimanale",
    wageNote: (converted) =>
      converted
        ? "il gioco tiene le sterline; mostrato al tasso di cambio di FM"
        : "il gioco tiene le sterline; puoi scegliere un'altra valuta nelle impostazioni",
    signed: "Firmato",
    expires: "Scadenza",
    joined: "Arrivo",
    squadStatus: "Stato in rosa",
    squadStatusName: (status) => SQUAD_STATUSES[status] ?? `Stato ${status}`,
    contractType: "Tipo di contratto",
    contractTypeName: (code) => CONTRACT_TYPES[code] ?? `Tipo ${code}`,
    squadNumber: "Numero di maglia",
    transferListed: "In lista trasferimenti",
    loanListed: "In lista prestiti",

    // Carriera
    career: "Carriera",
    internationalCaps: "Presenze in Nazionale",
    internationalGoals: "Gol in Nazionale",
    u21Caps: "Presenze U21",
    u21Goals: "Gol U21",
    askingPrice: "Prezzo richiesto",
    notSet: "Non impostato",
    reputation: "Reputazione",
    reputationHome: "Casalinga",
    reputationCurrent: "Attuale",
    reputationWorld: "Mondiale",
    retirement: "Ritiro",
    retires: "Pensa di ritirarsi",
    noRetirement: "Il gioco non ha previsto il suo ritiro",
    keepPlaying: "Evita il ritiro",
    keepingPlaying: "In corso…",
    keepPlayingTitle:
      "Toglie il suo ritiro dai piani del gioco e gli dà la caratteristica «Giocherà a calcio finché possibile» al " +
      "posto di «Si ritirerà all'apice»; si può annullare in Modifiche",

    // Area medica
    morale: (value) => `${value} / 20`,
    traits: "Caratteristiche",
    noTraits: "Nessuna caratteristica",
    traitName: (bit) => TRAIT_NAMES_IT[bit] ?? `Caratteristica ${bit}`,
    unhappiness: "Scontento",
    noUnhappiness: "Niente lo rende scontento",
    removeUnhappiness: "Rimuovi tutto",
    removingUnhappiness: "Rimozione…",
    removeUnhappinessTitle:
      "Toglie dalla sua lista ogni motivo di scontento, come fa Rimuovi tutto di FMRTE; si può annullare in Modifiche",
    concernSince: (date) => `dal ${date}`,
    concernKind: (kind) => (kind === 1 ? "Preoccupato" : kind === 2 ? "Interno" : `Tipo ${kind}`),
    concernMotive: (motive) => CONCERN_MOTIVES_IT[motive] ?? `Motivo ${motive}`,
    clauses: "Bonus e clausole",
    noClauses: "Nessun bonus o clausola",
    loyaltyBonus: "Bonus fedeltà",
    happiness: "Felicità",
    playingTimeHappiness: "Felicità per il minutaggio",
    moodTitle: "Come lo mostra FMRTE, da -100 a 100; il gioco lo mostra a parole",
    clauseName: (kind) => CLAUSE_NAMES_IT[kind] ?? `Clausola ${kind}`,
    loan: "Prestito",
    loanAt: "In prestito presso",
    loanParent: "Di proprietà di",
    loanFrom: "Dal",
    loanUntil: "Fino al",
    loanNumber: "Numero lì",
    recall: "Richiama dal prestito",
    recallTitle: "Lo riporta alla sua società: il prestito finisce oggi. Chiede conferma prima di cambiare qualcosa",
    recallAgain: "Richiama di nuovo",
    makePermanent: "Rendi definitivo",
    makePermanentTitle:
      "Lo tiene nella società in cui è in prestito, sotto contratto con quella società. Chiede conferma prima di cambiare qualcosa",
    recalledWaiting: "Richiamato · rientro in attesa",
    endsTodayWaiting: "Finisce oggi · rientro in attesa",
    pendingTitle: (parent) =>
      `Oggi è l'ultimo giorno del prestito: continua di un giorno nel gioco e tornerà alla sua società, ${parent}.`,
    endPassed: (date) =>
      `Il prestito doveva finire il ${date}, ma il gioco non l'ha riportato indietro. Richiamalo di nuovo, poi ` +
      "continua di un giorno.",
    loanCanRecall: "Richiamabile",
    loanCanRecallTitle:
      "Se la sua società può richiamarlo nel gioco. Richiama dal prestito, qui, funziona in entrambi i casi",
    loanCanTerminate: "Può finire in anticipo",
    loanCupMatches: "Gioca le partite di coppa",
    loanAgainstClub: "Gioca contro la sua società",
    loanOptionFee: "Diritto di riscatto",
    loanOptionFeeTitle: "La cifra con cui la società in cui è in prestito può tesserarlo a titolo definitivo",
    loanMonthlyFee: "Rata mensile se gioca",
    loanMonthlyFeeTitle: "Quanto la società in cui è in prestito paga alla sua società per ogni mese in cui gioca",
    loanUnusedFee: "Rata mensile se non gioca",
    loanUnusedFeeTitle: "Quanto la società in cui è in prestito paga alla sua società per ogni mese in cui non viene impiegato",
    clauseCondition: (kind, value) => {
      switch (kind) {
        case 10:
          return value === 1 ? "1 gol" : `${format(value)} gol`;
        case 40:
          return value === 1 ? "1 assist" : `${format(value)} assist`;
        case 41:
          return `${format(value)} tra gol e assist`;
        case 19:
          return value === 1 ? "1 presenza in Nazionale" : `${format(value)} presenze in Nazionale`;
        case 11:
        case 13:
        case 25:
        case 26:
          return value === 1 ? "1 partita di campionato" : `${format(value)} partite di campionato`;
        case 22:
        case 29:
          return value === 1 ? "1 anno" : `${format(value)} anni`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value}%`;
        default:
          return String(value);
      }
    },
    clauseExpires: (date) => `scade il ${date}`,
    clauseExpiresAfter: (days) =>
      days === 1 ? "scade 1 giorno dopo la firma" : `scade ${format(days)} giorni dopo la firma`,
    clauseProfitShare: (percent, amount) => `${percent} del guadagno oltre ${amount}`,
    clauseWage: (amount) => `${amount} a settimana`,
    moraleTitle:
      "Il gioco mostra il morale come la felicità complessiva del giocatore: soddisfatto a 10, abbastanza felice a 11, " +
      "estremamente felice a 15 e 20",
    jadednessTitle:
      "Quanto il giocatore è logorato dalle partite, cosa che il riposo toglie: -500 è del tutto riposato e, più è " +
      "alto, più ha bisogno di riposo",
    noInjuries: "Nessun infortunio",
    unknownInjury: "Infortunio sconosciuto",
    injuryStarted: (date) => `Dal ${date}`,
    injuryBack: (dates) => `Rientro previsto: ${dates}`,
    heal: "Guarisci",
    healTitle: "Guarisce ogni infortunio di questo giocatore nel gioco",
    noBans: "Nessuna squalifica",
    banMatches: (matches) => (matches === 1 ? "1 giornata" : `${format(matches)} giornate`),
    banStarted: (date) => `Dal ${date}`,
    liftBans: "Revoca",
    liftBansTitle: "Revoca ogni squalifica di questo giocatore nel gioco",

    // Sopra gli attributi, mentre il profilo si legge
    maxAttributes: "Attributi al massimo",
    maxAttributesTitle:
      "Porta ogni attributo di questo giocatore al suo meglio: 20, e 1 per propensione agli infortuni e fallosità",
    maxAttributesDone: (count) =>
      count === 0
        ? "Ogni attributo è già al suo meglio"
        : `${changes(count)} scritt${feminine(count)}`,
    maxAttributesUndone: (count) =>
      count === 0 ? "Non è stato annullato nulla" : `${changes(count)} annullat${feminine(count)}`,
    undoMax: "Ripristina",
    undoMaxTitle: "Riscrive nel gioco i suoi attributi di prima",
    freezeAttributes: "Congela gli attributi",
    freezeAttributesNote:
      "Finché l'app è aperta e connessa, i suoi attributi non peggiorano: quello che il gioco toglie viene rimesso, e " +
      "i miglioramenti contano lo stesso. L'app se lo ricorda per questo salvataggio e li congela di nuovo quando vi " +
      "si connette.",
    maxStaffAttributesTitle: "Porta ogni attributo di questo membro dello staff al suo meglio: 20",
    undoMaxStaffTitle: "Riscrive nel gioco gli attributi di prima",
    freezeStaffAttributesNote:
      "Finché l'app è aperta e connessa, i suoi attributi non peggiorano: quello che il gioco toglie viene rimesso, e " +
      "i miglioramenti contano lo stesso. L'app se lo ricorda per questo salvataggio e li congela di nuovo quando vi " +
      "si connette.",
    freezeFitness: "Congela energia e forma",
    freezeFitnessNote:
      "Finché l'app è aperta e connessa, la sua energia e la sua forma partita non calano: quello che il gioco toglie " +
      "viene rimesso, e i guadagni contano lo stesso, quindi al 100% resta lì. L'app se lo ricorda per questo " +
      "salvataggio.",
    freezePositions: "Congela",
    freezePositionsInfo: "Cosa fa il congelamento dei ruoli?",
    freezePositionsNote:
      "Finché l'app è aperta e connessa, le sue valutazioni per ruolo restano come sono: non impara un nuovo ruolo e " +
      "le sue valutazioni non salgono né scendono. L'app se lo ricorda per questo salvataggio.",

    // Staff
    you: "Tu",
    youTitle: "L'allenatore che controlli in questo salvataggio",
    id: "ID",
    job: "Ruolo",
    changeJob: "Cambia ruolo",
    changeJobTitle: "Dà a questo membro dello staff un altro ruolo nella sua società, nel gioco",
    newJob: "Nuovo ruolo",
    applyJob: "Applica",
    cancelJob: "Annulla",
    unemployed: "Disoccupato",
    coaching: "Allenamento",
    knowledge: "Conoscenze",
    medical: "Area medica",
    playerCoach: (job) => `${job} (giocatore-allenatore)`,
    unknownJob: (code) => `Ruolo ${code}`,
  },

  playerList: {
    nav: "Giocatori",
    count: (total) => `${format(total)} giocatori`,
    search: "Cerca giocatori per nome o UID",
    summary: (total, shown, sorted) => {
      const count = `${format(total)} giocatori`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · i primi ${shown} per abilità attuale`
        : `${count} · i primi ${shown} per ${sorted.by}, in ordine ${sorted.ascending ? "crescente" : "decrescente"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Nessun giocatore corrisponde a questi filtri." : "Nessun giocatore trovato.";
      }
      return filtered
        ? `Nessun giocatore corrisponde a «${query}» con questi filtri.`
        : `Nessun giocatore corrisponde a «${query}».`;
    },
    columns: {
      name: "Nome",
      age: "Età",
      positions: "Ruoli",
      nation: "Nazione",
      club: "Società",
      contractExpires: "Contratto",
      born: "Nato il",
      currentAbility: "AA",
      potentialAbility: "AP",
      uid: "UID",
    },
    sortBy: (by) => `Ordina per ${by}`,
    sortNames: {
      currentAbility: "abilità attuale",
      potentialAbility: "abilità potenziale",
      age: "età",
      name: "nome",
      nation: "nazione",
      club: "società",
      contractExpires: "scadenza del contratto",
    },
    filters: {
      toggle: "Filtri",
      toggleActive: (count) => `Filtri, ${count} attiv${masculine(count)}`,
      clear: "Azzera",
      any: "Qualsiasi",
      position: "Ruolo",
      gender: "Sesso",
      men: "Uomini",
      women: "Donne",
      age: "Età",
      minAge: "Età minima",
      maxAge: "Età massima",
      minPlaceholder: "Min",
      maxPlaceholder: "Max",
      minCurrentAbility: "AA min",
      minCurrentAbilityTitle: "Abilità attuale minima",
      minPotentialAbility: "AP min",
      minPotentialAbilityTitle: "Abilità potenziale minima",
      abilityPlaceholder: "1–200",
      nation: "Nazione",
      club: "Società",
      freeAgentsOnly: "Solo svincolati",
      contractEndsBy: "Contratto in scadenza entro",
      transferListedOnly: "Solo in lista trasferimenti",
      loanListedOnly: "Solo in lista prestiti",
      attributes: {
        heading: "Attributi",
        attribute: "Attributo",
        pick: "Scegli un attributo",
        min: (name) => (name ? `${name}: minimo` : "Minimo"),
        max: (name) => (name ? `${name}: massimo` : "Massimo"),
        add: "Aggiungi attributo",
        remove: (name) => (name ? `Rimuovi ${name}` : "Rimuovi questa riga"),
      },
      saved: {
        save: "Salva",
        saveTitle: "Salva con un nome i filtri e l'ordinamento in uso",
        name: "Nome del filtro salvato",
        namePlaceholder: "Nome del filtro",
        ok: "OK",
        cancel: "Annulla",
        select: "Filtri salvati",
        delete: "Elimina",
        deleteTitle: (name) => `Elimina il filtro salvato: ${name}`,
        replaceQuestion: (name) => `Esiste già un filtro salvato con il nome «${name}». Vuoi sostituirlo?`,
        replace: "Sostituisci",
        full: (max) =>
          `Si possono salvare fino a ${max} filtri. Eliminane prima uno, oppure usa il nome di un filtro salvato per ` +
          "sostituirlo.",
      },
    },
  },

  staffList: {
    nav: "Staff",
    count: (total) => `${format(total)} membri dello staff`,
    search: "Cerca lo staff per nome o ID",
    summary: (total, shown, sorted) => {
      const count = `${format(total)} membri dello staff`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · i primi ${shown} per abilità attuale`
        : `${count} · i primi ${shown} per ${sorted.by}, in ordine ${sorted.ascending ? "crescente" : "decrescente"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Nessun membro dello staff corrisponde a questi filtri." : "Nessun membro dello staff trovato.";
      }
      return filtered
        ? `Nessun membro dello staff corrisponde a «${query}» con questi filtri.`
        : `Nessun membro dello staff corrisponde a «${query}».`;
    },
    columns: {
      name: "Nome",
      age: "Età",
      job: "Ruolo",
      club: "Società",
      nation: "Nazione",
      born: "Nato il",
      currentAbility: "AA",
      potentialAbility: "AP",
      id: "ID",
    },
    sortBy: (by) => `Ordina per ${by}`,
    sortNames: {
      currentAbility: "abilità attuale",
      potentialAbility: "abilità potenziale",
      age: "età",
      name: "nome",
      nation: "nazione",
      club: "società",
    },
    filters: {
      job: "Ruolo",
      anyJob: "Qualsiasi",
      unemployedOnly: "Solo disoccupati",
    },
  },

  clubProfile: {
    // Intestazione
    womensClub: "Club femminile",
    founded: (year) => `Fondato nel ${year}`,
    reputationShort: "REP",
    reputationTitle: "Reputazione",

    tabsLabel: "Sezioni della società",
    tabs: { overview: "Panoramica", squad: "Rosa", stadium: "Stadio" },
    squadLocked: "Termina la modifica per aprire la rosa",

    facilities: "Strutture",

    // Tifosi
    supporters: "Tifosi",
    supporterMix: "Tipo di tifosi",
    percent: (value) => `${percents.format(value)}%`,
    mixTooltip: (kind, percent) => `${kind} · ${percent}`,

    // Finanze
    finances: "Finanze",
    balance: "Saldo",
    transferBudget: "Budget trasferimenti",
    wageBudget: "Budget stipendi (spesa)",
    totalWageBudget: "Budget stipendi complessivo",
    ticketPrice: "Prezzo medio del biglietto",
    perWeek: "a settimana",
    noFinances: "FM tiene le finanze solo per le società dei campionati in gioco.",
    freeze: "Congela il denaro",
    freezeNote:
      "Finché l'app è aperta e connessa, il saldo non cala: quello che il gioco toglie viene rimesso, e le entrate " +
      "contano lo stesso. L'app se lo ricorda per questo salvataggio e lo congela di nuovo quando vi si connette.",

    // Stadio
    stadium: "Stadio",
    capacity: "Capienza",
    seating: "Posti a sedere",
    used: "In uso",
    usedAll: "Tutta",
    usedTitle:
      "La parte della capienza che il gioco fa entrare, quando la limita (per esempio mentre alcuni posti sono " +
      "chiusi); 0 vuol dire tutta",
    expansion: "Ampliabile fino a",
    noStadium: "Non è stato possibile leggere lo stadio di questa società.",
    stadiumName: "Nome",
    rename: "Rinomina",
    renameTitle: "Dà un altro nome allo stadio; viene scritto subito e si può annullare in Modifiche",
    renameInfoLabel: "Come funziona la rinomina?",
    renameInfo:
      "Il gioco non tiene i nomi degli stadi nei salvataggi: li prende dal suo database ogni volta che carica un " +
      "salvataggio. Per questo FMLibreEditor si ricorda il nuovo nome per questo salvataggio e lo rimette entro pochi " +
      "secondi ogni volta che il gioco lo carica, finché l'app è aperta e connessa. Se il gioco carica il salvataggio " +
      "mentre l'app è chiusa, mostra il suo nome finché l'app non si connette di nuovo. Per tornare al vecchio nome, " +
      "annulla la rinomina in Modifiche oppure rinomina di nuovo lo stadio.",
    saveName: "Salva",
    renaming: "Salvataggio…",
    cancelRename: "Annulla",
    nameLength: (bytes, min, max) =>
      min <= 1
        ? `${bytes} di al massimo ${max} caratteri (una lettera accentata conta come due)`
        : `${bytes} caratteri: da ${min} a ${max}, per stare dove il gioco tiene il nome (una lettera accentata conta ` +
          "come due)",
    nameShared: (holders) =>
      `${holders} elementi del gioco condividono questo nome, quindi non si può cambiare solo per lo stadio`,

    // Info societarie
    info: "Info societarie",
    seasonTickets: "Abbonamenti",
    socialMedia: "Follower sui social media",
  },

  clubList: {
    nav: "Società",
    count: (total) => `${format(total)} società`,
    search: "Cerca società per nome o UID",
    summary: (total, shown) =>
      total > shown ? `${format(total)} società · le prime ${shown} per reputazione` : `${format(total)} società`,
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Nessuna società corrisponde a questo filtro." : "Nessuna società trovata.";
      }
      return filtered
        ? `Nessuna società corrisponde a «${query}» con questo filtro.`
        : `Nessuna società corrisponde a «${query}».`;
    },
    women: "Donne",
    columns: {
      name: "Nome",
      reputation: "Reputazione",
      founded: "Fondazione",
      uid: "UID",
    },
    filters: {
      kind: "Società da mostrare",
      all: "Tutte le società",
      men: "Club maschili",
      women: "Club femminili",
    },
  },

  app: {
    stage: "beta",
    settingsLabel: "Impostazioni",
    languageLabel: "Lingua",
    currencyLabel: "Valuta",

    noteEditable: "Le modifiche arrivano al gioco solo quando le applichi. Fai prima un backup del salvataggio.",
    noteReadOnly: "Sola lettura: Windows non ha permesso a FMLibreEditor di scrivere nel gioco.",
    noteUnknownBuild: "Sola lettura: questa versione del gioco è nuova per FMLibreEditor.",
    noteNotConnected: "Nel gioco non cambia nulla finché non modifichi e applichi.",

    notConnected: "Non connesso",
    previewTag: "anteprima nel browser · dati di esempio",
    noDate: "Nessuna data di gioco",
    noDateTitle:
      "FMLibreEditor non è riuscito a leggere la data del gioco in questa versione, quindi le età non sono mostrate e " +
      "i filtri per età non trovano nessuno. Controlla se ci sono aggiornamenti.",
    reload: "Ricarica i dati",
    refresh: "Aggiorna",
    detecting: "Ricerca di Football Manager…",
    connecting: "Lettura di giocatori, staff e società…",
    reloading: "Nuova lettura di giocatori, staff e società…",

    saveChanged: {
      title: "Il salvataggio del gioco è cambiato",
      text:
        "Il gioco ha caricato un salvataggio, o è tornato al menu principale, da quando FMLibreEditor lo ha letto. " +
        "Finché non ricarichi i dati, non cambia nulla nel gioco e non mantiene nulla di congelato: ciò che mostra " +
        "potrebbe appartenere a un altro salvataggio.",
    },

    refrozen: {
      title: "Congelato di nuovo dall'ultima volta",
      waitingTitle: "Ciò che era congelato per ora resta in attesa",
      players: (names) => `Attributi: ${names}`,
      staff: (names) => `Attributi dello staff: ${names}`,
      clubs: (names) => `Denaro: ${names}`,
      fitness: (names) => `Energia e forma: ${names}`,
      positions: (names) => `Ruoli: ${names}`,
      stadiums: (names) => `Nomi degli stadi: ${names}`,
      more: (count) => `e altri ${format(count)}`,
      waiting: (count) =>
        `${count === 1 ? "1 elemento è ricordato" : `${format(count)} elementi sono ricordati`} ma ora non ` +
        `${count === 1 ? "congelato" : "congelati"}: FMLibreEditor non può ancora scrivere in questa versione del gioco.`,
      dismiss: "Chiudi",
    },

    freezeInfo: {
      label: "Come funziona il congelamento?",
      note:
        "Congelare non cambia il gioco per sempre: ogni 2 secondi FMLibreEditor rimette ciò che il gioco ha tolto. " +
        "Quindi funziona solo finché l'app è aperta e connessa; se la chiudi, il gioco torna a cambiare quei valori. " +
        "L'app si ricorda cosa è congelato in questo salvataggio e lo congela di nuovo la prossima volta che vi si " +
        "connette.",
    },

    connect: {
      title: "Connettiti a Football Manager 27",
      intro:
        "FMLibreEditor legge la memoria del gioco mentre è in esecuzione. Avvia il gioco e carica un salvataggio, poi " +
        "connettiti.",
      notRunning: "Football Manager 27 non è in esecuzione.",
      openFailed: (error) => `Non è stato possibile aprire il gioco: ${error}`,
      game: "Gioco",
      gameData: "Dati del gioco",
      loaded: "Caricati",
      stillLoading: "Ancora in caricamento; attendi il menu principale",
      process: "Processo",
      pid: (pid) => `pid ${pid}`,
      several: "Sono in esecuzione più copie del gioco; viene usata la prima.",
      button: "Connettiti e leggi giocatori, staff e società",

      bridge: {
        title: "Il bridge (macOS)",
        intro:
          "macOS non lascia entrare nessuna app nella memoria di un'altra, quindi è FM27 a dover consegnare la propria " +
          "memoria. Lo fa quando carica il bridge di FMLibreEditor: una piccola libreria che non intercetta e non " +
          "cambia nulla nel gioco e dà la sua memoria solo a questa app. Un'opzione di avvio in Steam fa sì che FM27 " +
          "la carichi.",
        library: "Bridge",
        installed: "Installato",
        missing: "Non installato",
        launchOption: "Opzione di avvio",
        set: "Impostata in Steam",
        notSet: "Non impostata",
        ready:
          "Pronto. Avvia FM27 da Steam (chiudilo e riavvialo se è aperto), carica un salvataggio, poi connettiti.",
        steamRunning:
          "Steam è aperto e, finché lo è, si tiene le opzioni di avvio. Chiudi Steam per far impostare l'opzione di " +
          "avvio all'app, oppure inseriscila tu in Steam.",
        setUp: "Installa il bridge",
        remove: "Rimuovi il bridge",
        manual:
          "Oppure, in Steam, fai clic destro su Football Manager 27 › Proprietà › Generali › Opzioni di avvio e inserisci:",
        copy: "Copia",
        copied: "Copiato",
      },
    },
  },

  graphics: {
    reading: "Lettura dei pacchetti grafici…",
    summary: ({ clubLogos, flags, faces }) =>
      `Grafica: ${format(clubLogos)} ${clubLogos === 1 ? "logo" : "loghi"} di società · ` +
      `${format(flags)} ${flags === 1 ? "bandiera" : "bandiere"} · ${format(faces)} ${faces === 1 ? "volto" : "volti"}`,
    none: "Nessun pacchetto grafico trovato",
    noneHint: "I pacchetti di loghi e volti vanno nella cartella graphics di FM27.",
  },

  compatibility: {
    unknownBuild: (game) => `FMLibreEditor non è ancora stato verificato con ${game}`,
    unknownBuildText:
      "Probabilmente il gioco è stato aggiornato. FMLibreEditor ha trovato i dati del gioco e li ha controllati, ma non " +
      "scrive in una versione con cui non è stato provato finché non lo consenti tu. Di solito un nuovo FMLibreEditor " +
      "arriva entro pochi giorni.",
    allowedText: "La modifica è attiva per questa sessione, nei limiti dei controlli. Tieni un backup del salvataggio.",
    failedTitle: "Alcuni dati del gioco non hanno superato i controlli",
    reloadHint: "Se un salvataggio era ancora in caricamento, Ricarica i dati controlla di nuovo.",
    noDate: "La data del gioco non ha superato i controlli, quindi le età non sono mostrate.",
    failed: (names) => `In sola lettura: ${names}.`,
    failedCheck: (name, fit, sampled) => `${name} (${format(fit)} su ${format(sampled)} in regola)`,
    join: (names) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`,
    allow: "Modifica comunque",
    allowTitle:
      "Attiva la modifica finché FMLibreEditor non viene chiuso o non si connette di nuovo. Fai prima un backup del " +
      "salvataggio.",
  },

  diagnostics: {
    copy: "Copia diagnostica",
    copyTitle:
      "Copia quello che FMLibreEditor ha trovato nel gioco, da incollare in una segnalazione di bug. Non contiene " +
      "nomi né percorsi.",
    copied: "Copiato",
    failed: (reason) => `Non è stato possibile copiare la diagnostica: ${reason}`,
  },

  checks: {
    gameDate: "la data del gioco",
    players: "i dati dei giocatori",
    abilities: "abilità attuale e potenziale",
    positions: "i ruoli",
    attributes: "gli attributi",
    personality: "la personalità",
    liveValues: "energia, forma partita, stanchezza e morale",
    contracts: "i contratti",
    teams: "le squadre",
    staff: "lo staff",
    clubs: "le società",
    cohesion: "l'affiatamento con le società",
  },

  update: {
    available: (version) => `È disponibile FMLibreEditor ${version}`,
    youHave: (version) => `Hai la versione ${version}.`,
    download: "Scarica",
    install: "Aggiorna",
    installTitle: "Scarica e installa la nuova versione; FMLibreEditor si chiude e si riapre con quella",
    preparing: "Preparazione…",
    downloading: (percent) => (percent === null ? "Download…" : `Download… ${percent}%`),
    installing: "Installazione: FMLibreEditor si chiude e si riapre con la nuova versione.",
    installFailed: (reason) => `Non è stato possibile aggiornare: ${reason}. Scaricala invece dalla sua pagina.`,
    notInstallable: "Questa versione non si può installare da qui. Scaricala invece dalla sua pagina.",
    later: "Più tardi",
    check: "Controlla aggiornamenti",
    checking: "Controllo degli aggiornamenti…",
    upToDate: "Hai l'ultima versione.",
    failed: "Non è stato possibile controllare gli aggiornamenti.",
  },

  edit: {
    unknownNation: "Nazione sconosciuta",
    edit: "Modifica",
    editTitle: "Cambia i valori di questo profilo nel gioco",
    startFailed: (reason) => `Non è stato possibile iniziare la modifica: ${reason}`,
    positionRating: (position) => `Valutazione ${position}`,
    was: (value) => `era ${value}`,
    invalid: (min, max) => `Inserisci un numero intero da ${min} a ${max}`,
    invalidDate: (from, to) => `Inserisci una data dal ${from} al ${to}`,
    invalidMoney: (from, to) => `Inserisci un importo intero da ${from} a ${to}`,
    invalidPercentage: (from, to) => `Inserisci una percentuale intera da ${from} a ${to}`,
    percent: "%",
    yes: "Sì",
    no: "No",
    none: "nessuno",

    // Il piè di pagina
    footer: "Modifica in corso",
    changes: changeCount,
    invalidCount: (count) => `${count} non valid${masculine(count)}`,
    review: "Rivedi",
    reviewList: "Modifiche da applicare",
    discard: "Scarta",
    apply: "Applica",
    applying: "Applicazione…",
    applyBlocked: "Correggi prima i valori non validi",
    done: "Fatto",
    confirmDiscard: (count) => `Scartare ${changes(count)}?`,
    keepEditing: "Continua a modificare",

    // Dopo Applica
    applied: (count) => `${changes(count)} applicat${feminine(count)}`,
    nothingToChange: "Niente da cambiare: il gioco ha già questi valori.",
    refused: (label, reason) => `${label}: ${reason}`,
    rereadFailed: (reason) => `Non è stato possibile rileggere i valori: ${reason}`,
    dismiss: "Chiudi",
  },

  changes: {
    nav: "Modifiche",
    title: "Modifiche di questa sessione",
    hint: "Dalla più recente. Una modifica si può annullare solo finché il gioco ha ancora il valore che ha scritto.",
    continueHint: "Il gioco mostra una modifica quando va avanti: premi Continua nel gioco.",
    swappedWith: (name) => `Scambiato con ${name}`,
    released: (name) => `${name} svincolato`,
    fee: (amount) => `Costo ${amount}`,
    optionRemoved: (amount) => `Diritto di riscatto (${amount}) tolto`,
    healed: (count) => (count === 1 ? "1 infortunio guarito" : `${format(count)} infortuni guariti`),
    lifted: (count) => (count === 1 ? "1 squalifica revocata" : `${format(count)} squalifiche revocate`),
    keptPlaying: (date) => (date === null ? "Continuerà a giocare" : `Ritiro del ${date} evitato`),
    count: (total, undone) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${format(undone)} annullat${feminine(undone)}`;
    },
    empty:
      "Ancora nessuna modifica. Apri un giocatore, un membro dello staff o una società e scegli Modifica, oppure usa " +
      "Modifica multipla in un elenco.",
    columns: {
      time: "Ora",
      name: "Nome",
      field: "Campo",
      change: "Modifica",
      status: "Stato",
    },
    kinds: { player: "Giocatore", staff: "Staff", club: "Società" },
    stored: (change) => `valore interno ${change}`,
    undone: (time) => `Annullata alle ${time}`,
    undo: "Ripristina",
    undoTitle: (label) => `Riscrive nel gioco il vecchio valore di ${label}`,
    batch: "Modifica multipla",
    batchCount: (total, remaining) =>
      remaining === 0
        ? `${changeCount(total)} · ${total === 1 ? "annullata" : "tutte annullate"}`
        : `${changeCount(total)} · ${format(remaining)} non annullat${feminine(remaining)}`,
    showChanges: "Mostra le modifiche",
    hideChanges: "Nascondi le modifiche",
    undoBatch: "Ripristina i valori di prima",
    undoBatchTitle: (remaining) =>
      `Riscrive nel gioco i vecchi valori di questa modifica multipla (${format(remaining)} ancora in vigore)`,

    pages: "Pagine dell'elenco",
    batchPages: "Pagine delle modifiche di questa modifica multipla",
    previous: "Precedente",
    next: "Successiva",
    range: (first, last, total) => `${format(first)}–${format(last)} di ${format(total)}`,
  },

  export: {
    button: "Esporta",
    buttonTitle: {
      player: "Scrive in un file CSV o JSON i giocatori mostrati dall'elenco, per un foglio di calcolo o uno script",
      staff: "Scrive in un file CSV o JSON i membri dello staff mostrati dall'elenco, per un foglio di calcolo o uno script",
      club: "Scrive in un file CSV o JSON le società mostrate dall'elenco, per un foglio di calcolo o uno script",
    },
    title: { player: "Esporta giocatori", staff: "Esporta staff", club: "Esporta società" },
    scope: (entity, count) =>
      count === 0
        ? `${nouns[entity].feminine ? "Nessuna" : "Nessun"} ${nouns[entity].one} corrisponde alla ricerca e ai filtri.`
        : `${entityCount(entity, count)}: ciò che selezionano la ricerca e i filtri dell'elenco, nel suo ordine.`,
    formatLabel: "Formato",
    formats: {
      csv: "CSV, separato da virgole",
      csvSemicolon: "CSV, separato da punti e virgola",
      json: "JSON",
    },
    formatHints: {
      csv: "Per la maggior parte dei fogli di calcolo e degli script",
      csvSemicolon: "Per Excel dove i decimali si scrivono con la virgola: in italiano, spagnolo o tedesco, per esempio",
      json: {
        player: "Per gli script: ruoli, attributi e personalità come oggetti a sé",
        staff: "Per gli script: attributi, personalità e contratto come oggetti a sé",
        club: "Per gli script: tifosi, strutture, stadio e finanze come oggetti a sé",
      },
    },
    contents: {
      player:
        "Per ogni giocatore: abilità, ruoli e valutazioni per ruolo, attributi sulla scala 1–20 (anche quelli " +
        "nascosti), personalità, reputazione, presenze e contratto con le sue clausole, con la data del gioco. Il " +
        "denaro è in sterline, come lo tiene il gioco. Nel gioco non cambia nulla.",
      staff:
        "Per ogni membro dello staff: ruolo e società, abilità, attributi sulla scala 1–20, personalità, reputazione e " +
        "contratto (stipendio e date), con la data del gioco. Il denaro è in sterline, come lo tiene il gioco. Nel gioco " +
        "non cambia nulla.",
      club:
        "Per ogni società: reputazione, anno di fondazione, abbonamenti, follower sui social media, composizione e " +
        "caratteristiche dei tifosi, strutture, stadio e finanze (saldo, budget trasferimenti, spesa e budget " +
        "settimanali per gli stipendi, prezzo del biglietto), con la data del gioco. FM tiene le finanze solo per le " +
        "società dei campionati in gioco. Il denaro è in sterline, come lo tiene il gioco. Nel gioco non cambia nulla.",
    },
    export: "Esporta",
    exporting: "Esportazione…",
    done: (entity, count, file) => `Esportat${agreeing(entity, count)} ${entityCount(entity, count)} in ${file}`,
    folder: (folder) => `in ${folder}`,
    skipped: (entity, count) => {
      const end = agreeing(entity, count);
      return count === 1
        ? `${entityCount(entity, count)} è cambiat${end} nel gioco mentre veniva lett${end} ed è stat${end} esclus${end}.`
        : `${entityCount(entity, count)} sono cambiat${end} nel gioco mentre venivano lett${end} e sono stat${end} ` +
            `esclus${end}.`;
    },
    open: "Apri",
    openTitle: "Apre il file con l'app con cui il sistema lo apre",
    show: "Mostra nella cartella",
    showTitle: "Mostra il file nella sua cartella",
    close: "Chiudi",
  },

  massEdit: {
    button: "Modifica multipla",
    buttonTitle: "Cambia i valori di tutto ciò che l'elenco mostra, prima con un'anteprima",
    title: {
      player: "Modifica multipla dei giocatori",
      staff: "Modifica multipla dello staff",
      club: "Modifica multipla delle società",
    },

    // A cosa si applica
    scope: (entity, total) =>
      `${entityCount(entity, total)} mostrat${agreeing(entity, total)} ora dall'elenco (ricerca e filtri)`,
    scopeAll: (shown) => `Cioè tutti i risultati, non solo le prime ${format(shown)} righe sullo schermo.`,
    scopeNone: (entity) =>
      `${nouns[entity].feminine ? "Nessuna" : "Nessun"} ${nouns[entity].one} corrisponde alla ricerca e ai filtri, quindi non c'è nulla da cambiare.`,
    scopeTooMany: (entity, total, limit) =>
      `${nouns[entity].feminine ? "Le" : "I"} ${entityCount(entity, total)} mostrat${agreeing(entity, total)} dall'elenco sono più di quanti ne accetti una modifica multipla ` +
      `(${format(limit)}). Restringi prima la ricerca o i filtri.`,
    loadingFields: "Lettura dei campi…",
    fieldsFailed: (reason) => `Non è stato possibile leggere i campi: ${reason}`,

    // I campi da cambiare
    groups: {
      ability: "Abilità",
      technical: "Attributi tecnici",
      mental: "Attributi mentali",
      physical: "Attributi fisici",
      goalkeeping: "Attributi da portiere",
      hidden: "Attributi nascosti",
      feet: "Piedi",
      coaching: "Attributi di allenamento",
      knowledge: "Attributi di conoscenza",
      medical: "Attributi medici",
      positions: "Ruoli",
      personality: "Personalità",
      reputation: "Reputazione",
      international: "Nazionale",
      contract: "Contratto",
      facilities: "Strutture",
      finances: "Finanze",
      stadium: "Stadio",
      traits: "Caratteristiche",
      health: "Area medica",
      other: "Altro",
    },
    fieldsLabel: "Campi da cambiare",
    row: (position) => `Modifica ${position}`,
    field: "Campo",
    operation: "Operazione",
    operations: { set: "Imposta a", add: "Aggiungi", scale: "Porta a %" },
    values: { set: "Valore", add: "Quantità", scale: "Percentuale" },
    addTitle: "Si aggiunge a ogni valore così come è mostrato; un numero negativo toglie",
    addPointsTitle: "Punti percentuali aggiunti a ogni valore (70% più 10 fa 80%); un numero negativo toglie",
    rangeHint: (min, max) => `${format(min)}–${format(max)}`,
    amountHint: (max) => `±${format(max)}`,
    ofCurrent: "% dell'attuale",
    percentTitle: "Una percentuale del valore attuale: 100 lo lascia com'è, 110 lo alza di un decimo, 50 lo dimezza",
    invalidAdd: (min, max) => `Inserisci un numero intero da ${format(min)} a ${format(max)}`,
    invalidPercent: (min, max) => `Inserisci una percentuale intera da ${min} a ${max}`,
    dateSetOnly: "Una data si può solo impostare",
    addField: "Aggiungi un campo",
    addFieldFull: (max) => `Una modifica multipla cambia al massimo ${max} campi`,
    remove: "Rimuovi questo campo",
    removeLast: "Una modifica multipla ha bisogno di almeno un campo",

    // L'anteprima
    preview: "Anteprima",
    previewing: "Anteprima in corso…",
    previewBlocked: "Compila ogni campo con un valore valido per vedere l'anteprima",
    summary: (entity, preview) =>
      [
        preview.changes === 0
          ? "Nessuna modifica"
          : `${changeCount(preview.changes)} per ${format(preview.targets - preview.unchanged)} su ` +
            entityCount(entity, preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 ha già questi valori"
            : `${format(preview.unchanged)} hanno già questi valori`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Modifiche che farebbe la modifica multipla",
    columns: { name: "Nome", field: "Campo", change: "Modifica", reason: "Motivo" },
    more: (count) => `e altri ${format(count)}`,
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Valori che la modifica multipla lascia invariati",

    // Applica e annulla
    apply: "Applica",
    applying: "Applicazione…",
    applyTitle: (count) => `Scrive ${changeCount(count).toLowerCase()} nel gioco`,
    applyFirst: "Prima guarda l'anteprima della modifica multipla",
    applyNothing: "L'anteprima non ha modifiche da scrivere",
    hint: "Nel gioco non cambia nulla finché non applichi.",
    applied: (count) =>
      count === 0 ? "Non è stata scritta nessuna modifica" : `${changes(count)} applicat${feminine(count)}`,
    failure: (name, label, reason) => `${name} · ${label}: ${reason}`,
    undo: "Ripristina i valori di prima",
    undoing: "Ripristino…",
    undoTitle: "Riscrive nel gioco i vecchi valori di questa modifica multipla",
    undone: (count) =>
      count === 0 ? "Non è stato annullato nulla" : `${changes(count)} annullat${feminine(count)}`,
    undoFailure: (who, reason) => `${who}: ${reason}`,
    changeNumber: (id) => `Modifica ${id}`,
    close: "Chiudi",
  },

  comparison: {
    compare: "Confronta",
    add: "Aggiungi al confronto",
    remove: "Togli dal confronto",
    full: (max) => `Un confronto contiene al massimo ${max} giocatori. Togline uno per aggiungere questo giocatore.`,

    trayLabel: "Giocatori da confrontare",
    removePlayer: (name) => `Togli dal confronto: ${name}`,
    clear: "Azzera",
    open: (count) => `Confronta (${count})`,

    title: "Confronto",
    hint: "In ogni riga è evidenziato il valore migliore: il più alto, o il più basso dove più basso è meglio.",
    tooFew: "Aggiungi almeno due giocatori per confrontarli.",
    loading: "Caricamento dei giocatori…",
    tableLabel: "Valori dei giocatori a confronto",
    highest: "il più alto",
    lowest: "il più basso",
    profile: "Profilo",
    close: "Chiudi",
  },

  move: {
    button: "Trasferisci",
    buttonTitle: "Trasferisce questo giocatore in un'altra società nel gioco, anche a pagamento se vuoi",

    // La finestra
    title: "Trasferimento",
    from: "Da",
    to: "A",

    modeLabel: "Trasferimento o scambio",
    modeMove: "Trasferisci in una società",
    modeSwap: "Scambia con un giocatore",

    // La scelta del club
    searchLabel: "Cerca la società in cui trasferirlo",
    resultsLabel: "Società trovate",
    searching: "Ricerca delle società…",
    searchFailed: (reason) => `Non è stato possibile cercare le società: ${reason}`,
    more: (count) => `e altri ${format(count)}; scrivi per restringere la ricerca`,
    change: "Scegli un'altra società",

    // Il costo
    feeHeading: "Costo",
    fee: "Costo del trasferimento",
    feeHint: "Lascialo vuoto per un trasferimento a parametro zero",
    feeInvalid: (max) => `Inserisci un importo intero, da 0 a ${max}`,
    pays: (club, fee, balance, budget) =>
      `${club} paga ${fee}: saldo ${balance}${budget === null ? "" : `, budget trasferimenti ${budget}`}`,
    receives: (club, fee, balance) => `${club} incassa ${fee}: saldo ${balance}`,
    noFinances: (club) => `${club} non ha finanze nel gioco: il suo denaro resta com'è`,

    // Il contratto
    wageInvalid: "Inserisci un importo intero, 0 o più",
    expiresInvalid: "Inserisci una data",

    // Cosa dice la finestra del trasferimento
    chooseClub: "Scegli la società in cui trasferire il giocatore.",
    fixTerms: "Correggi prima il costo o i valori del contratto.",
    checking: "Verifica del trasferimento…",
    route: (from, to) => `${from} → ${to}`,
    doesHeading: "Cosa fa il trasferimento",
    does: [
      "Entra nella prima squadra della nuova società",
      "Contratto datato dalla data del gioco; numero di maglia azzerato",
      "Esce dalle liste dei trasferimenti e dei prestiti",
      "Stipendio e scadenza del contratto cambiano solo se ne imposti di nuovi",
      "Il costo esce dal saldo e dal budget trasferimenti della società che compra ed entra nel saldo della società che vende",
      "Una fascia di capitano nella vecchia società resta vuota",
      "La cronologia dei trasferimenti del gioco non lo riporta ancora",
      "Compare in Modifiche, dove un solo annullamento toglie il trasferimento e il costo",
    ],

    // Un club con la lista della rosa piena
    noRoom: (club) => `${club} non ha posto nella rosa.`,
    noRoomInfoLabel: "Perché?",
    noRoomInfo:
      "L'editor ingrandisce una lista della rosa piena dove può, ma questa non può ingrandirla: un giocatore deve " +
      "andarsene per fare posto.",
    noRoomNeed: (player, club) => `Perché ${player} possa arrivare, un giocatore deve lasciare ${club}.`,
    releaseChoice: "Svincola:",
    releasePickLabel: "Giocatore da svincolare",
    releaseOutcome: "→ diventa svincolato",
    injuredTag: "infortunato",
    captainTag: "capitano",
    swapChoice: "Fanne uno scambio:",
    swapChoiceOutcome: (club) => `questo giocatore va a ${club}`,
    moveAndRelease: (name) => `Trasferisci e svincola ${name}`,
    makeRoomDoes: [
      "Entra nella prima squadra della nuova società, al posto del giocatore svincolato",
      "Il giocatore svincolato lascia ogni squadra di quella società e il suo contratto finisce: diventa svincolato",
      "Contratto datato dalla data del gioco; numero di maglia azzerato",
      "Esce dalle liste dei trasferimenti e dei prestiti",
      "Stipendio e scadenza del contratto cambiano solo se ne imposti di nuovi",
      "Il costo esce dal saldo e dal budget trasferimenti della società che compra ed entra nel saldo della società che vende",
      "Una fascia di capitano che uno dei due aveva nella società che lascia resta vuota",
      "La cronologia dei trasferimenti del gioco non lo riporta ancora",
      "Compare in Modifiche come una sola modifica, dove un solo annullamento toglie il trasferimento, lo svincolo e " +
        "il costo",
    ],

    // Lo scambio con un giocatore del club
    swapTitle: "Scambio con un giocatore",
    swapWith: "Scambia con",
    playerSearchLabel: "Cerca il giocatore con cui scambiarlo",
    playerSearch: "Cerca i giocatori di questa società per nome",
    playersLabel: "Giocatori trovati",
    playersSearching: "Ricerca dei giocatori…",
    playersSearchFailed: (reason) => `Non è stato possibile cercare i giocatori: ${reason}`,
    playersEmpty: (query) =>
      query === "" ? "Questa società non ha giocatori." : `Nessun giocatore di questa società corrisponde a «${query}».`,
    changePlayer: "Scegli un altro giocatore",

    // Cosa dice la finestra dello scambio
    swapContract: "Ogni giocatore tiene il suo contratto; stipendi e scadenze non cambiano.",
    staffButtonTitle: "Sposta questo membro dello staff in un'altra società nel gioco",
    staffChooseClub: "Scegli la società in cui spostare questo membro dello staff.",
    staffContract: "Mantiene ruolo, stipendio e scadenza del contratto; il contratto è datato dalla data del gioco.",
    staffJob: "Ruolo",
    staffJobChoose: "Scegli un ruolo…",
    staffJobKept: (job) => `${job} (lo mantiene)`,
    staffNewJob:
      "Prende il nuovo ruolo e mantiene stipendio e scadenza del contratto; il contratto è datato dalla data del gioco.",
    staffDoes: [
      "Entra nella nuova società dove c'è il ruolo: nello staff medico, tecnico o degli osservatori, oppure come " +
        "direttore sportivo o allenatore, che una società che ne ha già uno non accetta",
      "Stesso stipendio e stessa scadenza; il contratto è datato dalla data del gioco",
      "Un allenatore che lascia una squadra ne lascia vuoto il posto, che la società riempirà; la dirigenza è lasciata " +
        "al gioco",
      "Compare in Modifiche, dove si può annullare",
    ],
    staffSignButtonTitle: "Tessera per una società nel gioco questo membro dello staff, che non ha una società",
    staffSignTitle: "Tessera un membro dello staff",
    staffSignChooseClub: "Scegli la società per cui tesserarlo.",
    staffSignChooseJob: "Scegli il ruolo che avrà nella società.",
    staffSignTerms:
      "Lasciali vuoti per lo stipendio del membro dello staff della società con il ruolo più simile al suo e un contratto " +
      "fino alla fine della prossima stagione.",
    staffSignRoute: (to) => `Senza società → ${to}`,
    staffSignContract: (wage, expires) => `Nuovo contratto: ${wage} a settimana fino al ${expires}`,
    staffSignDoes: [
      "Entra nella società dove c'è il ruolo: nel suo reparto, ingrandito se è pieno, oppure come direttore sportivo o " +
        "allenatore, se non ne ha uno",
      "Un nuovo contratto dalla data del gioco, in uno degli spazi liberi per i contratti del gioco stesso, come lo " +
        "crea il gioco",
      "Modellato sul contratto del membro dello staff della società con lo stesso ruolo (altrimenti dello stesso reparto, " +
        "altrimenti di chiunque) più vicino alla sua abilità",
      "Il tuo stipendio e la tua scadenza, oppure lo stipendio di quel contratto e la fine della prossima stagione; " +
        "nessuna clausola o bonus",
      "Compare in Modifiche, dove un solo annullamento toglie tutto",
    ],
    swapChooseClub: "Scegli la società del giocatore con cui scambiarlo.",
    swapChoosePlayer: "Scegli il giocatore con cui scambiarlo.",
    swapChecking: "Verifica dello scambio…",
    swapRoute: (player, from, to, other) => `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "Cosa fa lo scambio",
    swapDoes: [
      "Ognuno entra nella prima squadra della società dell'altro",
      "Contratti datati dalla data del gioco; numeri di maglia azzerati",
      "Entrambi escono dalle liste dei trasferimenti e dei prestiti",
      "Una fascia di capitano nelle vecchie società resta vuota",
      "Non si paga nessun costo; la cronologia della carriera non viene aggiornata",
      "Compare in Modifiche come una sola modifica, che annulla entrambi gli spostamenti",
    ],

    // Il tesseramento di uno svincolato
    signButtonTitle: "Tessera questo svincolato per una società nel gioco",
    signTitle: "Tessera uno svincolato",
    signChooseClub: "Scegli la società per cui tesserare il giocatore.",
    signChecking: "Verifica del tesseramento…",
    signTerms:
      "Lasciali vuoti per lo stipendio del giocatore della società più vicino alla sua abilità e un contratto fino alla " +
      "fine della prossima stagione.",
    signRoute: (to) => `Svincolato → ${to}`,
    signContract: (wage, expires, status) => `Nuovo contratto: ${wage} a settimana fino al ${expires}, ${status}`,
    signDoesHeading: "Cosa fa il tesseramento",
    signDoes: [
      "Entra nella prima squadra della società; una lista della rosa piena viene ingrandita",
      "Un nuovo contratto dalla data del gioco, in uno degli spazi liberi per i contratti del gioco stesso, come lo " +
        "crea il gioco",
      "Modellato sul contratto del giocatore della società più vicino alla sua abilità: stesso tipo di contratto e stesso " +
        "stato in rosa",
      "Il tuo stipendio e la tua scadenza, oppure lo stipendio di quel giocatore e la fine della prossima stagione",
      "Nessun numero di maglia, bonus fedeltà, clausola o bonus",
      "La cronologia dei trasferimenti del gioco non lo riporta ancora",
      "Compare in Modifiche, dove un solo annullamento toglie tutto",
    ],
    signHint: "Nel gioco non cambia nulla finché non premi Tessera.",
    sign: "Tessera",
    signing: "Tesseramento…",

    // Il piè di pagina
    hint: "Nel gioco non cambia nulla finché non premi Trasferisci.",
    move: "Trasferisci",
    moving: "Trasferimento…",
    cancel: "Annulla",
    swapHint: "Nel gioco non cambia nulla finché non premi Scambia.",
    swap: "Scambia",
    swapping: "Scambio…",
  },

  ties: {
    heading: "Nazionalità e vivaio",
    nationalities: "Seconde nazionalità",
    trainedInNation: "Vivaio nazionale",
    trainedAtClub: "Vivaio del club",
    workPermit: "Senza permesso di lavoro in",
    none: "Nessuna",
    rules: {
      1: "Cresciuto nel vivaio 15-21",
      2: "Cresciuto nel vivaio 0-21",
      5: "Cresciuto nel vivaio 15-21 (esclusi i prestiti)",
      10: "Cresciuto nel vivaio 0-19 (1 anno)",
    },
    rule: (code) => `Regola vivaio ${format(code)}`,

    // Il pulsante sotto il gruppo e la finestra che apre
    change: "Cambia",
    changeTitle: "Cambia nel gioco le seconde nazionalità di questo giocatore e il suo stato di cresciuto nel vivaio",
    title: "Nazionalità e vivaio",
    hint: "Ogni modifica viene scritta subito nel gioco e compare in Modifiche, dove si può annullare.",
    full:
      "Il gioco ha fatto la lista di questo giocatore grande quanto basta per ciò che contiene: una nazionalità o una " +
      "formazione si può cambiare o togliere, ma non aggiungere.",
    nationOf: (name) => `Nazione al posto di ${name}`,
    ruleOf: (name) => `Regola vivaio per ${name}`,
    remove: "Togli",
    removeTitle: (name) => `Togli ${name}`,
    addNationality: "Aggiungi una nazionalità…",
    addNation: "Aggiungi una nazione…",
    addPermit: "Aggiungi un paese senza permesso di lavoro…",
    daysLeft: (days) => (days === 1 ? "1 giorno rimasto" : `${format(days)} giorni rimasti`),
    permitInfoLabel: "Cosa fa?",
    permitInfo:
      "Il gioco permette ai giocatori dell'Unione Europea che erano in Inghilterra o in Scozia prima della Brexit di " +
      "giocarci senza permesso di lavoro, per un certo numero di giorni. Un giocatore a cui dai questo non ha bisogno " +
      "del permesso di lavoro per giocare in quel paese, per tanti giorni quanti ne restano ai loro (dieci anni dove " +
      "nessuno nel salvataggio ce l'ha).",
    newRule: "Regola vivaio della nuova nazione",
    add: "Aggiungi",
    changeClub: "Cambia società",
    changeClubTitle: (name) => `Lo fa cresciuto in un'altra società al posto di ${name}`,
    clubInsteadOf: (name) => `Società al posto di ${name}`,
    addClub: "Aggiungi una società…",
    addClubTitle: "Lo fa cresciuto in una società in più",
    newClub: "Nuova società",
    pickAnother: "Scegline un altro",
    newClubRule: "Regola vivaio della nuova società",
    cancel: "Annulla",
    working: "Scrittura nel gioco…",
    close: "Chiudi",
  },

  clauses: {
    change: "Cambia",
    changeTitle: "Cambia nel gioco i bonus e le clausole di questo giocatore",
    title: "Bonus e clausole",
    hint: "Ogni modifica viene scritta subito nel gioco e compare in Modifiche, dove si può annullare.",
    full:
      "Il gioco ha fatto la lista di questo contratto grande quanto basta per ciò che contiene: un bonus o una " +
      "clausola si può cambiare o togliere, ma non si può aggiungere una clausola di rescissione.",
    amountOf: (name) => `Importo di ${name}`,
    conditionOf: (name) => `Condizione di ${name}`,
    save: "Salva",
    remove: "Togli",
    removeTitle: (name) => `Togli ${name}`,
    addRelease: "Aggiungi una clausola di rescissione",
    releaseAmount: "Importo della nuova clausola di rescissione",
    add: "Aggiungi",
    outOfRange: (max) => `Inserisci un numero intero da 0 a ${max}.`,
    working: "Scrittura nel gioco…",
    close: "Chiudi",
  },

  release: {
    button: "Svincola",
    buttonTitle: "Svincola questo giocatore dalla sua società nel gioco: diventa svincolato",

    // La finestra
    title: "Svincolo",
    from: "Lascia",
    checking: "Verifica dello svincolo…",
    ready: (club) => `${club} → svincolato`,
    doesHeading: "Cosa fa lo svincolo",
    does: [
      "Lascia ogni squadra della società e il contratto finisce: uno svincolato che qualsiasi società può tesserare",
      "Nessuno viene pagato",
      "Una fascia di capitano nella società resta vuota",
      "La cronologia dei trasferimenti del gioco non lo riporta",
      "Compare in Modifiche, dove un solo annullamento riporta il giocatore con lo stesso contratto",
    ],

    // Il piè di pagina
    hint: "Nel gioco non cambia nulla finché non premi Svincola.",
    release: "Svincola",
    releasing: "Svincolo…",
    cancel: "Annulla",
  },

  permanent: {
    title: "Rendi definitivo il prestito",
    stays: "Resta presso",
    leaves: "Lascia",
    checking: "Verifica…",
    doesHeading: "Cosa fa",
    does: [
      "Resta dove gioca, da oggi sotto contratto con quella società, alle condizioni qui sopra",
      "Mantiene il numero di maglia e lo stato in rosa che ha lì",
      "Lascia ogni squadra della sua società e il prestito finisce",
      "La cronologia dei trasferimenti del gioco non lo riporta",
      "Compare in Modifiche come un trasferimento, dove un solo annullamento ripristina il prestito",
    ],
    optionFee: (money) => `Compilato dal diritto di riscatto del prestito: ${money}`,
    hint: "Nel gioco non cambia nulla finché non premi Rendi definitivo.",
    confirm: "Rendi definitivo",
    confirming: "In corso…",
    cancel: "Annulla",
  },

  recall: {
    title: "Richiama dal prestito",
    from: "In prestito presso",
    to: "Torna a",
    doesHeading: "Cosa fa il richiamo",
    does: (parent) => [
      "Oggi diventa l'ultimo giorno del prestito: a fine giornata il gioco chiude il prestito da solo",
      `Continua di un giorno nel gioco e tornerà alla sua società, ${parent}`,
      "Fino ad allora compare in Modifiche, dove un annullamento rimette la vecchia scadenza del prestito",
    ],
    termsHeading: "Nel gioco",
    notRecallable: (parent) => `Il prestito non permette a ${parent} di richiamarlo`,
    notTerminable: "Il prestito non può finire in anticipo",
    worksAnyway:
      "Il richiamo qui funziona lo stesso: non passa dal richiamo del gioco, sposta l'ultimo giorno del prestito",
    dropsOption: (club, amount) =>
      `Il diritto di riscatto di ${club} per ${amount} viene tolto: altrimenti, alla fine del prestito, il gioco ` +
      `potrebbe cederlo a ${club}`,
    hint: "Nel gioco non cambia nulla finché non premi Richiama.",
    confirm: "Richiama",
    confirming: "Richiamo…",
    cancel: "Annulla",
  },

  squad: {
    teamsLabel: "Squadra",
    teams: {
      first: "Prima squadra",
      b: "Squadra B",
      age: (limit) => `U${limit}`,
      other: (place) => `Squadra ${place}`,
    },
    noTeams: "Questa società non ha squadre.",
    loading: "Lettura della rosa…",
    empty: "Nessun giocatore in questa squadra.",

    // Sopra la tabella
    players: (count) => playerCount(count),
    averageAge: (age) => `età media ${age}`,
    captains: (captain, viceCaptain) => `Capitano: ${captain} · Vice capitano: ${viceCaptain}`,

    // Le azioni su tutta la squadra
    actionsLabel: "Azioni su tutta la squadra",
    healAll: (injured) =>
      injured === 0 ? "Guarisci tutti" : `Guarisci tutti (${format(injured)} infortunat${masculine(injured)})`,
    healAllTitle: "Guarisce ogni infortunio di ogni giocatore di questa squadra",
    healNone: "Nessuno in questa squadra è infortunato",
    liftAll: (banned) =>
      banned === 0 ? "Revoca squalifiche" : `Revoca squalifiche (${format(banned)} squalificat${masculine(banned)})`,
    liftAllTitle: "Revoca ogni squalifica di ogni giocatore di questa squadra",
    liftNone: "Nessuno in questa squadra è squalificato",
    inspireAll: "Motiva tutti",
    inspireAllTitle:
      "Porta a 20, il massimo, il morale di ogni giocatore di questa squadra e toglie i suoi motivi di scontento",
    cohesionWithout: (count: number) =>
      count === 1
        ? "1 giocatore non ha ancora affiatamento con la società"
        : `${format(count)} giocatori non hanno ancora affiatamento con la società`,
    maxCohesion: "Massimo affiatamento",
    maxCohesionTitle:
      "Porta a 100, il massimo, l'affiatamento con la società di ogni giocatore di questa squadra. Il gioco mostra l'affiatamento della squadra nella pagina Dinamiche quando va avanti: premi Continua nel gioco",
    cohesionNone:
      "L'editor non riesce a leggere l'affiatamento di questa squadra: questa versione del gioco non è stata verificata, oppure nessuno dei suoi giocatori ha affiatamento con la società",
    refreshAll: "Rigenera tutti",
    refreshAllTitle:
      "Porta al 100% energia e forma partita di ogni giocatore di questa squadra e lo fa riposare del tutto " +
      "(stanchezza -500)",
    maxAll: "Attributi al massimo",
    maxAllTitle:
      "Porta ogni attributo di ogni giocatore di questa squadra al suo meglio: 20, e 1 per propensione agli infortuni " +
      "e fallosità",
    hint:
      "Le azioni riguardano ogni giocatore dell'elenco, anche quelli in prestito altrove. Si possono annullare anche " +
      "nella vista Modifiche.",

    // Il congelamento di tutta la squadra
    freezeLabel: "Congela tutta la squadra",
    freezeAttributes: "Congela gli attributi",
    freezeAttributesTitle:
      "Finché l'app è aperta e connessa, gli attributi di ogni giocatore di questa squadra non peggiorano: quello che " +
      "il gioco toglie viene rimesso, e i miglioramenti contano lo stesso",
    freezeFitness: "Congela energia e forma",
    freezeFitnessTitle:
      "Finché l'app è aperta e connessa, energia e forma partita di ogni giocatore di questa squadra non calano: " +
      "quello che il gioco toglie viene rimesso. Usa prima Rigenera tutti per tenerle al 100%",
    freezePositions: "Congela i ruoli",
    freezePositionsTitle:
      "Finché l'app è aperta e connessa, le valutazioni per ruolo di ogni giocatore di questa squadra restano come " +
      "sono: una valutazione che il gioco alza o abbassa viene rimessa",
    frozenCount: (frozen, total) => `${format(frozen)} su ${format(total)}`,
    freezeHint:
      "Il congelamento riguarda ogni giocatore dell'elenco e lo segue ovunque vada. L'app se lo ricorda per questo " +
      "salvataggio.",
    frozeAttributes: (count) =>
      count === 0 ? "I loro attributi erano già congelati" : `Congelati gli attributi di ${playerCount(count)}`,
    unfrozeAttributes: (count) => `Scongelati gli attributi di ${playerCount(count)}`,
    frozeFitness: (count) =>
      count === 0
        ? "La loro energia e la loro forma erano già congelate"
        : `Congelate energia e forma di ${playerCount(count)}`,
    unfrozeFitness: (count) => `Scongelate energia e forma di ${playerCount(count)}`,
    frozePositions: (count) =>
      count === 0 ? "I loro ruoli erano già congelati" : `Congelati i ruoli di ${playerCount(count)}`,
    unfrozePositions: (count) => `Scongelati i ruoli di ${playerCount(count)}`,

    // Cosa ha fatto un'azione, sotto i pulsanti
    written: (count) => `${changes(count)} scritt${feminine(count)}`,
    refused: (name, reason) => `${name}: ${reason}`,
    undo: "Ripristina",
    undoTitle: "Riscrive nel gioco i vecchi valori di queste modifiche",

    // Capitani
    captainShort: "C",
    viceCaptainShort: "VC",
    menuLabel: (name) => `Fascia di capitano di ${name}`,
    menuTitle: "Fascia di capitano",
    makeCaptain: "Nomina capitano",
    makeViceCaptain: "Nomina vice capitano",
    nowCaptain: (name) => `Ora il capitano è ${name}`,
    nowViceCaptain: (name) => `Ora il vice capitano è ${name}`,
    noCaptain: "Ora nessuno è capitano",
    noViceCaptain: "Ora nessuno è vice capitano",

    // La tabella
    tableLabel: (team) => `Giocatori di ${team}`,
    openProfile: "Apri il profilo del giocatore",
    columns: {
      name: "Nome",
      position: "Ruolo",
      age: "Età",
      currentAbility: "AA",
      potentialAbility: "AP",
      condition: "Energia",
      matchSharpness: "Forma",
      jadedness: "Stanch.",
      morale: "Morale",
      cohesion: "Affiat.",
      actions: "Fascia di capitano",
    },
    sortBy: (by) => `Ordina per ${by}`,
    sortNames: {
      name: "nome",
      position: "ruolo",
      age: "età",
      currentAbility: "abilità attuale",
      potentialAbility: "abilità potenziale",
      condition: "energia",
      matchSharpness: "forma partita",
      jadedness: "stanchezza",
      morale: "morale",
      cohesion: "affiatamento",
    },

    // Le etichette dopo un nome, con il loro significato come testo al passaggio del mouse
    injured: "Infortunato",
    injuredTitle: (count) => (count === 1 ? "1 infortunio" : `${format(count)} infortuni`),
    banned: "Squalificato",
    bannedTitle: (count) => (count === 1 ? "1 squalifica" : `${format(count)} squalifiche`),
    onLoan: "In prestito",
    onLoanTitle: "In prestito a un'altra società",
    loanee: "In prestito qui",
    loaneeTitle: "Qui in prestito da un'altra società",
    elsewhere: "Altrove",
    elsewhereTitle: "Gioca in un'altra squadra della società",
    frozen: "Congelato",
    frozenTitle: (attributes, fitness, positions) => {
      const frozen = [
        ...(attributes ? ["attributi"] : []),
        ...(fitness ? ["energia", "forma partita"] : []),
        ...(positions ? ["ruoli"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} e ${last}` : last;
      return `Congelati: ${listed}`;
    },
  },

  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Negozio sconosciuto",
    },
    steamBuild: (id) => `build ${id}`,
  },

  scouting: {
    nav: "Osservatori",
    reading: "Lettura della tua società…",
    refresh: "Aggiorna",
    refreshTitle: "Rilegge la società dal gioco",
    searching: "Ricerca…",
    none: "—",
    perWeek: "/sett.",
    openProfile: "Apri il profilo",
    freeAgent: "Svincolato",
    loan: "Prestito",
    header: {
      transferBudget: "Budget trasferimenti",
      wageRoom: "Margine stipendi",
      wageBudget: "Budget stipendi",
      squad: "Rosa",
      averageAge: "Età media",
      players: (count) => playerCount(count),
    },
    tabs: {
      label: "Sezioni degli osservatori",
      recommend: "Consigli di mercato",
      depth: "Profondità della rosa",
      departures: "Giocatori da cedere",
    },
    status: {
      missing: "Scoperto",
      thin: "Corto",
      fine: "Adeguato",
      crowded: "Affollato",
    },
    lines: {
      goalkeeper: "Portiere",
      centreBack: "Difensore centrale",
      fullBack: "Terzino",
      wingBack: "Esterno",
      defensiveMidfield: "Centrocampo difensivo",
      centralMidfield: "Centrocampo centrale",
      attackingMidfield: "Centrocampo offensivo",
      wide: "Fascia",
      striker: "Attaccante",
    },
    depthLines: {
      gk: "Portieri",
      dc: "Difensori centrali",
      rightBack: "Terzini destri",
      leftBack: "Terzini sinistri",
      dm: "Centrocampisti difensivi",
      mc: "Centrocampisti centrali",
      rightWing: "Ali destre",
      leftWing: "Ali sinistre",
      amc: "Centrocampisti offensivi",
      st: "Attaccanti",
    },
    positionTip: (line, count, target, status) =>
      `${line}: ${format(count)} in rosa (di solito ${format(target)}) — ${status}`,
    brief: {
      heading: "Che cosa cerchi?",
      pitch: "Ruolo",
      legend: "I punti mostrano com'è messa la rosa in ogni reparto.",
      inPossession: "In possesso",
      outOfPossession: "Non in possesso",
      anyRole: "Qualsiasi — il ruolo migliore per ogni giocatore",
      purpose: "Per",
      filters: "Filtri",
      minAge: "Età min",
      maxAge: "Età max",
      maxFee: "Costo max",
      minProbability: "Probabilità",
      anyProbability: "Qualsiasi",
      noFreeAgents: "Niente svincolati",
    },
    purposes: {
      firstTeam: "Prima squadra",
      rotation: "Turnover",
      future: "Futuro",
      any: "Tutti",
    },
    purposeTips: {
      firstTeam: "Meglio del tuo miglior giocatore in questo ruolo",
      rotation: "Bravo quanto la tua seconda scelta, a un prezzo ragionevole",
      future: "21 anni o meno, con margini di crescita",
      any: "Chiunque sia adatto",
    },
    ask: {
      before: "Consigli per ",
      after: "",
      anyRole: "il ruolo migliore per giocatore",
    },
    own: {
      heading: "Nella tua rosa",
      empty: "Nessuno nella tua rosa gioca qui.",
      position: "Ruolo",
    },
    summary: (candidates, eligible, shown, purpose) =>
      `${format(candidates)} giocatori possono giocare qui · ${format(eligible)} adatti a «${purpose}» · ` +
      `${format(shown)} consigliati`,
    how: {
      label: "Come viene fatto questo elenco?",
      note: (rule, count) =>
        `L'osservatore guarda ogni giocatore che può giocare in questo ruolo (con una valutazione di almeno 10), ` +
        `escludendo i giocatori della tua società e quelli degli altri allenatori umani. Di questi tiene quelli che ${rule}. ` +
        `Per i 400 più adatti calcola quanto è probabile che ognuno venga da te, poi consiglia i migliori ${count} per ` +
        "idoneità e probabilità insieme. Ordine consigliato: 70% idoneità e 30% probabilità, un po' meno per i " +
        "giocatori oltre i 30 anni; Turnover pesa le due cose allo stesso modo e Futuro tiene conto anche del " +
        "potenziale. Fai clic sul titolo di una colonna per ordinare l'elenco; # è l'ordine dell'osservatore.",
    },
    purposeRules: {
      firstTeam: "sono più adatti al ruolo del tuo miglior giocatore lì",
      rotation: "sono adatti almeno quanto la tua seconda scelta",
      future: "hanno 21 anni o meno e margini di crescita (potenziale di almeno 15 sopra l'abilità)",
      any: "sono comunque adatti",
    },
    sortBy: (by) => `Ordina per ${by}`,
    sortNames: {
      rank: "l'ordine dell'osservatore",
      name: "nome",
      age: "età",
      ca: "abilità attuale",
      pa: "abilità potenziale",
      fit: "idoneità",
      probability: "probabilità",
      fee: "costo",
    },
    backToScoutOrder: "Torna all'ordine dell'osservatore",
    showMore: (count) => `Mostra altri ${format(count)}`,
    playsFor: (club) => `gioca per ${club}`,
    empty: "Nessun consiglio per questo ruolo con queste impostazioni. Prova lo scopo Tutti o filtri più larghi.",
    columns: {
      rank: "#",
      ca: "AA",
      pa: "AP",
      player: "Giocatore",
      age: "Età",
      fit: "Idoneità",
      role: "Ruolo",
      probability: "Probabilità",
      fee: "Costo stim.",
      wage: "Stipendio",
      note: "Nota dell'osservatore",
      money: "Costo",
      value: "Valore",
    },
    probabilityInfo:
      "Quanto è probabile che il giocatore venga nella tua società: una stima dal suo valore, contratto, società e reputazione.",
    probabilityInfoLabel: "Che cos'è la probabilità?",
    fitTitle: (inPossession, outOfPossession, position) =>
      [
        inPossession !== null && `In possesso: ${inPossession}`,
        outOfPossession !== null && `Non in possesso: ${outOfPossession}`,
        `Ruolo: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note:
      "L'idoneità usa i pesi degli attributi dell'editor per ogni ruolo; costi, stipendi e probabilità sono stime.",
    depth: {
      summary: (size, age, level) =>
        `${format(size)} giocatori${age === null ? "" : ` · età media ${age}`} · abilità media dei migliori undici ` +
        level,
      weak: "Sotto il livello della rosa",
      ageing: "In là con gli anni",
      cover: (names) => `Possono giocare qui anche: ${names}`,
      advice: "Chiedi consigli",
      adviceTitle: "Consigli di mercato per questo reparto",
      empty: "Nessuno",
      ability: "Abilità attuale",
      more: (count) => `+${format(count)} altri`,
      columns: {
        line: "Reparto",
        status: "Stato",
        count: "Giocatori",
        players: "Prima i migliori (abilità)",
        cover: "Possono giocare qui anche",
        age: "Età media",
      },
      countTitle: (count, target) =>
        `${format(count)} giocatori il cui ruolo migliore è in questo reparto; di solito una rosa ne ha ${format(target)}`,
      statusHelp: {
        missing: "Nessuno gioca qui.",
        thin: "Meno di quanti ne ha di solito una rosa; i giocatori che possono coprire valgono la metà.",
        fine: "Più o meno quanti ne ha di solito una rosa.",
        crowded: "Due o più giocatori oltre quanti ne ha di solito una rosa.",
      },
      attention: "Da guardare:",
      allFine: "Ogni reparto sembra equilibrato.",
    },
    departures: {
      intro: "I giocatori che il tuo osservatore lascerebbe andare, prima i più urgenti.",
      filter: "Consiglio",
      all: "Tutti",
      empty: "In questo momento il tuo osservatore non lascerebbe andare nessuno.",
      sortNames: {
        rank: "l'ordine dell'osservatore",
        name: "nome",
        age: "età",
        ca: "abilità attuale",
        pa: "abilità potenziale",
        value: "valore",
        wage: "stipendio",
        contract: "scadenza del contratto",
      },
      columns: {
        player: "Giocatore",
        age: "Età",
        ability: "Abilità",
        value: "Valore",
        wage: "Stipendio",
        contract: "Contratto fino al",
        advice: "Consiglio",
        reasons: "Motivi",
      },
      actions: { sell: "Vendi", loan: "Manda in prestito", release: "Svincola" },
      rank: (line, rank) => `${line} · ${rank}º`,
    },
    roles: {
      bgk: "Portiere di costruzione",
      ngk: "Portiere senza rischi",
      sk: "Portiere libero",
      lhk: "Portiere bloccato",
      cb: "Difensore centrale",
      bcb: "Difensore centrale di costruzione",
      ncb: "Difensore centrale senza rischi",
      acb: "Difensore centrale avanzato",
      ocb: "Difensore centrale di inserimento",
      scb: "Difensore centrale di anticipo",
      ccb: "Difensore centrale di copertura",
      wcb: "Braccetto di difesa",
      fb: "Terzino",
      ifb: "Difensore centrale aggiunto",
      pfb: "Terzino di gamba",
      hfb: "Terzino bloccato",
      wb: "Esterno",
      iwb: "Mediano aggiunto",
      pwb: "Esterno di regia",
      awb: "Esterno offensivo",
      hwb: "Esterno bloccato",
      dm: "Centrocampista difensivo",
      hb: "Centrale aggiunto in costruzione",
      ddm: "Centrale aggiunto in difesa",
      pdm: "Mediano di quantità",
      bbm: "Tuttocampista",
      bbp: "Regista mobile",
      cm: "Centrocampista centrale",
      pcm: "Centrocampista di quantità",
      scm: "Centrocampista di interdizione",
      chm: "Centrocampista d'inserimento",
      wcm: "Centrocampista centrale largo",
      ap: "Regista avanzato",
      am: "Centrocampista offensivo",
      oam: "Trequartista centrale avanzato",
      w: "Ala",
      if: "Attaccante che si accentra",
      pw: "Regista largo",
      wfd: "Attaccante laterale",
      tw: "Ala tornante",
      iow: "Ala invertita d'attacco",
      cfd: "Centravanti",
      dlf: "Attaccante di manovra",
      p: "Attaccante d'area",
      tcf: "Centravanti di copertura",
      ocf: "Riferimento offensivo",
    },
    reasons: {
      listed: () => "In lista trasferimenti",
      freeAgent: () => "Svincolato",
      expiring: (value) => `Il contratto scade tra ${value} giorni`,
      releaseClause: (value) => `Clausola di rescissione ${value}`,
      fringe: () => "Non è un titolare nella sua società",
      keyPlayer: () => "Giocatore chiave nella sua società",
      unwanted: () => "In esubero nella sua società",
      overBudget: (value) => `${value} oltre il tuo budget`,
      stretch: (value) => `Appena oltre il budget (+${value})`,
      wageHigh: (value) => `Stipendio di ${value}/sett. oltre il tuo margine`,
      biggerClub: () => "Gioca in una società più grande",
      smallerClub: () => "Gioca in una società più piccola",
      reputationGap: () => "Un nome troppo grande per la tua società",
      ambitious: () => "Ambizioso: accetterebbe volentieri il salto",
      notForSale: () => "Non in vendita",
    },
    departureReasons: {
      surplus: (value) => `Reparto affollato (${value} giocatori)`,
      belowLevel: () => "Sotto il livello della rosa",
      ageing: (value) => `In là con gli anni (${value})`,
      expiring: (value) => `Il contratto scade tra ${value} giorni`,
      highWage: (value) => `Stipendio alto per il suo ruolo (${value}/sett.)`,
      unhappy: () => "Scontento",
      lowMorale: () => "Morale basso",
      blocked: () => "Ha bisogno di giocare per crescere",
      unwanted: () => "Stato in rosa: in esubero",
      listed: () => "Già in lista trasferimenti",
    },
  },

  errors,
};
