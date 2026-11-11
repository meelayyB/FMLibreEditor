// The German text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), in the German of
// Germany, whose conventions the dates and numbers follow too (see `index.ts`). It speaks to the player as "Sie", as
// FM's German does ("Möchten Sie …", "Sie können …"). The comments in `en.ts` say what each string is for.
//
// The football words are the game's own: FM27 keeps every language in `languages.fmf`, and matching its English and
// German strings by key names attributes, positions, traits, clauses, squad statuses and jobs as the German game does
// ("Abschluss", "Derzeitige Fähigkeit", "Spielpraxis", "Vertragslos"), and the position abbreviations too ("TW", "VZ",
// "OMZ"; the game has none for the sweeper, so "LIB" after its "Libero"). The editor's own text is translated here.
//
// German puts the plural after every number but 1 ("0 Änderungen", "1 Änderung"); a player, a member of staff and a
// club are all masculine ("Spieler", "Mitarbeiter", "Verein"), so the words around them agree the same way, and after
// "von" a count takes the dative ("von 3 Spielern", "von 12 Vereinen").

import type { Entity } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("de-DE");
const percents = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12.345". */
const format = (value: number) => numbers.format(value);

/** "0 Änderungen", "1 Änderung", "12.345 Änderungen". */
const changes = (count: number) => (count === 1 ? "1 Änderung" : `${format(count)} Änderungen`);

/** For the places that say how many changes there are, which may be none: "Keine Änderungen", "3 Änderungen". */
const changeCount = (count: number) => (count === 0 ? "Keine Änderungen" : changes(count));

/** "1 Spieler", "12 Spieler". */
const playerCount = (count: number) => `${format(count)} Spieler`;

/** The same after "von", in the dative: "1 Spieler", "12 Spielern". */
const playersDative = (count: number) => (count === 1 ? "1 Spieler" : `${format(count)} Spielern`);

/** "1 Wert bleibt unverändert", "12 Werte bleiben unverändert". */
const valuesLeftAlone = (count: number) =>
  count === 1 ? "1 Wert bleibt unverändert" : `${format(count)} Werte bleiben unverändert`;

/** What each list holds, for one, for many, and for many in the dative. All three nouns are masculine. */
const nouns: Record<Entity, { one: string; many: string; dative: string }> = {
  player: { one: "Spieler", many: "Spieler", dative: "Spielern" },
  staff: { one: "Mitarbeiter", many: "Mitarbeiter", dative: "Mitarbeitern" },
  club: { one: "Verein", many: "Vereine", dative: "Vereinen" },
};

/** "237 Spieler", "1 Mitarbeiter", "12 Vereine". */
const entityCount = (entity: Entity, count: number) =>
  `${format(count)} ${count === 1 ? nouns[entity].one : nouns[entity].many}`;

/** The same after "von", in the dative: "von 237 Spielern", "von 1 Verein". */
const entityDative = (entity: Entity, count: number) =>
  `${format(count)} ${count === 1 ? nouns[entity].one : nouns[entity].dative}`;

/** "1 Verein", "12 Vereine". */
const clubCount = (count: number) => entityCount("club", count);

/** Squad statuses, by the codes contracts hold them as (see `en.ts`); named as the game's German text names them. */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Starspieler",
  2: "Schlüsselspieler",
  3: "Stammspieler",
  4: "Rotationsspieler",
  5: "Joker",
  7: "Ergänzungsspieler",
  9: "Notnagel",
  10: "Talent vor Durchbruch",
  11: "Perspektivspieler",
  13: "Nachwuchsspieler",
  14: "Stammspieler B-Mannschaft",
  15: "Stammtorhüter",
  16: "Pokaltorhüter",
  17: "Pokaltorhüter (nationaler Pokal)",
  20: "Ersatztorhüter",
  21: "Notnagel (Torhüter)",
  22: "Nicht benötigt",
};

/**
 * The kinds of contract (see `en.ts`). The game's German keeps the MLS's two in English ("Senior Contract"); they are
 * written here as German compounds of those names.
 */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Teilzeitvertrag",
  1: "Vollzeitvertrag",
  2: "Amateurvertrag",
  3: "Jugendvertrag",
  4: "Kein Vertrag",
  10: "Senior-Minimum-Salary-Vertrag",
  11: "Senior-Vertrag",
};

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(de, key ?? "");

/** The noun of the kind of record a failure names, or "Eintrag" when it names none; each of them is masculine. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity].one : "Eintrag";

/** The reasons the Rust side gives for a field that cannot be changed some way: whole sentences after a colon. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "Ein Datum kann nur gesetzt werden",
  "it is changed one person at a time": "Es wird immer nur bei einer Person geändert",
  "the new value is not one of the game's own records of that kind":
    "Der neue Wert ist keiner der eigenen Datensätze des Spiels dieser Art",
  "the in-game date is not known": "Das Spieldatum ist nicht bekannt",
};

const reload = "laden Sie die Daten neu und versuchen Sie es erneut";

/** The lists of a club's staff, as `staff.noRoom` names them (in the genitive). */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "der medizinischen Abteilung",
  coaching: "des Trainerstabs",
  scouting: "der Scoutingabteilung",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as (see `en.ts`); named as the game's
 * German contract screen names them where it has the kind (6 is its "Non-Playing Job Offer Release Clause").
 */
const CLAUSE_NAMES_DE: Partial<Record<number, string>> = {
  0: "Ausstiegsklausel",
  1: "Ausstiegsklausel bei Abstieg",
  2: "Ausstiegsklausel bei Nicht-Aufstieg",
  3: "Jährliche Gehaltssteigerung",
  4: "Gehaltserhöhung bei Aufstieg",
  5: "Gehaltskürzung bei Abstieg",
  6: "Ausstiegsklausel für Mitarbeiterrolle",
  8: "Beteiligung am Weiterverkauf",
  9: "Gewinnbeteiligung bei Weiterverkauf",
  10: "Prämie für bestimmte Anzahl an Saisontoren",
  11: "1-Jahr-Vertragsverlängerung bei bestimmter Anzahl Ligaspiele (nur gültig im letzten Vertragsjahr)",
  12: "Topverdiener-Klausel",
  13: "Gehaltserhöhung nach bestimmter Anzahl von Ligaspielen",
  14: "Gehaltserhöhung bei Aufstieg in höchste Liga",
  15: "Gehaltskürzung bei Abstieg aus höchster Liga",
  16: "Ausstiegsklausel (Ausländische Vereine)",
  17: "Ausstiegsklausel (Einheimische Vereine in höherer Liga)",
  18: "Ausstiegsklausel (Einheimische Vereine)",
  19: "Gehaltserhöhung nach bestimmter Anzahl von Länderspielen",
  20: "Anteil des Gehalts, das von einem Sponsor bezahlt wird (in %)",
  21: "Eintrittsgeld-Einnahmen, die an den Spieler zu zahlen sind (in %)",
  22: "Option auf Vertragsverlängerung durch Verein",
  23: "Auf Kompensationszahlung für Trainerposition verzichten",
  25: "1-Jahr-Vertragsverlängerung bei bestimmter Anzahl Ligaspiele (nur gültig bei Aufstieg im letzten Vertragsjahr)",
  26: "1-Jahr-Vertragsverlängerung bei bestimmter Anzahl Ligaspiele (nur gültig bei Klassenerhalt im letzten Vertragsjahr)",
  27: "Ausstiegsklausel (Vereine in der UEFA Champions League)",
  28: "MLS Guaranteed Contract Clause",
  29: "Vertragsverlängerung nach Aufstieg",
  30: "Entlassungsklausel bei Verletzung",
  31: "Ausstiegsklausel (Vereine im internationalen Wettbewerb)",
  32: "Auflaufprämie",
  33: "Torprämie",
  34: "Ohne-Gegentor-Prämie",
  37: "Länderspielprämie",
  38: "Ersatzspieler-Prämie",
  39: "Vorlagenprämie",
  40: "Prämie für bestimmte Anzahl an Torvorlagen",
  41: "Prämie für direkte Torbeteiligungen",
  54: "Im Spiel nicht angezeigt (54)",
  55: "Aktive Ausstiegsklausel bei Abstieg",
  56: "Aktive Ausstiegsklausel bei Nicht-Aufstieg",
  58: "Im Spiel nicht angezeigt (58)",
  63: "Im Spiel nicht angezeigt (63)",
};

/** Reasons to be unhappy, by the codes the game keeps them as (see `en.ts`). */
const CONCERN_MOTIVES_DE: Partial<Record<number, string>> = {
  596: "Nicht im Kader für einen Wettbewerb",
  808: "Findet, dass ein Mitspieler unfair behandelt wurde",
  926: "Glaubt nicht, dass ein Mitspieler die gewünschten Einsatzzeiten verdient",
};

/**
 * Players' traits (preferred moves), by their bit in the game's mask (see `en.ts`); the game's German names (39 is
 * its "Cuts Inside From Both Wings"). The game names 48, 53 and 54 nowhere, so they are worded here as it words the
 * others.
 */
const TRAIT_NAMES_DE: readonly string[] = [
  "Dribbelt über links",
  "Dribbelt über rechts",
  "Dribbelt durch die Mitte",
  "Geht in den gegnerischen Sechzehner",
  "Besetzt die Zwischenräume",
  "Geht bei jeder Gelegenheit mit nach vorne",
  "Spielt einfache Kurzpässe",
  "Versucht oft Steilpässe",
  "Fernschüsse",
  "Schießt kraftvoll",
  "Schießt platziert",
  "Schneidet den Ball an",
  "Umläuft den Torwart",
  "Versucht Abseitsfallen zu knacken",
  "Spielt mit dem Außenrist",
  "Deckt Gegenspieler eng",
  "Reibt Gegner auf",
  "Lamentiert mit Schiedsrichtern",
  "Spielt mit dem Rücken zum Tor",
  "Holt sich die Bälle weit hinten",
  "Spielt Doppelpässe",
  "Überlupft den Torwart",
  "Bestimmt das Tempo",
  "Versucht Fallrückzieher",
  "Spielt lieber ab als selbst zu schießen",
  "Vermeidet Steilpässe",
  "Hält Spiel auf",
  "Legt den Ball am Gegner vorbei",
  "Nimmt den Ball vor Dribblings auf den rechten Fuß",
  "Nimmt den Ball vor Dribblings auf den linken Fuß",
  "Klebt am Ball",
  "Erscheint spät im gegnerischen Sechzehner",
  "Löst sich spielerisch aus Bedrängnis",
  "Bleibt immer hinten",
  "Vermeidet den schwachen Fuß",
  "Versucht Tricks",
  "Versucht Freistöße aus großer Distanz",
  "Grätscht bei Zweikämpfen",
  "Bleibt in Zweikämpfen auf den Beinen",
  "Zieht von beiden Flügeln nach innen",
  "Bleibt an der Linie",
  "Feuert Publikum an",
  "Schießt bei erstbester Gelegenheit",
  "Versucht lange Pässe",
  "Wird lieber flach angespielt",
  "Schießt kraftvolle Freistöße",
  "Sucht das Dribbling gegen mehrere Gegner in Folge",
  "Spielt den Ball auf die Flügel",
  "Beendet Karriere auf höchstem Niveau",
  "Spielt so lange wie möglich",
  "Wirft den Ball lang und flach ein",
  "Dribbelt häufig",
  "Dribbelt selten",
  "Trainiert den schwachen Fuß",
  "Statischer Zielspieler",
  "Leitet mit langen Abwürfen Konter ein",
  "Vermeidet Fernschüsse",
  "Zieht vom linken Flügel nach innen",
  "Zieht vom rechten Flügel nach innen",
  "Schlägt frühe Flanken",
  "Trägt den Ball aus der Defensive",
  "Spielt den Ball mit den Füßen",
];

/** What a check is about, from the key a failure gives, with a capital. */
const checkName = (key: string | undefined) => {
  const name = (de.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) => (de.jobs as Partial<Record<number, string>>)[Number(code)] ?? code;

const errors: ErrorTexts = {
  "guard.unknownBuild": () =>
    "FMLibreEditor wurde mit dieser Version des Spiels nicht geprüft und schreibt daher nicht hinein. „Trotzdem " +
    "bearbeiten“ im Hinweis oben schaltet das Bearbeiten ein.",
  "guard.failed": (p) =>
    `${checkName(p.check)}: Die Prüfung ist in dieser Version des Spiels fehlgeschlagen, daher lässt FMLibreEditor ` +
    "diese Daten unverändert.",
  "edit.unknownField": (p) => `Hier gibt es kein bearbeitbares Feld „${p.field}“.`,
  "edit.outOfRange": (p) =>
    `${p.value} ist kein gültiger Wert für ${field(p.field)}: Erlaubt sind ${p.min} bis ${p.max}.`,
  "edit.notADate": (p) => `${p.value} ist kein gültiges Datum für ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} gehört nicht zu den Werten, die ${field(p.field)} annimmt.`,
  "edit.taken": (p) =>
    `Die Rückennummer ${p.value} ist bereits vergeben: ${p.name ?? `Der Spieler mit der UID ${p.uid}`} trägt sie.`,
  "edit.unsupported": (p) => `${field(p.field)} lässt sich so nicht ändern: ${UNSUPPORTED[p.reason] ?? p.reason}.`,
  "edit.moved": (p) => `Dieser ${recordNoun(p.entity)} wurde im Speicher des Spiels verschoben; ${reload}.`,
  "edit.noRecord": (p) =>
    `${field(p.field)} lässt sich hier nicht ändern: Der zugehörige Datensatz fehlt oder hat die Prüfung nicht bestanden.`,
  "edit.unset": (p) => `${field(p.field)} ist im Spiel nicht gesetzt und wurde daher nicht verändert.`,
  "edit.implausible": (p) =>
    `${field(p.field)} hat den Wert ${p.value}, der nicht möglich ist; zur Sicherheit wurde nichts verändert.`,
  "edit.notApplied": (p) => `${field(p.field)}: ${p.wrote} geschrieben, aber ${p.read} zurückgelesen.`,
  "edit.conflict": (p) =>
    `${field(p.field)} ist jetzt ${p.found}, nicht ${p.expected}: Das Spiel hat den Wert inzwischen geändert.`,
  "move.moved": () => `Der Spieler wurde im Speicher des Spiels verschoben; ${reload}.`,
  "move.notAClub": () => "Dieser Verein hat keine 1. Mannschaft, zu der der Spieler wechseln könnte.",
  "move.freeAgent": () =>
    "Der Spieler ist vertragslos: Er hat keinen Verein, den er verlassen oder über den er getauscht werden könnte.",
  "move.sameClub": () => "Der Spieler ist bereits bei diesem Verein.",
  "move.onLoan": () =>
    "Der Spieler ist verliehen: Rufen Sie ihn zuerst zurück oder verpflichten Sie ihn fest, im Bereich Leihe seines " +
    "Profils.",
  "move.notOnLoan": () => "Der Spieler ist nicht verliehen.",
  "move.playerCoach": () => "Spielertrainer lassen sich nicht transferieren: Sie arbeiten zugleich als Mitarbeiter.",
  "move.unusualContract": () => "Der Vertrag des Spielers ist kein gewöhnlicher Spielervertrag.",
  "move.humanClub": () =>
    "Der Spieler ist bei einem Verein, den ein menschlicher Trainer führt. In dieser Version des Spiels findet der " +
    "Editor die Aufstellungen dieses Vereins noch nicht, um ihn daraus zu nehmen; er verlässt den Verein daher nur im " +
    "Spiel selbst.",
  "move.menAndWomen": () => "Einer der Vereine ist ein Männerverein, der andere ein Frauenverein.",
  "move.notListed": () => "Die Kaderlisten führen den Spieler nicht dort, wo sie sollten.",
  "move.noRoom": (p) =>
    `Die Kaderliste des Vereins hat keinen Platz für einen weiteren Spieler (derzeit ${p.players}), und der Editor ` +
    "kann sie auf diesem System nicht vergrößern.",
  "sign.noPool": () =>
    "Der Editor findet in dieser Version des Spiels nicht, wo das Spiel seine Verträge verwaltet, und kann daher " +
    "keinem vertragslosen Spieler einen geben.",
  "sign.poolFull": () =>
    "Das Spiel hat keinen Platz für einen weiteren Vertrag, bis es selbst einen anlegt, wie es im Lauf der Tage " +
    "geschieht: Fahren Sie im Spiel einen Tag fort und versuchen Sie es dann erneut.",
  "sign.noModel": () =>
    "Der Verein hat in seiner 1. Mannschaft keinen Spieler mit einem gewöhnlichen Vertrag, nach dessen Vorbild der " +
    "neue Vertrag entstehen könnte.",
  "sign.noDate": () => "Der Editor kann das Spieldatum nicht lesen, mit dem ein neuer Vertrag beginnt.",
  "move.outOfRange": (p) =>
    `${p.value} ist kein gültiger Wert für ${field(p.field)}: Erlaubt sind ${p.min} bis ${p.max}.`,
  "move.changed": () => `Das Spiel hat diesen Speicher inzwischen geändert; ${reload}.`,
  "move.notApplied": () => "Der Speicher wurde beschrieben, aber beim Zurücklesen stand dort etwas anderes.",
  "retirement.unknown": () => "Der Editor findet die geplanten Karriereenden in dieser Version des Spiels nicht.",
  "retirement.none": () =>
    "Das Spiel hat das Karriereende dieses Spielers nicht geplant; er will ohnehin weiterspielen.",
  "clause.noContract": () => "Der Spieler hat keinen Vertrag.",
  "clause.missing": () => `Diese Klausel steht nicht mehr im Vertrag; ${reload}.`,
  "clause.notInClause": (p) =>
    `Diese Klausel hat ${p.field === "clause.amount" ? "keinen Betrag, der" : "keine Bedingung, die"} sich ändern ließe.`,
  "clause.same": () => "Der Vertrag enthält das bereits.",
  "clause.noRoom": () =>
    "Die Klauselliste des Vertrags hat keinen Platz, und der Editor kann sie nicht vergrößern; ändern Sie stattdessen " +
    "eine Klausel.",
  "heal.notInjured": () => "Der Spieler hat keine Verletzung, die sich heilen ließe.",
  "ban.notBanned": () => "Der Spieler hat keine Sperre, die sich aufheben ließe.",
  "relation.missing": () => `Diese Nationalität oder Ausbildung steht nicht mehr in der Liste des Spielers; ${reload}.`,
  "relation.noRoom": () =>
    "Die Liste des Spielers hat keinen Platz, und der Editor kann sie nicht vergrößern; ändern Sie stattdessen einen " +
    "ihrer Einträge.",
  "relation.target": () => "Das ist kein Land und kein Verein des Spiels von der Art, die dieser Eintrag annimmt.",
  "relation.same": () => "Der Spieler hat das bereits.",
  "relation.rule": (p) => `Die Eigengewächs-Regel ${p.rule} gehört nicht zu denen, die der Editor schreibt.`,
  "staff.you": () => "Das sind Sie selbst, der Trainer, den Sie steuern.",
  "staff.unemployed": () => "Dieser Mitarbeiter hat keinen Verein.",
  "staff.role": () =>
    "Der Verein oder eine seiner Mannschaften verweist direkt auf diesen Mitarbeiter (etwa auf einen Trainer, der " +
    "zugleich Sportdirektor ist); einen solchen versetzt das Spiel selbst.",
  "staff.notListed": () => "Die Mitarbeiterlisten des Vereins führen ihn nicht dort, wo sie sollten.",
  "staff.noRoom": (p) =>
    `Die Liste ${STAFF_DEPARTMENTS[p.department] ?? `der Abteilung ${p.department}`} des Vereins hat keinen Platz ` +
    `für einen weiteren Mitarbeiter (derzeit ${p.staff}), und der Editor kann sie hier nicht vergrößern.`,
  "stadium.none": () => "Das Stadion, in dem die 1. Mannschaft des Vereins spielt, lässt sich nicht lesen.",
  "stadium.shared": (p) =>
    `${p.holders} Einträge im Spiel teilen sich diesen Namen; er lässt sich nicht für das Stadion allein ändern.`,
  "stadium.nameLength": (p) =>
    `Der neue Name dieses Stadions muss ${p.min} bis ${p.max} Bytes belegen, damit er dort Platz hat, wo das Spiel ` +
    `ihn speichert; dieser belegt ${p.bytes}.`,
  "stadium.badName": () =>
    "Ein Stadionname darf nicht leer sein, nicht mit einem Leerzeichen beginnen oder enden und keine Steuerzeichen " +
    "enthalten.",
  "staff.job": (p) =>
    `Der Editor versetzt noch keine Mitarbeiter mit dem Job ${jobName(p.job)} und vergibt diesen Job auch nicht.`,
  "staff.directorTaken": (p) =>
    `Der Verein hat bereits einen Sportdirektor: ${p.name ?? "eine andere Person"}. Geben Sie diesem Mitarbeiter ` +
    `dort einen anderen Job oder versetzen Sie zuerst ${p.name ?? "diese Person"}.`,
  "staff.managerTaken": (p) =>
    `Der Verein hat bereits einen Trainer: ${p.name ?? "eine andere Person"}. Geben Sie diesem Mitarbeiter dort ` +
    `einen anderen Job oder versetzen Sie zuerst ${p.name ?? "diese Person"}.`,
  "staff.yourClub": () =>
    "Sie trainieren diesen Verein. Geben Sie diesem Mitarbeiter dort einen anderen Job: FMLibreEditor nimmt nie Ihren " +
    "Platz ein.",
  "staff.noJob": () => "Wählen Sie den Job, den er beim Verein übernimmt.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Dieser Verein hat überhaupt keine Mitarbeiter: Das Spiel führt keine bei Vereinen aus Ligen, die in diesem " +
        "Spielstand nicht spielbar sind."
      : "Kein Mitarbeiter dieses Vereins hat einen eigenen vollständigen Vertrag, nach dessen Vorbild ein neuer " +
        "entstehen könnte.",
  "squad.noTeam": () => `Der Verein hat diese Mannschaft nicht, oder sie hat die Prüfung nicht bestanden; ${reload}.`,
  "captain.notInTeam": () =>
    "Der Spieler spielt nicht in dieser Mannschaft; Kapitän kann nur ein Spieler der Mannschaft selbst sein.",
  "captain.unchanged": () => "Der Spieler hat dieses Amt bereits.",
  "session.notRunning": () =>
    "Football Manager 27 läuft nicht. Starten Sie das Spiel, laden Sie einen Spielstand und versuchen Sie es erneut.",
  "session.noSuchProcess": (p) => `Es gibt keine ${p.exe ?? "fm.exe"} mit der PID ${p.pid}.`,
  "session.severalRunning": (p) =>
    `Es laufen ${p.count} Instanzen von ${p.exe ?? "fm.exe"} (${p.pids}); wählen Sie eine aus.`,
  "session.pluginNotLoaded": () =>
    "Die Spieldaten sind noch nicht geladen; warten Sie auf das Hauptmenü und versuchen Sie es erneut.",
  "session.unsupportedEdition": (p) => `FM${p.edition} wird noch nicht unterstützt.`,
  "session.unknownEdition": () => "Es lässt sich nicht erkennen, welcher Football Manager das ist.",
  "session.playersNotFound": () =>
    "Die Spielerliste wurde nicht gefunden; laden Sie einen Spielstand (das Hauptmenü reicht nicht) und versuchen Sie " +
    "es erneut.",
  "memory.win32": (p) => `Windows hat einen Vorgang abgelehnt (${p.operation}, Fehler ${p.code}).`,
  "memory.read": (p) => `Der Speicher des Spiels konnte nicht gelesen werden (Systemfehler ${p.code}).`,
  "memory.write": (p) => `In den Speicher des Spiels konnte nicht geschrieben werden (Systemfehler ${p.code}).`,
  "memory.readOnly": () => "Das Spiel wurde nur zum Lesen geöffnet; Windows hat das Schreiben nicht erlaubt.",
  "memory.notWritable": () =>
    "Diese Adresse liegt nicht im beschreibbaren Datenspeicher des Spiels und wurde daher nicht beschrieben.",
  "memory.invalidPe": () => "Das Modul des Spiels konnte nicht gelesen werden.",
  "memory.invalidMachO": () => "Das Modul des Spiels konnte nicht gelesen werden.",
  "memory.mach": (p) => `macOS hat einen Vorgang abgelehnt (${p.operation}, Fehler ${p.code}).`,
  "memory.posix": (p) => `macOS hat einen Vorgang abgelehnt (${p.operation}, errno ${p.code}).`,
  "guard.saveChanged": () =>
    "Das Spiel hat einen Spielstand geladen oder ist zum Hauptmenü zurückgekehrt, seit FMLibreEditor es gelesen hat, " +
    "daher ändert es nichts, bis Sie die Daten neu laden.",
  "memory.noBridge": () =>
    "macOS lässt FMLibreEditor nicht in das Spiel: Das Spiel wurde ohne die Bridge von FMLibreEditor gestartet. " +
    "Richten Sie die Bridge ein und starten Sie das Spiel dann erneut über Steam.",
  "memory.bridge": (p) => `Die Bridge von FMLibreEditor im Spiel hat den Speicher nicht übergeben (${p.reason}).`,
  "scout.noClub": () =>
    "Sie trainieren in diesem Spielstand keinen Verein, daher gibt es niemanden, für den gescoutet werden könnte.",
  "scout.noTactic": (p) => `Die Taktik von ${p.club} konnte nicht aus dem Spiel gelesen werden.`,
  "scout.notPlaced": () => "Der Spieler steht auf keiner Position der Taktik.",
  "scout.unknownRole": (p) => `Der Editor kennt die Rolle ${p.role} nicht.`,
  "setup.steamRunning": () =>
    "Steam läuft, daher wurden die Startoptionen von FM27 nicht verändert; die Bridge selbst ist installiert. Beenden " +
    "Sie Steam und versuchen Sie es erneut, oder tragen Sie die Startoption selbst in Steam ein.",
  "setup.noSteamAccount": () =>
    "Auf diesem Mac wurde kein Steam-Konto gefunden; öffnen Sie Steam und melden Sie sich mindestens einmal an.",
  "setup.noLibrary": (p) => `In der App fehlt eine Datei der Bridge: ${p.path}`,
  "setup.unknownConfig": (p) =>
    `${p.path} hat ein Format, das FMLibreEditor nicht kennt, und wurde daher nicht verändert.`,
  "setup.io": (p) => `${p.path}: ${p.error}`,
  "app.internal": () => "In der App ist ein unerwarteter Fehler aufgetreten.",
  "app.notConnected": () => "Es besteht keine Verbindung zum Spiel.",
  "app.notFound": (p) =>
    `In den Listen gibt es keinen ${recordNoun(p.entity)} mit der ID ${p.uid}; laden Sie die Daten neu.`,
  "app.dataChanged": () => `Diese Daten haben sich im Spiel geändert; ${reload}.`,
  "app.noChange": (p) => `Die Änderung ${p.id} gibt es nicht.`,
  "app.alreadyUndone": () => "Diese Änderung wurde bereits rückgängig gemacht.",
  "export.failed": (p) => `Die Datei konnte nicht geschrieben werden: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor darf nicht in ${p.folder} schreiben. Falls macOS gefragt hat, ob die App Ihren Ordner „Dokumente“ ` +
    "verwenden darf, erlauben Sie es unter Systemeinstellungen › Datenschutz & Sicherheit › Dateien und Ordner und " +
    "exportieren Sie dann erneut.",
  "export.noFolder": () => "Es gibt keinen Ordner, in den exportiert werden könnte.",
  "export.notExported": () => "Das ist keine von FMLibreEditor exportierte Datei.",
  "export.openFailed": (p) => `Die Datei konnte nicht geöffnet werden: ${p.reason}`,
  "mass.noOperations": () => "Wählen Sie mindestens ein Feld, das geändert werden soll.",
  "mass.tooMany": (p) =>
    `Es gibt ${p.count} Treffer. Grenzen Sie die Suche oder die Filter für eine Massenbearbeitung auf höchstens ` +
    `${p.limit} ein.`,
  "mass.outOfDate": () =>
    "Diese Vorschau ist nicht mehr aktuell. Erstellen Sie die Vorschau der Massenbearbeitung erneut.",
};

export const de: Strings = {
  attributes: {
    // Technik
    corners: "Ecken",
    crossing: "Flanken",
    dribbling: "Dribbling",
    finishing: "Abschluss",
    first_touch: "Ballannahme",
    free_kicks: "Freistöße",
    heading: "Kopfballtechnik",
    long_shots: "Weitschüsse",
    long_throws: "Weite Einwürfe",
    marking: "Deckung",
    passing: "Passen",
    penalty_taking: "Elfmeter",
    tackling: "Tackling",
    technique: "Technik",
    // Mental
    aggression: "Aggressivität",
    anticipation: "Antizipation",
    bravery: "Mut",
    composure: "Nervenstärke",
    concentration: "Konzentration",
    decisions: "Entscheidungen",
    determination: "Zielstrebigkeit",
    flair: "Flair",
    leadership: "Führungsqualitäten",
    off_the_ball: "Ohne Ball",
    positioning: "Stellungsspiel",
    teamwork: "Teamwork",
    vision: "Übersicht",
    work_rate: "Einsatzfreude",
    // Athletik
    acceleration: "Antritt",
    agility: "Beweglichkeit",
    balance: "Balance",
    jumping_reach: "Sprunghöhe",
    natural_fitness: "Grundfitness",
    pace: "Schnelligkeit",
    stamina: "Ausdauer",
    strength: "Kraft",
    // Torwart (Ballannahme und Passen sind die der Technik)
    aerial_reach: "Hohe Bälle",
    command_of_area: "Strafraumkontrolle",
    communication: "Kommunikation",
    eccentricity: "Exzentrizität",
    handling: "Halten",
    kicking: "Abschlag",
    one_on_ones: "Eins gegen Eins",
    punching: "Fausten (Tendenz)",
    reflexes: "Reflexe",
    rushing_out: "Herauslaufen (Tendenz)",
    throwing: "Abwurf",
    // Verborgen
    consistency: "Konstanz",
    dirtiness: "Unsportlichkeit",
    important_matches: "Wichtige Spiele",
    injury_proneness: "Verletzungsanfälligkeit",
    versatility: "Vielseitigkeit",
    // Füße
    left_foot: "Linker Fuß",
    right_foot: "Rechter Fuß",
  },

  staffAttributes: {
    // Taktik und Training
    attacking: "Offensive",
    defending: "Defensive",
    fitness: "Athletik",
    goalkeeping: "Torhüter",
    possession: "Ballbesitz",
    set_pieces: "Standards",
    tactical: "Taktik",
    technical: "Techniken",
    working_with_youngsters: "Nachwuchsarbeit",
    // Mental
    authority: "Autorität",
    determination: "Zielstrebigkeit",
    motivating: "Motivationsfähigkeit",
    people_management: "Führungsqualitäten",
    // Kenntnisse
    data_analysis: "Datenanalyse",
    judging_ability: "Spielerfähigkeiten beurteilen",
    judging_potential: "Spielerpotenzial beurteilen",
    judging_staff: "Mitarbeiterbeurteilung",
    negotiating: "Verhandlungsgeschick",
    tactical_knowledge: "Taktische Kenntnisse",
    // Medizinisch
    physiotherapy: "Physiotherapie",
    sports_science: "Sportwissenschaft",
  },

  personality: {
    adaptability: "Anpassungsfähigkeit",
    ambition: "Ehrgeiz",
    loyalty: "Loyalität",
    pressure: "Druck",
    professionalism: "Professionalität",
    sportsmanship: "Fairplay",
    temperament: "Temperament",
    controversy: "Streitlust",
  },

  /** The game's German abbreviations; it has none for the sweeper, so "LIB" after its "Libero". */
  positions: {
    gk: "TW",
    sw: "LIB",
    dl: "VL",
    dc: "VZ",
    dr: "VR",
    dm: "DM",
    ml: "ML",
    mc: "MZ",
    mr: "MR",
    aml: "OML",
    amc: "OMZ",
    amr: "OMR",
    st: "ST",
    wbl: "OLV",
    wbr: "ORV",
  },

  clubFacilities: {
    training: "Training",
    youth_facilities: "Jugendeinrichtungen",
    youth_coaching: "Jugendtraining",
    youth_recruitment: "Nachwuchsrekrutierung",
    corporate: "Businessbereich",
  },

  supporterTraits: {
    loyalty: "Loyalität",
    passion: "Leidenschaft",
    patience: "Geduld",
    affluence: "Wohlstand",
    temperament: "Temperament",
    expectations: "Erwartungen",
  },

  supporterMix: {
    hardcore: "Ultras",
    core: "Normalos",
    family: "Familien",
    fair_weather: "Erfolgsfans",
    corporate: "Geschäftsleute",
    casual: "Gelegenheitsfans",
  },

  jobs: {
    1: "Spieler",
    2: "Assistenztrainer",
    4: "Vorstandsvorsitzender",
    6: "Vorstandsmitglied",
    10: "Sportdirektor",
    12: "Physiotherapeut",
    14: "Scout",
    16: "Trainer",
    20: "Co-Trainer",
    22: "Standardtrainer",
    26: "Athletiktrainer",
    34: "Torwarttrainer",
    38: "Mannschaftsarzt",
    40: "Chefsportwissenschaftler",
    44: "Chefscout",
    46: "Arzt",
    48: "Sportwissenschaftler",
    50: "Chefphysiotherapeut",
    58: "Spieleranalyst",
    60: "Leistungsanalyst",
    62: "Chefleistungsanalyst",
    64: "Jugendabteilungsleiter",
    66: "Besitzer",
    70: "Präsident",
    86: "Leihkoordinator",
    88: "Technischer Leiter",
  },

  fields: {
    current_ability: "Derzeitige Fähigkeit",
    potential_ability: "Potenzielle Fähigkeit",
    height: "Größe (cm)",
    date_of_birth: "Geburtsdatum",
    asking_price: "Ablöseforderung",
    nation: "Nationalität",
    "reputation.home": "Nationale Reputation",
    "reputation.current": "Derzeitige Reputation",
    "reputation.world": "Weltreputation",
    "international.caps": "Länderspiele",
    "international.goals": "Länderspieltore",
    "international.u21_caps": "U21-Länderspiele",
    "international.u21_goals": "U21-Tore",
    condition: "Energie",
    match_sharpness: "Spielpraxis",
    jadedness: "Erschöpfung",
    morale: "Moral",
    "contract.wage": "Gehalt pro Woche",
    "contract.loyalty_bonus": "Loyalitätsbonus pro Woche",
    "contract.happiness": "Zufriedenheit",
    "contract.playing_time_happiness": "Zufriedenheit mit Einsatzzeiten",
    "contract.unhappiness": "Gründe für Unzufriedenheit",
    "contract.expires": "Vertragsende",
    "contract.squad_number": "Rückennummer",
    "contract.squad_status": "Teamstatus",
    "contract.transfer_listed": "Auf Transferliste",
    "contract.loan_listed": "Auf Leihliste",
    "loan.expires": "Ende der Leihe",
    "loan.option_fee": "Kaufoption",
    "contract.job": "Job",
    "tie.nationality": "Zweite Staatsangehörigkeit",
    "tie.trainedInNation": "Ausgebildet im Land",
    "tie.trainedAtClub": "Ausgebildet im Verein",
    "tie.workPermit": "Keine Arbeitserlaubnis nötig in",
    club: "Verein",
    injuries: "Verletzungen",
    cohesion: "Teambuilding",
    bans: "Sperren",
    retirement: "Karriereende",
    clause: "Vertragsklausel",
    "clause.amount": "Klauselbetrag",
    "clause.condition": "Klauselbedingung",
    captain: "Kapitän",
    vice_captain: "Vize-Kapitän",
    reputation: "Ansehen",
    "facilities.training": "Trainingseinrichtungen",
    "facilities.youth_facilities": "Jugendeinrichtungen",
    "facilities.youth_coaching": "Jugendtraining",
    "facilities.youth_recruitment": "Nachwuchsrekrutierung",
    "facilities.corporate": "Businessbereich",
    "finance.balance": "Kontostand",
    "finance.transfer_budget": "Transferbudget",
    "finance.wage_budget": "Gehaltsbudget",
    "finance.total_wage_budget": "Gesamtes Gehaltsbudget",
    "stadium.capacity": "Stadionkapazität",
    "stadium.name": "Stadionname",
    "stadium.seating": "Sitzplatzkapazität",
    "stadium.used": "Genutzte Kapazität",
    "stadium.expansion": "Ausbaumöglichkeit",
  },

  profile: {
    close: "Profil schließen",
    loading: "Profil wird geladen…",
    resize: "Breite des Profilbereichs ändern",
    resizeHint: "Ziehen, um den Bereich breiter oder schmaler zu machen; Doppelklick setzt ihn zurück",
    none: "—",

    // Kopfzeile
    freeAgent: "Vertragslos",
    born: "Geboren",
    height: (cm) => `${cm} cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Derzeitige Fähigkeit",
    currentAbilityShort: "CA",
    potentialAbility: "Potenzielle Fähigkeit",
    potentialAbilityShort: "PA",
    potentialRange: "Potenzial als Spanne festgelegt",

    // Attribute
    technical: "Technik",
    goalkeeping: "Torwart",
    mental: "Mental",
    physical: "Athletik",
    hidden: "Verborgen",
    feet: "Füße",
    personality: "Persönlichkeit",
    raw: (raw, scale = 100) => `Rohwert ${raw} / ${scale}`,
    lowerIsBetter: "niedriger ist besser",
    age: (age) => `${age} Jahre`,

    // Positionen
    positions: "Positionen",
    positionsSummary: (best) => `Positionsbewertungen: ${best}`,
    positionRatings: "Positionsbewertungen",
    positionTiers: {
      natural: "Idealposition",
      accomplished: "Gut",
      competent: "Passabel",
      unconvincing: "Mittelmäßig",
      ineffective: "Ungeeignet",
    },
    positionTooltip: (position, rating, tier) => `${position} · ${rating} · ${tier}`,

    // Vertrag
    contract: "Vertrag",
    wage: "Gehalt pro Woche",
    wageNote: (converted) =>
      converted
        ? "Das Spiel speichert Pfund; angezeigt zum Wechselkurs von FM"
        : "Das Spiel speichert Pfund; eine andere Währung lässt sich in den Einstellungen wählen",
    signed: "Unterschrieben",
    expires: "Endet",
    joined: "Im Verein seit",
    squadStatus: "Teamstatus",
    squadStatusName: (status) => SQUAD_STATUSES[status] ?? `Status ${status}`,
    contractType: "Vertragsart",
    contractTypeName: (code) => CONTRACT_TYPES[code] ?? `Vertragsart ${code}`,
    squadNumber: "Rückennummer",
    transferListed: "Auf Transferliste",
    loanListed: "Auf Leihliste",

    // Karriere
    career: "Karriere",
    internationalCaps: "Länderspiele",
    internationalGoals: "Länderspieltore",
    u21Caps: "U21-Länderspiele",
    u21Goals: "U21-Tore",
    askingPrice: "Ablöseforderung",
    notSet: "Nicht festgelegt",
    reputation: "Ansehen",
    reputationHome: "National",
    reputationCurrent: "Aktuell",
    reputationWorld: "Weltweit",
    retirement: "Karriereende",
    retires: "Karriereende geplant",
    noRetirement: "Das Spiel hat sein Karriereende nicht geplant",
    keepPlaying: "Karriereende verhindern",
    keepingPlaying: "Wird verhindert…",
    keepPlayingTitle:
      "Nimmt sein Karriereende aus den Plänen des Spiels und gibt ihm die Spielereigenschaft „Spielt so lange wie " +
      "möglich“ statt „Beendet Karriere auf höchstem Niveau“; unter Änderungen rückgängig zu machen",

    // Medizinisch
    morale: (value) => `${value} / 20`,
    traits: "Spielereigenschaften",
    noTraits: "Keine Spielereigenschaften",
    traitName: (bit) => TRAIT_NAMES_DE[bit] ?? `Eigenschaft ${bit}`,
    unhappiness: "Unzufriedenheit",
    noUnhappiness: "Nichts macht ihn unzufrieden",
    removeUnhappiness: "Alle entfernen",
    removingUnhappiness: "Wird entfernt…",
    removeUnhappinessTitle:
      "Nimmt jeden Grund für Unzufriedenheit von seiner Liste, wie es „Alle entfernen“ in FMRTE tut; unter Änderungen " +
      "rückgängig zu machen",
    concernSince: (date) => `seit ${date}`,
    concernKind: (kind) => (kind === 1 ? "Besorgt" : kind === 2 ? "Intern" : `Art ${kind}`),
    concernMotive: (motive) => CONCERN_MOTIVES_DE[motive] ?? `Grund ${motive}`,
    clauses: "Prämien & Klauseln",
    noClauses: "Keine Prämien oder Klauseln",
    loyaltyBonus: "Loyalitätsbonus",
    happiness: "Zufriedenheit",
    playingTimeHappiness: "Zufriedenheit mit Einsatzzeiten",
    moodTitle: "Wie FMRTE es zeigt, von -100 bis 100; das Spiel zeigt es in Worten",
    clauseName: (kind) => CLAUSE_NAMES_DE[kind] ?? `Klausel ${kind}`,
    loan: "Leihe",
    loanAt: "Verliehen an",
    loanParent: "Mutterverein",
    loanFrom: "Von",
    loanUntil: "Bis",
    loanNumber: "Rückennummer dort",
    recall: "Von Leihe zurückrufen",
    recallTitle: "Holt ihn zu seinem Verein zurück: Die Leihe endet heute. Fragt nach, bevor sich etwas ändert",
    recallAgain: "Erneut zurückrufen",
    makePermanent: "Fest verpflichten",
    makePermanentTitle:
      "Verpflichtet ihn fest bei dem Verein, an den er verliehen ist, mit einem Vertrag dort. Fragt nach, bevor sich " +
      "etwas ändert",
    recalledWaiting: "Zurückgerufen · Rückkehr ausstehend",
    endsTodayWaiting: "Endet heute · Rückkehr ausstehend",
    pendingTitle: (parent) =>
      `Heute ist der letzte Tag der Leihe: Fahren Sie im Spiel einen Tag fort, dann ist er wieder bei ${parent}.`,
    endPassed: (date) =>
      `Die Leihe sollte am ${date} enden, aber das Spiel hat ihn nicht zurückgeholt. Rufen Sie ihn erneut zurück und ` +
      "fahren Sie dann einen Tag fort.",
    loanCanRecall: "Kann zurückbeordert werden",
    loanCanRecallTitle:
      "Ob sein Verein ihn im Spiel zurückbeordern darf. „Von Leihe zurückrufen“ funktioniert hier in jedem Fall",
    loanCanTerminate: "Kann vorzeitig beendet werden",
    loanCupMatches: "Kann in Pokalspielen eingesetzt werden",
    loanAgainstClub: "Kann gegen Mutterverein spielen",
    loanOptionFee: "Kaufoption",
    loanOptionFeeTitle: "Die Summe, für die der Verein, an den er verliehen ist, ihn fest verpflichten kann",
    loanMonthlyFee: "Monatliche Leihgebühr",
    loanMonthlyFeeTitle:
      "Was der Verein, an den er verliehen ist, seinem Verein für jeden Monat zahlt, in dem er spielt",
    loanUnusedFee: "Monatliche Gebühr (ohne Einsatzzeiten)",
    loanUnusedFeeTitle:
      "Was der Verein, an den er verliehen ist, seinem Verein für jeden Monat zahlt, in dem er nicht eingesetzt wird",
    clauseCondition: (kind, value) => {
      switch (kind) {
        case 10:
          return value === 1 ? "1 Tor" : `${format(value)} Tore`;
        case 40:
          return value === 1 ? "1 Torvorlage" : `${format(value)} Torvorlagen`;
        case 41:
          return `${format(value)} Tore und Torvorlagen`;
        case 19:
          return value === 1 ? "1 Länderspiel" : `${format(value)} Länderspiele`;
        case 11:
        case 13:
        case 25:
        case 26:
          return value === 1 ? "1 Ligaspiel" : `${format(value)} Ligaspiele`;
        case 22:
        case 29:
          return value === 1 ? "1 Jahr" : `${format(value)} Jahre`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value} %`;
        default:
          return String(value);
      }
    },
    clauseExpires: (date) => `endet am ${date}`,
    clauseExpiresAfter: (days) =>
      days === 1 ? "endet 1 Tag nach der Unterschrift" : `endet ${format(days)} Tage nach der Unterschrift`,
    clauseProfitShare: (percent, amount) => `${percent} des Gewinns über ${amount}`,
    clauseWage: (amount) => `${amount} pro Woche`,
    moraleTitle:
      "Das Spiel zeigt die Moral als allgemeine Zufriedenheit des Spielers: „Neutral“ bei 10, „Eher zufrieden“ bei 11, " +
      "äußerst zufrieden bei 15 und 20",
    jadednessTitle:
      "Wie sehr der Spieler vom Spielen ausgelaugt ist, was Ruhe wieder abbaut: -500 ist voll erholt, und je höher der " +
      "Wert, desto dringender braucht er eine Pause",
    noInjuries: "Keine Verletzungen",
    unknownInjury: "Unbekannte Verletzung",
    injuryStarted: (date) => `Seit ${date}`,
    injuryBack: (dates) => `Voraussichtliche Rückkehr: ${dates}`,
    heal: "Heilen",
    healTitle: "Heilt jede Verletzung dieses Spielers im Spiel",
    noBans: "Keine Sperren",
    banMatches: (matches) => (matches === 1 ? "1 Spiel" : `${format(matches)} Spiele`),
    banStarted: (date) => `Seit ${date}`,
    liftBans: "Aufheben",
    liftBansTitle: "Hebt jede Sperre dieses Spielers im Spiel auf",

    // Über den Attributen, während das Profil angezeigt wird
    maxAttributes: "Attribute maximieren",
    maxAttributesTitle:
      "Setzt jedes Attribut dieses Spielers auf den besten Wert: 20, und 1 für Verletzungsanfälligkeit und " +
      "Unsportlichkeit",
    maxAttributesDone: (count) =>
      count === 0 ? "Jedes Attribut steht bereits auf dem besten Wert" : `${changes(count)} geschrieben`,
    maxAttributesUndone: (count) =>
      count === 0 ? "Nichts wurde rückgängig gemacht" : `${changes(count)} rückgängig gemacht`,
    undoMax: "Rückgängig",
    undoMaxTitle: "Schreibt seine alten Attribute zurück ins Spiel",
    freezeAttributes: "Attribute einfrieren",
    freezeAttributesNote:
      "Solange die App geöffnet und verbunden ist, werden seine Attribute nicht schlechter: Was das Spiel abzieht, wird " +
      "wiederhergestellt, und Verbesserungen zählen weiterhin. Die App merkt sich das für diesen Spielstand und friert " +
      "sie erneut ein, wenn sie sich damit verbindet.",
    maxStaffAttributesTitle: "Setzt jedes Attribut dieses Mitarbeiters auf den besten Wert: 20",
    undoMaxStaffTitle: "Schreibt die alten Attribute zurück ins Spiel",
    freezeStaffAttributesNote:
      "Solange die App geöffnet und verbunden ist, werden die Attribute nicht schlechter: Was das Spiel abzieht, wird " +
      "wiederhergestellt, und Verbesserungen zählen weiterhin. Die App merkt sich das für diesen Spielstand und friert " +
      "sie erneut ein, wenn sie sich damit verbindet.",
    freezeFitness: "Energie und Spielpraxis einfrieren",
    freezeFitnessNote:
      "Solange die App geöffnet und verbunden ist, sinken seine Energie und Spielpraxis nicht: Was das Spiel abzieht, " +
      "wird wiederhergestellt, und Zuwächse zählen weiterhin, sodass er bei 100 % bleibt. Die App merkt sich das " +
      "für diesen Spielstand.",
    freezePositions: "Einfrieren",
    freezePositionsInfo: "Was bewirkt das Einfrieren der Positionen?",
    freezePositionsNote:
      "Solange die App geöffnet und verbunden ist, bleiben seine Positionsbewertungen, wie sie sind: Er lernt keine " +
      "neue Position, und seine Bewertungen steigen und sinken nicht. Die App merkt sich das für diesen Spielstand.",

    // Mitarbeiter
    you: "Sie",
    youTitle: "Der Trainer, den Sie in diesem Spielstand steuern",
    id: "ID",
    job: "Job",
    changeJob: "Job ändern",
    changeJobTitle: "Gibt diesem Mitarbeiter im Spiel einen anderen Job bei seinem Verein",
    newJob: "Neuer Job",
    applyJob: "Anwenden",
    cancelJob: "Abbrechen",
    unemployed: "Arbeitslos",
    coaching: "Taktik und Training",
    knowledge: "Kenntnisse",
    medical: "Medizinisch",
    playerCoach: (job) => `${job} (Spielertrainer)`,
    unknownJob: (code) => `Job ${code}`,
  },

  playerList: {
    nav: "Spieler",
    count: (total) => `${format(total)} Spieler`,
    search: "Spieler nach Name oder UID suchen",
    summary: (total, shown, sorted) => {
      const count = `${format(total)} Spieler`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · die besten ${shown} nach derzeitiger Fähigkeit`
        : `${count} · die ersten ${shown} nach ${sorted.by}, ${sorted.ascending ? "aufsteigend" : "absteigend"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Kein Spieler passt zu diesen Filtern." : "Keine Spieler gefunden.";
      }
      return filtered
        ? `Mit diesen Filtern passt kein Spieler zu „${query}“.`
        : `Kein Spieler passt zu „${query}“.`;
    },
    columns: {
      name: "Name",
      age: "Alter",
      positions: "Positionen",
      nation: "Land",
      club: "Verein",
      contractExpires: "Vertrag",
      born: "Geboren",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    },
    sortBy: (by) => `Sortieren nach ${by}`,
    sortNames: {
      currentAbility: "derzeitiger Fähigkeit",
      potentialAbility: "potenzieller Fähigkeit",
      age: "Alter",
      name: "Name",
      nation: "Land",
      club: "Verein",
      contractExpires: "Vertragsende",
    },
    filters: {
      toggle: "Filter",
      toggleActive: (count) => `Filter, ${count} aktiv`,
      clear: "Zurücksetzen",
      any: "Alle",
      position: "Position",
      gender: "Geschlecht",
      men: "Männer",
      women: "Frauen",
      age: "Alter",
      minAge: "Mindestalter",
      maxAge: "Höchstalter",
      minPlaceholder: "Min.",
      maxPlaceholder: "Max.",
      minCurrentAbility: "CA min.",
      minCurrentAbilityTitle: "Mindestwert der derzeitigen Fähigkeit",
      minPotentialAbility: "PA min.",
      minPotentialAbilityTitle: "Mindestwert der potenziellen Fähigkeit",
      abilityPlaceholder: "1–200",
      nation: "Land",
      club: "Verein",
      freeAgentsOnly: "Nur vertragslose Spieler",
      contractEndsBy: "Vertrag endet bis",
      transferListedOnly: "Nur auf Transferliste",
      loanListedOnly: "Nur auf Leihliste",
      attributes: {
        heading: "Attribute",
        attribute: "Attribut",
        pick: "Attribut wählen",
        min: (name) => (name ? `${name}: mindestens` : "Mindestens"),
        max: (name) => (name ? `${name}: höchstens` : "Höchstens"),
        add: "Attribut hinzufügen",
        remove: (name) => (name ? `${name} entfernen` : "Diese Zeile entfernen"),
      },
      saved: {
        save: "Speichern",
        saveTitle: "Speichert die aktiven Filter und die Sortierung unter einem Namen",
        name: "Name des gespeicherten Filters",
        namePlaceholder: "Filtername",
        ok: "OK",
        cancel: "Abbrechen",
        select: "Gespeicherte Filter",
        delete: "Löschen",
        deleteTitle: (name) => `Gespeicherten Filter löschen: ${name}`,
        replaceQuestion: (name) => `Ein gespeicherter Filter namens „${name}“ existiert bereits. Ersetzen?`,
        replace: "Ersetzen",
        full: (max) =>
          `Es lassen sich bis zu ${max} Filter speichern. Löschen Sie zuerst einen, oder verwenden Sie den Namen eines ` +
          "gespeicherten Filters, um ihn zu ersetzen.",
      },
    },
  },

  staffList: {
    nav: "Mitarbeiter",
    count: (total) => `${format(total)} Mitarbeiter`,
    search: "Mitarbeiter nach Name oder ID suchen",
    summary: (total, shown, sorted) => {
      const count = `${format(total)} Mitarbeiter`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · die besten ${shown} nach derzeitiger Fähigkeit`
        : `${count} · die ersten ${shown} nach ${sorted.by}, ${sorted.ascending ? "aufsteigend" : "absteigend"}`;
    },
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Kein Mitarbeiter passt zu diesen Filtern." : "Keine Mitarbeiter gefunden.";
      }
      return filtered
        ? `Mit diesen Filtern passt kein Mitarbeiter zu „${query}“.`
        : `Kein Mitarbeiter passt zu „${query}“.`;
    },
    columns: {
      name: "Name",
      age: "Alter",
      job: "Job",
      club: "Verein",
      nation: "Land",
      born: "Geboren",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    },
    sortBy: (by) => `Sortieren nach ${by}`,
    sortNames: {
      currentAbility: "derzeitiger Fähigkeit",
      potentialAbility: "potenzieller Fähigkeit",
      age: "Alter",
      name: "Name",
      nation: "Land",
      club: "Verein",
    },
    filters: {
      job: "Job",
      anyJob: "Alle",
      unemployedOnly: "Nur Arbeitslose",
    },
  },

  clubProfile: {
    // Kopfzeile
    womensClub: "Frauenverein",
    founded: (year) => `Gegründet ${year}`,
    reputationShort: "Ansehen",
    reputationTitle: "Ansehen",

    tabsLabel: "Vereinsbereiche",
    tabs: { overview: "Übersicht", squad: "Kader", stadium: "Stadion" },
    squadLocked: "Beenden Sie die Bearbeitung, um den Kader zu öffnen",

    facilities: "Einrichtungen",

    // Fans
    supporters: "Fans",
    supporterMix: "Fantypen",
    percent: (value) => `${percents.format(value)} %`,
    mixTooltip: (kind, percent) => `${kind} · ${percent}`,

    // Finanzen
    finances: "Finanzen",
    balance: "Kontostand",
    transferBudget: "Transferbudget",
    wageBudget: "Gehaltsbudget (Ausgaben)",
    totalWageBudget: "Gesamtes Gehaltsbudget",
    ticketPrice: "Durchschnittlicher Ticketpreis",
    perWeek: "pro Woche",
    noFinances: "FM führt Finanzen nur für Vereine in den gespielten Ligen.",
    freeze: "Geld einfrieren",
    freezeNote:
      "Solange die App geöffnet und verbunden ist, sinkt der Kontostand nicht: Was das Spiel abzieht, wird " +
      "wiederhergestellt, und Einnahmen zählen weiterhin. Die App merkt sich das für diesen Spielstand und friert ihn " +
      "erneut ein, wenn sie sich damit verbindet.",

    // Stadion
    stadium: "Stadion",
    capacity: "Kapazität",
    seating: "Sitzplätze",
    used: "Genutzt",
    usedAll: "Vollständig",
    usedTitle:
      "Der Teil der Kapazität, den das Spiel zulässt, wenn es sie begrenzt (etwa während Plätze gesperrt sind); 0 " +
      "bedeutet die gesamte Kapazität",
    expansion: "Ausbaubar auf",
    noStadium: "Das Stadion dieses Vereins konnte nicht gelesen werden.",
    stadiumName: "Name",
    rename: "Umbenennen",
    renameTitle:
      "Gibt dem Stadion einen anderen Namen; er wird sofort geschrieben und lässt sich unter Änderungen rückgängig " +
      "machen",
    renameInfoLabel: "Wie funktioniert das Umbenennen?",
    renameInfo:
      "Das Spiel speichert keine Stadionnamen in seinen Spielständen: Es übernimmt sie jedes Mal aus seiner Datenbank, " +
      "wenn es einen Spielstand lädt. Deshalb merkt sich FMLibreEditor den neuen Namen für diesen Spielstand und setzt " +
      "ihn jedes Mal, wenn das Spiel ihn lädt, innerhalb von Sekunden wieder ein, solange die App geöffnet und verbunden " +
      "ist. Lädt das Spiel den Spielstand, während die App geschlossen ist, zeigt es seinen eigenen Namen, bis die App " +
      "sich wieder verbindet. Um zum alten Namen zurückzukehren, machen Sie die Umbenennung unter Änderungen rückgängig " +
      "oder benennen Sie das Stadion zurück.",
    saveName: "Speichern",
    renaming: "Wird gespeichert…",
    cancelRename: "Abbrechen",
    nameLength: (bytes, min, max) =>
      min <= 1
        ? `${bytes} von höchstens ${max} Zeichen (ein Umlaut oder Buchstabe mit Akzent zählt doppelt)`
        : `${bytes} Zeichen: ${min} bis ${max}, damit der Name dort Platz hat, wo das Spiel ihn speichert (ein ` +
          "Umlaut oder Buchstabe mit Akzent zählt doppelt)",
    nameShared: (holders) =>
      `${holders} Einträge im Spiel teilen sich diesen Namen, daher lässt er sich nicht für das Stadion allein ändern`,

    // Vereinsinfo
    info: "Vereinsinfo",
    seasonTickets: "Dauerkarten",
    socialMedia: "Follower in sozialen Medien",
  },

  clubList: {
    nav: "Vereine",
    count: (total) => clubCount(total),
    search: "Vereine nach Name oder UID suchen",
    summary: (total, shown) =>
      total > shown ? `${clubCount(total)} · die besten ${shown} nach Ansehen` : clubCount(total),
    empty: (query, filtered) => {
      if (query === "") {
        return filtered ? "Kein Verein passt zu diesem Filter." : "Keine Vereine gefunden.";
      }
      return filtered
        ? `Mit diesem Filter passt kein Verein zu „${query}“.`
        : `Kein Verein passt zu „${query}“.`;
    },
    women: "Frauen",
    columns: {
      name: "Name",
      reputation: "Ansehen",
      founded: "Gegründet",
      uid: "UID",
    },
    filters: {
      kind: "Angezeigte Vereine",
      all: "Alle Vereine",
      men: "Männervereine",
      women: "Frauenvereine",
    },
  },

  app: {
    stage: "Beta",
    settingsLabel: "Einstellungen",
    languageLabel: "Sprache",
    currencyLabel: "Währung",

    noteEditable: "Änderungen erreichen das Spiel erst, wenn Sie sie anwenden. Sichern Sie vorher Ihren Spielstand.",
    noteReadOnly: "Schreibgeschützt: Windows hat FMLibreEditor nicht erlaubt, in das Spiel zu schreiben.",
    noteUnknownBuild: "Schreibgeschützt: Diese Version des Spiels ist für FMLibreEditor neu.",
    noteNotConnected: "Im Spiel ändert sich nichts, bis Sie bearbeiten und anwenden.",

    notConnected: "Nicht verbunden",
    previewTag: "Browser-Vorschau · Beispieldaten",
    noDate: "Kein Spieldatum",
    noDateTitle:
      "FMLibreEditor konnte das Spieldatum in dieser Version des Spiels nicht lesen, daher wird kein Alter angezeigt " +
      "und Altersfilter finden niemanden. Suchen Sie nach Updates.",
    reload: "Daten neu laden",
    refresh: "Aktualisieren",
    detecting: "Football Manager wird gesucht…",
    connecting: "Spieler, Mitarbeiter und Vereine werden gelesen…",
    reloading: "Spieler, Mitarbeiter und Vereine werden neu gelesen…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "Der Spielstand im Spiel hat sich geändert",
      text:
        "Das Spiel hat einen Spielstand geladen oder ist zum Hauptmenü zurückgekehrt, seit FMLibreEditor es gelesen hat. " +
        "Bis Sie die Daten neu laden, ändert es nichts im Spiel und hält nichts eingefroren: Was es zeigt, kann zu einem " +
        "anderen Spielstand gehören.",
    },

    refrozen: {
      title: "Wie beim letzten Mal wieder eingefroren",
      waitingTitle: "Was eingefroren war, wartet vorerst",
      players: (names) => `Attribute: ${names}`,
      staff: (names) => `Mitarbeiterattribute: ${names}`,
      clubs: (names) => `Geld: ${names}`,
      fitness: (names) => `Energie und Spielpraxis: ${names}`,
      positions: (names) => `Positionen: ${names}`,
      stadiums: (names) => `Stadionnamen: ${names}`,
      more: (count) => (count === 1 ? "und 1 weiterer" : `und ${format(count)} weitere`),
      waiting: (count) =>
        `${count === 1 ? "1 Eintrag ist" : `${format(count)} Einträge sind`} gespeichert, aber derzeit nicht ` +
        "eingefroren: FMLibreEditor kann in diese Version des Spiels noch nicht schreiben.",
      dismiss: "Ausblenden",
    },

    freezeInfo: {
      label: "Wie funktioniert das Einfrieren?",
      note:
        "Einfrieren ändert das Spiel nicht dauerhaft: Alle 2 Sekunden stellt FMLibreEditor wieder her, was das Spiel " +
        "abgezogen hat. Es funktioniert also nur, solange die App geöffnet und verbunden ist; schließen Sie sie, ändert " +
        "das Spiel die Werte wieder. Die App merkt sich, was in diesem Spielstand eingefroren ist, und friert es beim " +
        "nächsten Verbinden erneut ein.",
    },

    connect: {
      title: "Mit Football Manager 27 verbinden",
      intro:
        "FMLibreEditor liest den Speicher des Spiels, während es läuft. Starten Sie das Spiel, laden Sie einen " +
        "Spielstand und verbinden Sie sich dann.",
      notRunning: "Football Manager 27 läuft nicht.",
      openFailed: (error) => `Das Spiel konnte nicht geöffnet werden: ${error}`,
      game: "Spiel",
      gameData: "Spieldaten",
      loaded: "Geladen",
      stillLoading: "Wird noch geladen; warten Sie auf das Hauptmenü",
      process: "Prozess",
      pid: (pid) => `PID ${pid}`,
      several: "Es laufen mehrere Instanzen des Spiels; die erste wird verwendet.",
      button: "Verbinden und Spieler, Mitarbeiter und Vereine lesen",

      bridge: {
        title: "Die Bridge (macOS)",
        intro:
          "macOS lässt keine App in den Speicher einer anderen, daher muss FM27 seinen Speicher selbst übergeben. Das " +
          "tut es, sobald es die Bridge von FMLibreEditor lädt: eine kleine Bibliothek, die im Spiel nichts abfängt " +
          "oder verändert und seinen Speicher nur dieser App gibt. Eine Startoption in Steam sorgt dafür, dass FM27 " +
          "sie lädt.",
        library: "Bridge",
        installed: "Installiert",
        missing: "Nicht installiert",
        launchOption: "Startoption",
        set: "In Steam gesetzt",
        notSet: "Nicht gesetzt",
        ready:
          "Eingerichtet. Starten Sie FM27 über Steam (beenden und neu starten, falls es läuft), laden Sie einen " +
          "Spielstand und verbinden Sie sich dann.",
        steamRunning:
          "Steam läuft und behält die Startoptionen, solange es läuft. Beenden Sie Steam, damit die Startoption für " +
          "Sie gesetzt wird, oder tragen Sie sie selbst in Steam ein.",
        setUp: "Bridge einrichten",
        remove: "Bridge entfernen",
        manual:
          "Oder klicken Sie in Steam mit der rechten Maustaste auf Football Manager 27 › Eigenschaften › Allgemein › " +
          "Startoptionen und geben Sie ein:",
        copy: "Kopieren",
        copied: "Kopiert",
      },
    },
  },

  graphics: {
    reading: "Grafikpakete werden gelesen…",
    summary: ({ clubLogos, flags, faces }) =>
      `Grafik: ${format(clubLogos)} ${clubLogos === 1 ? "Vereinslogo" : "Vereinslogos"} · ` +
      `${format(flags)} ${flags === 1 ? "Flagge" : "Flaggen"} · ${format(faces)} ${faces === 1 ? "Gesicht" : "Gesichter"}`,
    none: "Keine Grafikpakete gefunden",
    noneHint: "Logo- und Gesichterpakete gehören in den Ordner graphics von FM27.",
  },

  compatibility: {
    unknownBuild: (game) => `FMLibreEditor wurde noch nicht mit ${game} geprüft`,
    unknownBuildText:
      "Das Spiel wurde wahrscheinlich aktualisiert. FMLibreEditor hat die Daten des Spiels gefunden und geprüft, " +
      "schreibt aber nicht in eine Version, mit der es nicht getestet wurde, bis Sie es erlauben. Eine neue Version von " +
      "FMLibreEditor folgt meist innerhalb weniger Tage.",
    allowedText:
      "Das Bearbeiten ist für diese Sitzung eingeschaltet, soweit die Prüfungen es zulassen. Behalten Sie eine Sicherung " +
      "Ihres Spielstands.",
    failedTitle: "Einige Daten des Spiels haben die Prüfung nicht bestanden",
    reloadHint: "Falls noch ein Spielstand geladen wurde, prüft „Daten neu laden“ erneut.",
    noDate: "Das Spieldatum hat die Prüfung nicht bestanden, daher wird kein Alter angezeigt.",
    failed: (names) => `Schreibgeschützt: ${names}.`,
    failedCheck: (name, fit, sampled) =>
      `${name} (${format(fit)} von ${format(sampled)} ${fit === 1 ? "passt" : "passen"})`,
    join: (names) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`,
    allow: "Trotzdem bearbeiten",
    allowTitle:
      "Schaltet das Bearbeiten ein, bis FMLibreEditor geschlossen wird oder sich neu verbindet. Sichern Sie vorher Ihren " +
      "Spielstand.",
  },

  diagnostics: {
    copy: "Diagnose kopieren",
    copyTitle:
      "Kopiert, was FMLibreEditor im Spiel gefunden hat, zum Einfügen in einen Fehlerbericht. Enthält keine Namen oder " +
      "Pfade.",
    copied: "Kopiert",
    failed: (reason) => `Die Diagnose konnte nicht kopiert werden: ${reason}`,
  },

  checks: {
    gameDate: "Spieldatum",
    players: "Spielerdaten",
    abilities: "aktuelle und potenzielle Fähigkeit",
    positions: "Positionen",
    attributes: "Attribute",
    personality: "Persönlichkeit",
    liveValues: "Energie, Spielpraxis, Erschöpfung und Moral",
    contracts: "Verträge",
    teams: "Mannschaften",
    staff: "Mitarbeiter",
    clubs: "Vereine",
    cohesion: "Teambuilding mit den Vereinen",
  },

  update: {
    available: (version) => `FMLibreEditor ${version} ist verfügbar`,
    youHave: (version) => `Installiert ist ${version}.`,
    download: "Herunterladen",
    install: "Aktualisieren",
    installTitle:
      "Lädt die neue Version herunter und installiert sie; FMLibreEditor schließt sich und öffnet sich mit ihr neu",
    preparing: "Wird vorbereitet…",
    downloading: (percent) =>
      percent === null ? "Wird heruntergeladen…" : `Wird heruntergeladen… ${percent} %`,
    installing: "Wird installiert: FMLibreEditor schließt sich und öffnet sich mit der neuen Version neu.",
    installFailed: (reason) =>
      `Die Aktualisierung ist fehlgeschlagen: ${reason}. Laden Sie die Version stattdessen von ihrer Seite herunter.`,
    notInstallable:
      "Diese Version lässt sich nicht von hier aus installieren. Laden Sie sie stattdessen von ihrer Seite herunter.",
    later: "Später",
    check: "Nach Updates suchen",
    checking: "Suche nach Updates…",
    upToDate: "Sie haben die neueste Version.",
    failed: "Die Suche nach Updates ist fehlgeschlagen.",
  },

  edit: {
    unknownNation: "Unbekanntes Land",
    edit: "Bearbeiten",
    editTitle: "Ändert die Werte dieses Profils im Spiel",
    startFailed: (reason) => `Das Bearbeiten konnte nicht gestartet werden: ${reason}`,
    positionRating: (position) => `Bewertung ${position}`,
    was: (value) => `vorher ${value}`,
    invalid: (min, max) => `Geben Sie eine ganze Zahl von ${min} bis ${max} ein`,
    invalidDate: (from, to) => `Geben Sie ein Datum vom ${from} bis zum ${to} ein`,
    invalidMoney: (from, to) => `Geben Sie einen ganzen Betrag von ${from} bis ${to} ein`,
    invalidPercentage: (from, to) => `Geben Sie einen ganzen Prozentwert von ${from} bis ${to} ein`,
    percent: "%",
    yes: "Ja",
    no: "Nein",
    none: "keine",

    // Die Fußzeile
    footer: "Bearbeitung",
    changes: changeCount,
    invalidCount: (count) => `${count} ungültig`,
    review: "Überprüfen",
    reviewList: "Anzuwendende Änderungen",
    discard: "Verwerfen",
    apply: "Anwenden",
    applying: "Wird angewendet…",
    applyBlocked: "Korrigieren Sie zuerst die ungültigen Werte",
    done: "Fertig",
    confirmDiscard: (count) => `${changes(count)} verwerfen?`,
    keepEditing: "Weiter bearbeiten",

    // Nach dem Anwenden
    applied: (count) => `${changes(count)} angewendet`,
    nothingToChange: "Nichts zu ändern: Das Spiel hat diese Werte bereits.",
    refused: (label, reason) => `${label}: ${reason}`,
    rereadFailed: (reason) => `Die Werte konnten nicht erneut gelesen werden: ${reason}`,
    dismiss: "Ausblenden",
  },

  changes: {
    nav: "Änderungen",
    title: "Änderungen in dieser Sitzung",
    hint: "Neueste zuerst. Eine Änderung lässt sich nur rückgängig machen, solange das Spiel noch den geschriebenen Wert hat.",
    continueHint: "Das Spiel zeigt eine Änderung, sobald es weiterläuft: Klicken Sie im Spiel auf Fortfahren.",
    swappedWith: (name) => `Getauscht gegen ${name}`,
    released: (name) => `Vertrag von ${name} aufgelöst`,
    fee: (amount) => `Ablöse ${amount}`,
    optionRemoved: (amount) => `Kaufoption (${amount}) entfernt`,
    healed: (count) => (count === 1 ? "1 Verletzung geheilt" : `${format(count)} Verletzungen geheilt`),
    lifted: (count) => (count === 1 ? "1 Sperre aufgehoben" : `${format(count)} Sperren aufgehoben`),
    keptPlaying: (date) => (date === null ? "Spielt weiter" : `Karriereende am ${date} verhindert`),
    count: (total, undone) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${format(undone)} rückgängig gemacht`;
    },
    empty:
      "Noch keine Änderungen. Öffnen Sie einen Spieler, einen Mitarbeiter oder einen Verein und wählen Sie " +
      "Bearbeiten, oder nutzen Sie die Massenbearbeitung in einer Liste.",
    columns: {
      time: "Zeit",
      name: "Name",
      field: "Feld",
      change: "Änderung",
      status: "Status",
    },
    kinds: { player: "Spieler", staff: "Mitarbeiter", club: "Verein" },
    stored: (change) => `Rohwerte ${change}`,
    undone: (time) => `Rückgängig gemacht um ${time}`,
    undo: "Rückgängig",
    undoTitle: (label) => `Schreibt den alten Wert von ${label} zurück ins Spiel`,
    batch: "Massenbearbeitung",
    batchCount: (total, remaining) =>
      remaining === 0
        ? `${changeCount(total)} · ${total === 1 ? "rückgängig gemacht" : "alle rückgängig gemacht"}`
        : `${changeCount(total)} · ${format(remaining)} nicht rückgängig gemacht`,
    showChanges: "Änderungen zeigen",
    hideChanges: "Änderungen ausblenden",
    undoBatch: "Massenbearbeitung rückgängig machen",
    undoBatchTitle: (remaining) =>
      `Schreibt die alten Werte dieser Massenbearbeitung zurück ins Spiel (${format(remaining)} noch wirksam)`,

    pages: "Seiten der Liste",
    batchPages: "Seiten der Änderungen dieser Massenbearbeitung",
    previous: "Zurück",
    next: "Weiter",
    range: (first, last, total) => `${format(first)}–${format(last)} von ${format(total)}`,
  },

  export: {
    button: "Exportieren",
    buttonTitle: {
      player:
        "Schreibt die Spieler, die die Liste zeigt, in eine CSV- oder JSON-Datei, für eine Tabellenkalkulation oder ein " +
        "Skript",
      staff:
        "Schreibt die Mitarbeiter, die die Liste zeigt, in eine CSV- oder JSON-Datei, für eine Tabellenkalkulation oder " +
        "ein Skript",
      club:
        "Schreibt die Vereine, die die Liste zeigt, in eine CSV- oder JSON-Datei, für eine Tabellenkalkulation oder ein " +
        "Skript",
    },
    title: { player: "Spieler exportieren", staff: "Mitarbeiter exportieren", club: "Vereine exportieren" },
    scope: (entity, count) =>
      count === 0
        ? `Kein ${nouns[entity].one} passt zur Suche und zu den Filtern.`
        : `${entityCount(entity, count)}: was die Suche und die Filter der Liste auswählen, in ihrer Reihenfolge.`,
    formatLabel: "Format",
    formats: {
      csv: "CSV, durch Kommas getrennt",
      csvSemicolon: "CSV, durch Semikolons getrennt",
      json: "JSON",
    },
    formatHints: {
      csv: "Für die meisten Tabellenkalkulationen und Skripte",
      csvSemicolon: "Für Excel, wo Dezimalzahlen mit Komma geschrieben werden: etwa auf Deutsch, Türkisch oder Spanisch",
      json: {
        player: "Für Skripte: Positionen, Attribute und Persönlichkeit als eigene Objekte",
        staff: "Für Skripte: Attribute, Persönlichkeit und Vertrag als eigene Objekte",
        club: "Für Skripte: Fans, Einrichtungen, Stadion und Finanzen als eigene Objekte",
      },
    },
    contents: {
      player:
        "Für jeden Spieler: Fähigkeiten, Positionen und Positionsbewertungen, Attribute auf der Skala 1–20 (auch die " +
        "verborgenen), Persönlichkeit, Ansehen, Länderspiele und Vertrag mit seinen Klauseln, mit dem Spieldatum. " +
        "Geldbeträge sind in Pfund, wie das Spiel sie speichert. Im Spiel ändert sich nichts.",
      staff:
        "Für jeden Mitarbeiter: Job und Verein, Fähigkeiten, Attribute auf der Skala 1–20, Persönlichkeit, Ansehen und " +
        "Vertrag (Gehalt und Daten), mit dem Spieldatum. Geldbeträge sind in Pfund, wie das Spiel sie speichert. Im " +
        "Spiel ändert sich nichts.",
      club:
        "Für jeden Verein: Ansehen, Gründungsjahr, Dauerkarten, Follower in sozialen Medien, Fantypen und " +
        "Fan-Eigenschaften, Einrichtungen, Stadion und Finanzen (Kontostand, Transferbudget, wöchentliche " +
        "Gehaltsausgaben und Gehaltsbudget, Ticketpreis), mit dem Spieldatum. FM führt Finanzen nur für Vereine in den " +
        "gespielten Ligen. Geldbeträge sind in Pfund, wie das Spiel sie speichert. Im Spiel ändert sich nichts.",
    },
    export: "Exportieren",
    exporting: "Wird exportiert…",
    done: (entity, count, file) => `${entityCount(entity, count)} in ${file} exportiert`,
    folder: (folder) => `in ${folder}`,
    skipped: (entity, count) =>
      count === 1
        ? `${entityCount(entity, count)} hat sich im Spiel geändert, während er gelesen wurde, und wurde ausgelassen.`
        : `${entityCount(entity, count)} haben sich im Spiel geändert, während sie gelesen wurden, und wurden ` +
          "ausgelassen.",
    open: "Öffnen",
    openTitle: "Öffnet die Datei mit der App, mit der Ihr System sie öffnet",
    show: "Im Ordner zeigen",
    showTitle: "Zeigt die Datei in ihrem Ordner",
    close: "Schließen",
  },

  massEdit: {
    button: "Massenbearbeitung",
    buttonTitle: "Ändert Werte von allem, was die Liste zeigt, mit einer Vorschau vorab",
    title: {
      player: "Massenbearbeitung: Spieler",
      staff: "Massenbearbeitung: Mitarbeiter",
      club: "Massenbearbeitung: Vereine",
    },

    // Worauf sie sich bezieht
    scope: (entity, total) =>
      total === 1
        ? `Der 1 ${nouns[entity].one}, den die Liste jetzt zeigt (Suche und Filter)`
        : `Die ${format(total)} ${nouns[entity].many}, die die Liste jetzt zeigt (Suche und Filter)`,
    scopeAll: (shown) =>
      shown === 1
        ? "Das sind alle Treffer, nicht nur die erste Zeile auf dem Bildschirm."
        : `Das sind alle Treffer, nicht nur die ersten ${format(shown)} Zeilen auf dem Bildschirm.`,
    scopeNone: (entity) =>
      `Kein ${nouns[entity].one} passt zur Suche und zu den Filtern, daher gibt es nichts zu ändern.`,
    scopeTooMany: (entity, total, limit) =>
      `Die ${entityCount(entity, total)}, die die Liste zeigt, sind mehr, als eine Massenbearbeitung annimmt ` +
      `(${format(limit)}). Grenzen Sie zuerst die Suche oder die Filter ein.`,
    loadingFields: "Felder werden gelesen…",
    fieldsFailed: (reason) => `Die Felder konnten nicht gelesen werden: ${reason}`,

    // Die zu ändernden Felder
    groups: {
      ability: "Fähigkeit",
      technical: "Technische Attribute",
      mental: "Mentale Attribute",
      physical: "Physische Attribute",
      goalkeeping: "Torwartattribute",
      hidden: "Verborgene Attribute",
      feet: "Füße",
      coaching: "Trainerattribute",
      knowledge: "Kenntnisse",
      medical: "Medizinische Attribute",
      positions: "Positionen",
      personality: "Persönlichkeit",
      reputation: "Ansehen",
      international: "Nationalmannschaft",
      contract: "Vertrag",
      facilities: "Einrichtungen",
      finances: "Finanzen",
      stadium: "Stadion",
      traits: "Spielereigenschaften",
      health: "Medizinisch",
      other: "Sonstiges",
    },
    fieldsLabel: "Zu ändernde Felder",
    row: (position) => `Änderung ${position}`,
    field: "Feld",
    operation: "Aktion",
    operations: { set: "Setzen auf", add: "Addieren", scale: "Skalieren auf %" },
    values: { set: "Wert", add: "Betrag", scale: "Prozent" },
    addTitle: "Wird zu jedem Wert, wie er angezeigt wird, addiert; eine negative Zahl zieht ab",
    addPointsTitle:
      "Prozentpunkte, die zu jedem Wert addiert werden (70 % plus 10 ergibt 80 %); eine negative Zahl zieht ab",
    rangeHint: (min, max) => `${format(min)}–${format(max)}`,
    amountHint: (max) => `±${format(max)}`,
    ofCurrent: "% des aktuellen Werts",
    percentTitle: "Ein Prozentsatz des aktuellen Werts: 100 behält ihn bei, 110 erhöht ihn um ein Zehntel, 50 halbiert ihn",
    invalidAdd: (min, max) => `Geben Sie eine ganze Zahl von ${format(min)} bis ${format(max)} ein`,
    invalidPercent: (min, max) => `Geben Sie einen ganzen Prozentwert von ${min} bis ${max} ein`,
    dateSetOnly: "Ein Datum kann nur gesetzt werden",
    addField: "Feld hinzufügen",
    addFieldFull: (max) => `Eine Massenbearbeitung ändert bis zu ${max} Felder`,
    remove: "Dieses Feld entfernen",
    removeLast: "Eine Massenbearbeitung braucht mindestens ein Feld",

    // Die Vorschau
    preview: "Vorschau",
    previewing: "Vorschau wird erstellt…",
    previewBlocked: "Füllen Sie jedes Feld mit einem gültigen Wert aus, um die Vorschau zu sehen",
    summary: (entity, preview) =>
      [
        preview.changes === 0
          ? "Keine Änderungen"
          : `${changeCount(preview.changes)} für ${format(preview.targets - preview.unchanged)} von ` +
            entityDative(entity, preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 hat diese Werte bereits"
            : `${format(preview.unchanged)} haben diese Werte bereits`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Änderungen, die die Massenbearbeitung vornehmen würde",
    columns: { name: "Name", field: "Feld", change: "Änderung", reason: "Grund" },
    more: (count) => (count === 1 ? "und 1 weiterer Eintrag" : `und ${format(count)} weitere Einträge`),
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Werte, die die Massenbearbeitung unverändert lässt",

    // Anwenden und rückgängig machen
    apply: "Anwenden",
    applying: "Wird angewendet…",
    applyTitle: (count) => `Schreibt ${changes(count)} ins Spiel`,
    applyFirst: "Erstellen Sie zuerst eine Vorschau der Massenbearbeitung",
    applyNothing: "Die Vorschau enthält keine Änderungen, die geschrieben werden könnten",
    hint: "Im Spiel ändert sich nichts, bis Sie anwenden.",
    applied: (count) => (count === 0 ? "Es wurden keine Änderungen geschrieben" : `${changes(count)} angewendet`),
    failure: (name, label, reason) => `${name} · ${label}: ${reason}`,
    undo: "Diese Massenbearbeitung rückgängig machen",
    undoing: "Wird rückgängig gemacht…",
    undoTitle: "Schreibt die alten Werte dieser Massenbearbeitung zurück ins Spiel",
    undone: (count) => (count === 0 ? "Nichts wurde rückgängig gemacht" : `${changes(count)} rückgängig gemacht`),
    undoFailure: (who, reason) => `${who}: ${reason}`,
    changeNumber: (id) => `Änderung ${id}`,
    close: "Schließen",
  },

  comparison: {
    compare: "Vergleichen",
    add: "Zum Vergleich hinzufügen",
    remove: "Aus dem Vergleich entfernen",
    full: (max) =>
      `Ein Vergleich umfasst bis zu ${max} Spieler. Entfernen Sie einen, um diesen Spieler hinzuzufügen.`,

    trayLabel: "Zu vergleichende Spieler",
    removePlayer: (name) => `Aus dem Vergleich entfernen: ${name}`,
    clear: "Leeren",
    open: (count) => `Vergleichen (${count})`,

    title: "Vergleich",
    hint: "In jeder Zeile ist der beste Wert hervorgehoben: der höchste oder, wo niedriger besser ist, der niedrigste.",
    tooFew: "Fügen Sie mindestens zwei Spieler hinzu, um sie zu vergleichen.",
    loading: "Spieler werden geladen…",
    tableLabel: "Werte der verglichenen Spieler",
    highest: "höchster Wert",
    lowest: "niedrigster Wert",
    profile: "Profil",
    close: "Schließen",
  },

  move: {
    button: "Transferieren",
    buttonTitle: "Transferiert diesen Spieler im Spiel zu einem anderen Verein, auf Wunsch gegen Ablöse",

    // Das Fenster
    title: "Transfer",
    from: "Von",
    to: "Zu",

    modeLabel: "Transfer oder Tausch",
    modeMove: "Zu einem Verein transferieren",
    modeSwap: "Gegen einen Spieler tauschen",

    // Die Wahl des Vereins
    searchLabel: "Verein suchen, zu dem der Spieler wechselt",
    resultsLabel: "Gefundene Vereine",
    searching: "Vereine werden gesucht…",
    searchFailed: (reason) => `Die Vereine konnten nicht durchsucht werden: ${reason}`,
    more: (count) =>
      `${count === 1 ? "und 1 weiterer Verein" : `und ${format(count)} weitere Vereine`}; tippen Sie weiter, um ` +
      "die Suche einzugrenzen",
    change: "Anderen Verein wählen",

    // Die Ablöse
    feeHeading: "Ablöse",
    fee: "Ablösesumme",
    feeHint: "Leer lassen für einen ablösefreien Transfer",
    feeInvalid: (max) => `Geben Sie einen ganzen Betrag von 0 bis ${max} ein`,
    pays: (club, fee, balance, budget) =>
      `${club} zahlt ${fee}: Kontostand ${balance}${budget === null ? "" : `, Transferbudget ${budget}`}`,
    receives: (club, fee, balance) => `${club} erhält ${fee}: Kontostand ${balance}`,
    noFinances: (club) => `${club} hat im Spiel keine Finanzen: Das Geld des Vereins bleibt, wie es ist`,

    // Der Vertrag
    wageInvalid: "Geben Sie einen ganzen Betrag ein, 0 oder mehr",
    expiresInvalid: "Geben Sie ein Datum ein",

    // Was das Fenster über den Transfer sagt
    chooseClub: "Wählen Sie den Verein, zu dem der Spieler wechselt.",
    fixTerms: "Korrigieren Sie zuerst die Ablöse oder die Vertragswerte.",
    checking: "Transfer wird geprüft…",
    route: (from, to) => `${from} → ${to}`,
    doesHeading: "Was der Transfer bewirkt",
    does: [
      "Wechselt in die 1. Mannschaft des neuen Vereins",
      "Vertrag ab dem Spieldatum; Rückennummer entfernt",
      "Wird von der Transfer- und der Leihliste genommen",
      "Gehalt und Vertragsende ändern sich nur, wenn Sie neue festlegen",
      "Die Ablöse geht vom Kontostand und vom Transferbudget des kaufenden Vereins ab und auf den Kontostand des " +
        "verkaufenden Vereins",
      "Ein Kapitänsamt beim alten Verein bleibt unbesetzt",
      "Die Transferhistorie des Spiels verzeichnet den Transfer noch nicht",
      "Steht unter Änderungen, wo ein einziges Rückgängig den Transfer und die Ablöse zurücknimmt",
    ],

    // Ein Verein mit voller Kaderliste
    noRoom: (club) => `${club} hat keinen Platz im Kader.`,
    noRoomInfoLabel: "Warum?",
    noRoomInfo:
      "Der Editor vergrößert eine volle Kaderliste, wo er kann, aber diese kann er nicht vergrößern: Ein Spieler muss " +
      "gehen, um Platz zu schaffen.",
    noRoomNeed: (player, club) => `Damit ${player} wechseln kann, muss ein Spieler ${club} verlassen.`,
    releaseChoice: "Vertrag auflösen:",
    releasePickLabel: "Spieler, dessen Vertrag aufgelöst wird",
    releaseOutcome: "→ wird vertragslos",
    injuredTag: "verletzt",
    captainTag: "Kapitän",
    swapChoice: "Zum Tausch machen:",
    swapChoiceOutcome: (club) => `dieser Spieler wechselt zu ${club}`,
    moveAndRelease: (name) => `Transferieren und Vertrag von ${name} auflösen`,
    makeRoomDoes: [
      "Wechselt in die 1. Mannschaft des neuen Vereins, an die Stelle des Spielers, dessen Vertrag aufgelöst wird",
      "Der Spieler, dessen Vertrag aufgelöst wird, verlässt jede Mannschaft dieses Vereins, und sein Vertrag endet: Er " +
        "ist vertragslos",
      "Vertrag ab dem Spieldatum; Rückennummer entfernt",
      "Wird von der Transfer- und der Leihliste genommen",
      "Gehalt und Vertragsende ändern sich nur, wenn Sie neue festlegen",
      "Die Ablöse geht vom Kontostand und vom Transferbudget des kaufenden Vereins ab und auf den Kontostand des " +
        "verkaufenden Vereins",
      "Ein Kapitänsamt, das einer der beiden bei dem Verein innehatte, den er verlässt, bleibt unbesetzt",
      "Die Transferhistorie des Spiels verzeichnet den Transfer noch nicht",
      "Steht unter Änderungen als eine Änderung, wo ein einziges Rückgängig den Transfer, die Vertragsauflösung und " +
        "die Ablöse zurücknimmt",
    ],

    // Der Tausch mit einem Spieler des Vereins
    swapTitle: "Gegen einen Spieler tauschen",
    swapWith: "Tauschen gegen",
    playerSearchLabel: "Spieler suchen, gegen den getauscht wird",
    playerSearch: "Spieler dieses Vereins nach Name suchen",
    playersLabel: "Gefundene Spieler",
    playersSearching: "Spieler werden gesucht…",
    playersSearchFailed: (reason) => `Die Spieler konnten nicht durchsucht werden: ${reason}`,
    playersEmpty: (query) =>
      query === "" ? "Dieser Verein hat keine Spieler." : `Kein Spieler dieses Vereins passt zu „${query}“.`,
    changePlayer: "Anderen Spieler wählen",

    // Was das Fenster über den Tausch sagt
    swapContract: "Jeder Spieler behält seinen eigenen Vertrag; Gehälter und Vertragsenden ändern sich nicht.",
    staffButtonTitle: "Versetzt diesen Mitarbeiter im Spiel zu einem anderen Verein",
    staffChooseClub: "Wählen Sie den Verein, zu dem dieser Mitarbeiter wechselt.",
    staffContract: "Behält Job, Gehalt und Vertragsende; der Vertrag beginnt mit dem Spieldatum.",
    staffJob: "Job",
    staffJobChoose: "Job wählen…",
    staffJobKept: (job) => `${job} (bleibt)`,
    staffNewJob:
      "Übernimmt den neuen Job und behält Gehalt und Vertragsende; der Vertrag beginnt mit dem Spieldatum.",
    staffDoes: [
      "Wechselt zum neuen Verein dorthin, wo der Job ist: in dessen medizinische Abteilung, Trainerstab oder " +
        "Scoutingabteilung, oder als Sportdirektor oder Trainer, was ein Verein, der schon einen hat, nicht annimmt",
      "Gleiches Gehalt und gleiches Vertragsende; der Vertrag beginnt mit dem Spieldatum",
      "Ein Trainer, der eine Mannschaft verlässt, lässt seinen Platz leer, damit der Verein ihn besetzt; der Vorstand " +
        "bleibt dem Spiel überlassen",
      "Steht unter Änderungen, wo es sich rückgängig machen lässt",
    ],
    staffSignButtonTitle: "Verpflichtet diesen vereinslosen Mitarbeiter im Spiel für einen Verein",
    staffSignTitle: "Mitarbeiter verpflichten",
    staffSignChooseClub: "Wählen Sie den Verein, für den er verpflichtet wird.",
    staffSignChooseJob: "Wählen Sie den Job, den er beim Verein übernimmt.",
    staffSignTerms:
      "Leer lassen für das Gehalt jenes Mitarbeiters des Vereins, dessen Job seinem am ähnlichsten ist, und einen " +
      "Vertrag bis zum Ende der nächsten Saison.",
    staffSignRoute: (to) => `Kein Verein → ${to}`,
    staffSignContract: (wage, expires) => `Neuer Vertrag: ${wage} pro Woche bis ${expires}`,
    staffSignDoes: [
      "Wechselt zum Verein dorthin, wo der Job ist: in dessen Abteilung, die vergrößert wird, wenn sie voll ist, oder " +
        "als Sportdirektor oder Trainer, wenn der Verein keinen hat",
      "Ein neuer Vertrag ab dem Spieldatum, in einem der eigenen freien Vertragsplätze des Spiels, so wie das Spiel " +
        "einen anlegt",
      "Nach dem Vorbild des Vertrags jenes Mitarbeiters des Vereins mit demselben Job (sonst aus derselben Abteilung, " +
        "sonst eines beliebigen), dessen Fähigkeit seiner am nächsten kommt",
      "Das von Ihnen eingegebene Gehalt und Vertragsende, oder das Gehalt jenes Vertrags und das Ende der nächsten " +
        "Saison; keine Klauseln oder Prämien",
      "Steht unter Änderungen, wo ein einziges Rückgängig alles zurücknimmt",
    ],
    swapChooseClub: "Wählen Sie den Verein des Spielers, gegen den getauscht wird.",
    swapChoosePlayer: "Wählen Sie den Spieler, gegen den getauscht wird.",
    swapChecking: "Tausch wird geprüft…",
    swapRoute: (player, from, to, other) => `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "Was der Tausch bewirkt",
    swapDoes: [
      "Jeder wechselt in die 1. Mannschaft des Vereins des anderen",
      "Verträge ab dem Spieldatum; Rückennummern entfernt",
      "Beide werden von der Transfer- und der Leihliste genommen",
      "Ein Kapitänsamt bei den alten Vereinen bleibt unbesetzt",
      "Es werden keine Ablösen gezahlt; die Karrierehistorie wird nicht aktualisiert",
      "Steht unter Änderungen als eine Änderung, die beide Wechsel zurücknimmt",
    ],

    // Die Verpflichtung eines vertragslosen Spielers
    signButtonTitle: "Verpflichtet diesen vertragslosen Spieler im Spiel für einen Verein",
    signTitle: "Vertragslosen Spieler verpflichten",
    signChooseClub: "Wählen Sie den Verein, für den der Spieler verpflichtet wird.",
    signChecking: "Verpflichtung wird geprüft…",
    signTerms:
      "Leer lassen für das Gehalt jenes Spielers des Vereins, dessen Fähigkeit seiner am nächsten kommt, und einen " +
      "Vertrag bis zum Ende der nächsten Saison.",
    signRoute: (to) => `Vertragslos → ${to}`,
    signContract: (wage, expires, status) => `Neuer Vertrag: ${wage} pro Woche bis ${expires}, ${status}`,
    signDoesHeading: "Was die Verpflichtung bewirkt",
    signDoes: [
      "Wechselt in die 1. Mannschaft des Vereins; eine volle Kaderliste wird vergrößert",
      "Ein neuer Vertrag ab dem Spieldatum, in einem der eigenen freien Vertragsplätze des Spiels, so wie das Spiel " +
        "einen anlegt",
      "Nach dem Vorbild des Vertrags jenes Spielers des Vereins, dessen Fähigkeit seiner am nächsten kommt: dieselbe " +
        "Vertragsart und derselbe Teamstatus",
      "Das von Ihnen eingegebene Gehalt und Vertragsende, oder das Gehalt jenes Spielers und das Ende der nächsten " +
        "Saison",
      "Keine Rückennummer, kein Loyalitätsbonus, keine Klauseln oder Prämien",
      "Die Transferhistorie des Spiels verzeichnet die Verpflichtung noch nicht",
      "Steht unter Änderungen, wo ein einziges Rückgängig alles zurücknimmt",
    ],
    signHint: "Im Spiel ändert sich nichts, bis Sie auf Verpflichten klicken.",
    sign: "Verpflichten",
    signing: "Wird verpflichtet…",

    // Die Fußzeile
    hint: "Im Spiel ändert sich nichts, bis Sie auf Transferieren klicken.",
    move: "Transferieren",
    moving: "Wird transferiert…",
    cancel: "Abbrechen",
    swapHint: "Im Spiel ändert sich nichts, bis Sie auf Tauschen klicken.",
    swap: "Tauschen",
    swapping: "Wird getauscht…",
  },

  ties: {
    heading: "Nationalität und Eigengewächs",
    nationalities: "Weitere Staatsangehörigkeiten",
    trainedInNation: "Ausgebildet im Land",
    trainedAtClub: "Ausgebildet im Verein",
    workPermit: "Keine Arbeitserlaubnis nötig in",
    none: "Keine",
    rules: {
      1: "Eigengewächs 15-21",
      2: "Eigengewächs 0-21",
      5: "Eigengewächs 15-21 (Leihen ausgenommen)",
      10: "Eigengewächs 0-19 (1 Jahr)",
    },
    rule: (code) => `Eigengewächs-Regel ${format(code)}`,

    // Die Schaltfläche unter der Gruppe und das Fenster, das sie öffnet
    change: "Ändern",
    changeTitle: "Ändert im Spiel die weiteren Staatsangehörigkeiten und den Eigengewächs-Status dieses Spielers",
    title: "Nationalität und Eigengewächs",
    hint: "Jede Änderung wird sofort ins Spiel geschrieben und unter Änderungen geführt, wo sie sich rückgängig machen lässt.",
    full:
      "Das Spiel hat die Liste dieses Spielers nur so groß angelegt, wie es ihr Inhalt verlangt: Eine Nationalität " +
      "oder Ausbildung lässt sich ändern oder entfernen, aber nicht hinzufügen.",
    nationOf: (name) => `Land statt ${name}`,
    ruleOf: (name) => `Eigengewächs-Regel für ${name}`,
    remove: "Entfernen",
    removeTitle: (name) => `${name} entfernen`,
    addNationality: "Nationalität hinzufügen…",
    addNation: "Land hinzufügen…",
    addPermit: "Land ohne nötige Arbeitserlaubnis hinzufügen…",
    daysLeft: (days) => (days === 1 ? "noch 1 Tag" : `noch ${format(days)} Tage`),
    permitInfoLabel: "Was bewirkt das?",
    permitInfo:
      "Das Spiel lässt Spieler aus der Europäischen Union, die vor dem Brexit in England oder Schottland waren, dort " +
      "eine bestimmte Anzahl von Tagen ohne Arbeitserlaubnis spielen. Ein Spieler, dem Sie dies geben, braucht ebenfalls " +
      "keine Arbeitserlaubnis, um in diesem Land zu spielen, und zwar für so viele Tage, wie jenen verbleiben (zehn " +
      "Jahre, wenn niemand im Spielstand dies hat).",
    newRule: "Eigengewächs-Regel des neuen Landes",
    add: "Hinzufügen",
    changeClub: "Verein ändern",
    changeClubTitle: (name) => `Lässt ihn statt bei ${name} bei einem anderen Verein ausgebildet sein`,
    clubInsteadOf: (name) => `Verein statt ${name}`,
    addClub: "Verein hinzufügen…",
    addClubTitle: "Lässt ihn bei einem weiteren Verein ausgebildet sein",
    newClub: "Neuer Verein",
    pickAnother: "Anderen wählen",
    newClubRule: "Eigengewächs-Regel des neuen Vereins",
    cancel: "Abbrechen",
    working: "Wird ins Spiel geschrieben…",
    close: "Schließen",
  },

  clauses: {
    change: "Ändern",
    changeTitle: "Ändert im Spiel die Prämien und Klauseln dieses Spielers",
    title: "Prämien & Klauseln",
    hint: "Jede Änderung wird sofort ins Spiel geschrieben und unter Änderungen geführt, wo sie sich rückgängig machen lässt.",
    full:
      "Das Spiel hat die Liste dieses Vertrags nur so groß angelegt, wie es ihr Inhalt verlangt: Eine Prämie oder " +
      "Klausel lässt sich ändern oder entfernen, aber eine Ausstiegsklausel lässt sich nicht hinzufügen.",
    amountOf: (name) => `${name}: Betrag`,
    conditionOf: (name) => `${name}: Bedingung`,
    save: "Speichern",
    remove: "Entfernen",
    removeTitle: (name) => `${name} entfernen`,
    addRelease: "Ausstiegsklausel hinzufügen",
    releaseAmount: "Betrag der neuen Ausstiegsklausel",
    add: "Hinzufügen",
    outOfRange: (max) => `Geben Sie eine ganze Zahl von 0 bis ${max} ein.`,
    working: "Wird ins Spiel geschrieben…",
    close: "Schließen",
  },

  release: {
    button: "Vertrag auflösen",
    buttonTitle: "Löst im Spiel den Vertrag dieses Spielers mit seinem Verein auf: Er wird vertragslos",

    // Das Fenster
    title: "Vertragsauflösung",
    from: "Verlässt",
    checking: "Vertragsauflösung wird geprüft…",
    ready: (club) => `${club} → vertragslos`,
    doesHeading: "Was die Vertragsauflösung bewirkt",
    does: [
      "Verlässt jede Mannschaft des Vereins, und der Vertrag endet: vertragslos, jeder Verein kann ihn verpflichten",
      "Niemand erhält Geld",
      "Ein Kapitänsamt beim Verein bleibt unbesetzt",
      "Die Transferhistorie des Spiels verzeichnet sie nicht",
      "Steht unter Änderungen, wo ein einziges Rückgängig den Spieler mit demselben Vertrag zurückholt",
    ],

    // Die Fußzeile
    hint: "Im Spiel ändert sich nichts, bis Sie auf Vertrag auflösen klicken.",
    release: "Vertrag auflösen",
    releasing: "Vertrag wird aufgelöst…",
    cancel: "Abbrechen",
  },

  permanent: {
    title: "Leihspieler fest verpflichten",
    stays: "Bleibt bei",
    leaves: "Verlässt",
    checking: "Wird geprüft…",
    doesHeading: "Was das bewirkt",
    does: [
      "Er bleibt, wo er spielt, ab heute mit einem Vertrag bei diesem Verein, zu den Bedingungen oben",
      "Er behält die Rückennummer und den Teamstatus, die er dort hat",
      "Er verlässt jede Mannschaft seines eigenen Vereins, und die Leihe endet",
      "Die Transferhistorie des Spiels verzeichnet das nicht",
      "Steht unter Änderungen als Transfer, wo ein einziges Rückgängig die Leihe wiederherstellt",
    ],
    optionFee: (money) => `Aus der Kaufoption der Leihe übernommen: ${money}`,
    hint: "Im Spiel ändert sich nichts, bis Sie auf Fest verpflichten klicken.",
    confirm: "Fest verpflichten",
    confirming: "Wird fest verpflichtet…",
    cancel: "Abbrechen",
  },

  recall: {
    title: "Von Leihe zurückrufen",
    from: "Verliehen an",
    to: "Kehrt zurück zu",
    doesHeading: "Was der Rückruf bewirkt",
    does: (parent) => [
      "Heute wird zum letzten Tag der Leihe: Wenn der Tag vorbei ist, beendet das Spiel die Leihe selbst",
      `Fahren Sie im Spiel einen Tag fort, dann ist er wieder bei ${parent}`,
      "Bis dahin steht es unter Änderungen, wo ein Rückgängig das alte Ende der Leihe wiederherstellt",
    ],
    termsHeading: "Im Spiel",
    notRecallable: (parent) => `Die Leihe erlaubt ${parent} nicht, ihn zurückzubeordern`,
    notTerminable: "Die Leihe kann nicht vorzeitig beendet werden",
    worksAnyway:
      "Der Rückruf hier funktioniert trotzdem: Er läuft nicht über den Rückruf des Spiels, sondern verschiebt den letzten " +
      "Tag der Leihe",
    dropsOption: (club, amount) =>
      `Die Kaufoption von ${club} über ${amount} wird entfernt: Sonst könnte das Spiel ihn bei Ende der Leihe an ` +
      `${club} verkaufen`,
    hint: "Im Spiel ändert sich nichts, bis Sie auf Zurückrufen klicken.",
    confirm: "Zurückrufen",
    confirming: "Wird zurückgerufen…",
    cancel: "Abbrechen",
  },

  squad: {
    teamsLabel: "Mannschaft",
    teams: {
      first: "1. Mannschaft",
      b: "B-Mannschaft",
      age: (limit) => `U${limit}`,
      other: (place) => `Mannschaft ${place}`,
    },
    noTeams: "Dieser Verein hat keine Mannschaften.",
    loading: "Kader wird gelesen…",
    empty: "Keine Spieler in dieser Mannschaft.",

    // Über der Tabelle
    players: (count) => playerCount(count),
    averageAge: (age) => `Durchschnittsalter ${age}`,
    captains: (captain, viceCaptain) => `Kapitän: ${captain} · Vize-Kapitän: ${viceCaptain}`,

    // Die Aktionen für die ganze Mannschaft
    actionsLabel: "Aktionen für die ganze Mannschaft",
    healAll: (injured) => (injured === 0 ? "Alle heilen" : `Alle heilen (${format(injured)} verletzt)`),
    healAllTitle: "Heilt jede Verletzung jedes Spielers dieser Mannschaft",
    healNone: "Niemand in dieser Mannschaft ist verletzt",
    liftAll: (banned) => (banned === 0 ? "Sperren aufheben" : `Sperren aufheben (${format(banned)} gesperrt)`),
    liftAllTitle: "Hebt jede Sperre jedes Spielers dieser Mannschaft auf",
    liftNone: "Niemand in dieser Mannschaft ist gesperrt",
    inspireAll: "Alle motivieren",
    inspireAllTitle:
      "Setzt die Moral jedes Spielers dieser Mannschaft auf 20, den Höchstwert, und entfernt seine Gründe für " +
      "Unzufriedenheit",
    maxCohesion: "Teambuilding maximieren",
    maxCohesionTitle:
      "Setzt das Teambuilding jedes Spielers dieser Mannschaft mit dem Verein auf 100, den Höchstwert. Das Spiel zeigt " +
      "das Teambuilding der Mannschaft auf seiner Seite Mannschaftsgefüge, sobald es weiterläuft: Klicken Sie im Spiel " +
      "auf Fortfahren",
    cohesionNone:
      "Der Editor kann das Teambuilding dieser Mannschaft nicht lesen: Diese Version des Spiels wurde dafür nicht " +
      "geprüft, oder keiner ihrer Spieler hat einen Eintrag für den Verein",
    cohesionWithout: (count) =>
      count === 1
        ? "1 Spieler hat noch kein Teambuilding mit dem Verein"
        : `${format(count)} Spieler haben noch kein Teambuilding mit dem Verein`,
    refreshAll: "Alle regenerieren",
    refreshAllTitle:
      "Setzt Energie und Spielpraxis jedes Spielers dieser Mannschaft auf 100 % und lässt ihn sich voll erholen " +
      "(Erschöpfung -500)",
    maxAll: "Attribute maximieren",
    maxAllTitle:
      "Setzt jedes Attribut jedes Spielers dieser Mannschaft auf den besten Wert: 20, und 1 für " +
      "Verletzungsanfälligkeit und Unsportlichkeit",
    hint:
      "Die Aktionen betreffen jeden Spieler der Liste, auch die verliehenen. Rückgängig machen lässt sich auch in der " +
      "Ansicht Änderungen.",

    // Das Einfrieren der ganzen Mannschaft
    freezeLabel: "Ganze Mannschaft einfrieren",
    freezeAttributes: "Attribute einfrieren",
    freezeAttributesTitle:
      "Solange die App geöffnet und verbunden ist, werden die Attribute jedes Spielers dieser Mannschaft nicht " +
      "schlechter: Was das Spiel abzieht, wird wiederhergestellt, und Verbesserungen zählen weiterhin",
    freezeFitness: "Energie und Spielpraxis einfrieren",
    freezeFitnessTitle:
      "Solange die App geöffnet und verbunden ist, sinken Energie und Spielpraxis jedes Spielers dieser Mannschaft " +
      "nicht: Was das Spiel abzieht, wird wiederhergestellt. Nutzen Sie zuerst „Alle regenerieren“, um sie bei " +
      "100 % zu halten",
    freezePositions: "Positionen einfrieren",
    freezePositionsTitle:
      "Solange die App geöffnet und verbunden ist, bleiben die Positionsbewertungen jedes Spielers dieser Mannschaft, " +
      "wie sie sind: Eine Bewertung, die das Spiel erhöht oder senkt, wird zurückgesetzt",
    frozenCount: (frozen, total) => `${format(frozen)} von ${format(total)}`,
    freezeHint:
      "Das Einfrieren betrifft jeden Spieler der Liste und bleibt bei ihm, wohin er auch wechselt. Die App merkt sich " +
      "das für diesen Spielstand.",
    frozeAttributes: (count) =>
      count === 0 ? "Ihre Attribute waren bereits eingefroren" : `Attribute von ${playersDative(count)} eingefroren`,
    unfrozeAttributes: (count) => `Einfrieren der Attribute bei ${playersDative(count)} aufgehoben`,
    frozeFitness: (count) =>
      count === 0
        ? "Ihre Energie und Spielpraxis waren bereits eingefroren"
        : `Energie und Spielpraxis von ${playersDative(count)} eingefroren`,
    unfrozeFitness: (count) => `Einfrieren von Energie und Spielpraxis bei ${playersDative(count)} aufgehoben`,
    frozePositions: (count) =>
      count === 0 ? "Ihre Positionen waren bereits eingefroren" : `Positionen von ${playersDative(count)} eingefroren`,
    unfrozePositions: (count) => `Einfrieren der Positionen bei ${playersDative(count)} aufgehoben`,

    // Was eine Aktion bewirkt hat, unter den Schaltflächen
    written: (count) => `${changes(count)} geschrieben`,
    refused: (name, reason) => `${name}: ${reason}`,
    undo: "Rückgängig",
    undoTitle: "Schreibt die alten Werte dieser Änderungen zurück ins Spiel",

    // Kapitäne
    captainShort: "K",
    viceCaptainShort: "VK",
    menuLabel: (name) => `Kapitänsamt von ${name}`,
    menuTitle: "Kapitänsamt",
    makeCaptain: "Zum Kapitän ernennen",
    makeViceCaptain: "Zum Vize-Kapitän ernennen",
    nowCaptain: (name) => `${name} ist jetzt Kapitän`,
    nowViceCaptain: (name) => `${name} ist jetzt Vize-Kapitän`,
    noCaptain: "Niemand ist jetzt Kapitän",
    noViceCaptain: "Niemand ist jetzt Vize-Kapitän",

    // Die Tabelle
    tableLabel: (team) => `Spieler (${team})`,
    openProfile: "Profil des Spielers öffnen",
    columns: {
      name: "Name",
      position: "Pos.",
      age: "Alter",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "Energie",
      matchSharpness: "Spielpraxis",
      jadedness: "Ersch.",
      morale: "Moral",
      cohesion: "Teamb.",
      actions: "Kapitänsamt",
    },
    sortBy: (by) => `Sortieren nach ${by}`,
    sortNames: {
      name: "Name",
      position: "Position",
      age: "Alter",
      currentAbility: "derzeitiger Fähigkeit",
      potentialAbility: "potenzieller Fähigkeit",
      condition: "Energie",
      matchSharpness: "Spielpraxis",
      jadedness: "Erschöpfung",
      morale: "Moral",
      cohesion: "Teambuilding",
    },

    // Die Markierungen nach einem Namen, mit ihrer Bedeutung als Hinweistext
    injured: "Verletzt",
    injuredTitle: (count) => (count === 1 ? "1 Verletzung" : `${format(count)} Verletzungen`),
    banned: "Gesperrt",
    bannedTitle: (count) => (count === 1 ? "1 Sperre" : `${format(count)} Sperren`),
    onLoan: "Verliehen",
    onLoanTitle: "An einen anderen Verein verliehen",
    loanee: "Geliehen",
    loaneeTitle: "Von einem anderen Verein hierher ausgeliehen",
    elsewhere: "Anderswo",
    elsewhereTitle: "Spielt für eine andere Mannschaft des Vereins",
    frozen: "Eingefroren",
    frozenTitle: (attributes, fitness, positions) => {
      const frozen = [
        ...(attributes ? ["Attribute"] : []),
        ...(fitness ? ["Energie", "Spielpraxis"] : []),
        ...(positions ? ["Positionen"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} und ${last}` : last;
      return `Eingefroren: ${listed}`;
    },
  },

  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Unbekannter Store",
    },
    steamBuild: (id) => `Build ${id}`,
  },

  scouting: {
    nav: "Scouting",
    reading: "Ihr Verein wird gelesen…",
    refresh: "Aktualisieren",
    refreshTitle: "Liest den Verein erneut aus dem Spiel",
    searching: "Suche läuft…",
    none: "—",
    perWeek: " p/W",
    openProfile: "Profil öffnen",
    freeAgent: "Vertragslos",
    loan: "Leihe",
    header: {
      transferBudget: "Transferbudget",
      wageRoom: "Gehaltsspielraum",
      wageBudget: "Gehaltsbudget",
      squad: "Kader",
      averageAge: "Durchschnittsalter",
      players: (count) => playerCount(count),
    },
    tabs: {
      label: "Scouting-Bereiche",
      recommend: "Transferempfehlungen",
      depth: "Kadertiefe",
      departures: "Abgabekandidaten",
    },
    status: {
      missing: "Fehlt",
      thin: "Dünn",
      fine: "Gut",
      crowded: "Überbesetzt",
    },
    lines: {
      goalkeeper: "Torwart",
      centreBack: "Innenverteidiger",
      fullBack: "Außenverteidiger",
      wingBack: "Flügelverteidiger",
      defensiveMidfield: "Defensives Mittelfeld",
      centralMidfield: "Zentrales Mittelfeld",
      attackingMidfield: "Offensives Mittelfeld",
      wide: "Flügel",
      striker: "Stürmer",
    },
    depthLines: {
      gk: "Torhüter",
      dc: "Innenverteidiger",
      rightBack: "Rechtsverteidiger",
      leftBack: "Linksverteidiger",
      dm: "Defensive Mittelfeldspieler",
      mc: "Zentrale Mittelfeldspieler",
      rightWing: "Rechtsaußen",
      leftWing: "Linksaußen",
      amc: "Offensive Mittelfeldspieler",
      st: "Stürmer",
    },
    positionTip: (line, count, target, status) =>
      `${line}: ${format(count)} im Kader (üblich sind ${format(target)}) — ${status}`,
    brief: {
      heading: "Wonach suchen Sie?",
      pitch: "Position",
      legend: "Die Punkte zeigen, wie der Kader in jedem Mannschaftsteil aufgestellt ist.",
      inPossession: "Mit Ball",
      outOfPossession: "Ohne Ball",
      anyRole: "Alle — die beste Rolle für jeden Spieler",
      purpose: "Für",
      filters: "Filter",
      minAge: "Mindestalter",
      maxAge: "Höchstalter",
      maxFee: "Max. Ablöse",
      minProbability: "Wahrscheinlichkeit",
      anyProbability: "Alle",
      noFreeAgents: "Keine vertragslosen Spieler",
    },
    purposes: {
      firstTeam: "1. Mannschaft",
      rotation: "Rotation",
      future: "Zukunft",
      any: "Alle",
    },
    purposeTips: {
      firstTeam: "Besser als Ihr bester Spieler auf dieser Position",
      rotation: "So gut wie Ihre zweite Wahl, zu einem vernünftigen Preis",
      future: "21 oder jünger, mit Luft nach oben",
      any: "Jeder, der passt",
    },
    ask: {
      before: "Empfehlungen für ",
      after: "",
      anyRole: "beste Rolle pro Spieler",
    },
    own: {
      heading: "In Ihrem Kader",
      empty: "Niemand in Ihrem Kader spielt hier.",
      position: "Position",
    },
    summary: (candidates, eligible, shown, purpose) =>
      `${format(candidates)} Spieler können hier spielen · ${format(eligible)} passen zu „${purpose}“ · ` +
      `${format(shown)} empfohlen`,
    how: {
      label: "Wie entsteht diese Liste?",
      note: (rule, count) =>
        "Der Scout betrachtet jeden Spieler, der diese Position spielen kann (dort mit 10 oder mehr bewertet), außer " +
        "den Spielern Ihres eigenen Vereins und denen anderer menschlicher Trainer. Davon behält er die, die " +
        `${rule}. Für die 400, die am besten passen, schätzt er ab, wie wahrscheinlich jeder zu Ihnen wechselt, und ` +
        `empfiehlt dann die besten ${count} nach Eignung und Wahrscheinlichkeit zusammen. Empfohlene Reihenfolge: ` +
        "70 % Eignung und 30 % Wahrscheinlichkeit, etwas weniger für Spieler über 30; Rotation gewichtet " +
        "beides gleich, und Zukunft berücksichtigt auch das Potenzial. Klicken Sie auf einen Spaltentitel, um die " +
        "Liste zu sortieren; # ist die eigene Reihenfolge des Scouts.",
    },
    purposeRules: {
      firstTeam: "besser auf die Position passen als Ihr bester Spieler dort",
      rotation: "mindestens so gut passen wie Ihre zweite Wahl",
      future: "21 oder jünger sind und Luft nach oben haben (Potenzial mindestens 15 über der Fähigkeit)",
      any: "überhaupt passen",
    },
    sortBy: (by) => `Sortieren nach ${by}`,
    sortNames: {
      rank: "Reihenfolge des Scouts",
      name: "Name",
      age: "Alter",
      ca: "derzeitiger Fähigkeit",
      pa: "potenzieller Fähigkeit",
      fit: "Eignung",
      probability: "Wahrscheinlichkeit",
      fee: "Ablöse",
    },
    backToScoutOrder: "Zurück zur Reihenfolge des Scouts",
    showMore: (count) => (count === 1 ? "1 weiteren zeigen" : `${format(count)} weitere zeigen`),
    playsFor: (club) => `spielt für ${club}`,
    empty:
      "Keine Empfehlungen für diese Position mit diesen Einstellungen. Versuchen Sie den Zweck „Alle“ oder lockerere " +
      "Filter.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "Spieler",
      age: "Alter",
      fit: "Eignung",
      role: "Rolle",
      probability: "Wahrscheinlichkeit",
      fee: "Gesch. Ablöse",
      wage: "Gehalt",
      note: "Notiz des Scouts",
      money: "Ablöse",
      value: "Wert",
    },
    probabilityInfo:
      "Wie wahrscheinlich der Spieler zu Ihrem Verein wechselt — eine Schätzung aus seinem Wert, seinem Vertrag, seinem " +
      "Verein und seinem Ansehen.",
    probabilityInfoLabel: "Was bedeutet die Wahrscheinlichkeit?",
    fitTitle: (inPossession, outOfPossession, position) =>
      [
        inPossession !== null && `Mit Ball: ${inPossession}`,
        outOfPossession !== null && `Ohne Ball: ${outOfPossession}`,
        `Position: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note:
      "Die Eignung nutzt die eigenen Attributgewichtungen des Editors für jede Rolle; Ablösen, Gehälter und " +
      "Wahrscheinlichkeiten sind Schätzungen.",
    depth: {
      summary: (size, age, level) =>
        `${format(size)} Spieler${age === null ? "" : ` · Durchschnittsalter ${age}`} · durchschnittliche Fähigkeit ` +
        `der besten Elf ${level}`,
      weak: "Unter Kaderniveau",
      ageing: "In die Jahre gekommen",
      cover: (names) => `Können auch hier spielen: ${names}`,
      advice: "Empfehlungen holen",
      adviceTitle: "Transferempfehlungen für diesen Mannschaftsteil",
      empty: "Niemand",
      ability: "Derzeitige Fähigkeit",
      more: (count) => (count === 1 ? "+1 weiterer" : `+${format(count)} weitere`),
      columns: {
        line: "Mannschaftsteil",
        status: "Status",
        count: "Spieler",
        players: "Beste zuerst (Fähigkeit)",
        cover: "Können auch hier spielen",
        age: "Ø Alter",
      },
      countTitle: (count, target) =>
        `${format(count)} Spieler, deren beste Position in diesem Mannschaftsteil liegt; ein Kader hat üblicherweise ` +
        format(target),
      statusHelp: {
        missing: "Niemand spielt hier.",
        thin: "Weniger, als ein Kader üblicherweise hat; Spieler, die aushelfen können, zählen halb.",
        fine: "Etwa so viele, wie ein Kader üblicherweise hat.",
        crowded: "Zwei oder mehr Spieler über dem, was ein Kader üblicherweise hat.",
      },
      attention: "Genauer ansehen:",
      allFine: "Jeder Mannschaftsteil wirkt ausgewogen.",
    },
    departures: {
      intro: "Spieler, die Ihr Scout abgeben würde, die dringendsten zuerst.",
      filter: "Empfehlung",
      all: "Alle",
      empty: "Ihr Scout würde derzeit niemanden abgeben.",
      sortNames: {
        rank: "Reihenfolge des Scouts",
        name: "Name",
        age: "Alter",
        ca: "derzeitiger Fähigkeit",
        pa: "potenzieller Fähigkeit",
        value: "Wert",
        wage: "Gehalt",
        contract: "Vertragsende",
      },
      columns: {
        player: "Spieler",
        age: "Alter",
        ability: "Fähigkeit",
        value: "Wert",
        wage: "Gehalt",
        contract: "Vertrag bis",
        advice: "Empfehlung",
        reasons: "Gründe",
      },
      actions: { sell: "Verkaufen", loan: "Verleihen", release: "Vertrag auflösen" },
      rank: (line, rank) => `${line} · ${rank}.`,
    },
    roles: {
      bgk: "Ballspielender Torwart",
      ngk: "Kompromissloser Torwart",
      sk: "Libero-Torwart",
      lhk: "Linientorwart",
      cb: "Innenverteidiger",
      bcb: "Spielaufbauender Innenverteidiger",
      ncb: "Kompromissloser Innenverteidiger",
      acb: "Aufrückender Innenverteidiger",
      ocb: "Hinterlaufender Halbraumverteidiger",
      scb: "Stoppender Innenverteidiger",
      ccb: "Absichernder Innenverteidiger",
      wcb: "Halbraumverteidiger",
      fb: "Außenverteidiger",
      ifb: "Inverser Außenverteidiger",
      pfb: "Pressender Außenverteidiger",
      hfb: "Abwartender Außenverteidiger",
      wb: "Flügelverteidiger",
      iwb: "Inverser Flügelverteidiger",
      pwb: "Spielmachender Flügelverteidiger",
      awb: "Vorgeschobener Flügelverteidiger",
      hwb: "Abwartender Flügelverteidiger",
      dm: "Defensiver Mittelfeldspieler",
      hb: "Abkippender Sechser",
      ddm: "Halbverteidiger",
      pdm: "Pressender Sechser",
      bbm: "Box-to-Box-Spieler",
      bbp: "Box-to-Box-Spielmacher",
      cm: "Zentraler Mittelfeldspieler",
      pcm: "Pressender Achter",
      scm: "Abschirmender Achter",
      chm: "Halbraumspieler",
      wcm: "Weiter Achter",
      ap: "Vorgeschobener Spielmacher",
      am: "Offensiver Mittelfeldspieler",
      oam: "Umschaltzehner",
      w: "Flügelspieler",
      if: "Inverser Außenstürmer",
      pw: "Äußerer Spielmacher",
      wfd: "Außenstürmer",
      tw: "Mitarbeitender Flügelspieler",
      iow: "Inverser Umschaltflügel",
      cfd: "Mittelstürmer",
      dlf: "Hängende Spitze",
      p: "Knipser",
      tcf: "Mitarbeitender Mittelstürmer",
      ocf: "Umschaltstürmer",
    },
    reasons: {
      listed: () => "Auf Transferliste",
      freeAgent: () => "Vertragslos",
      expiring: (value) => `Vertrag endet in ${value} ${value === "1" ? "Tag" : "Tagen"}`,
      releaseClause: (value) => `Ausstiegsklausel ${value}`,
      fringe: () => "Kein Stammspieler bei seinem Verein",
      keyPlayer: () => "Schlüsselspieler bei seinem Verein",
      unwanted: () => "Bei seinem Verein nicht benötigt",
      overBudget: (value) => `${value} über Ihrem Budget`,
      stretch: (value) => `Knapp über dem Budget (+${value})`,
      wageHigh: (value) => `Gehalt ${value} p/W über Ihrem Spielraum`,
      biggerClub: () => "Spielt bei einem größeren Verein",
      smallerClub: () => "Spielt bei einem kleineren Verein",
      reputationGap: () => "Ein zu großer Name für Ihren Verein",
      ambitious: () => "Ehrgeizig: würde den Schritt nach oben begrüßen",
      notForSale: () => "Steht nicht zum Verkauf",
    },
    departureReasons: {
      surplus: (value) => `Überbesetzter Mannschaftsteil (${value} Spieler)`,
      belowLevel: () => "Unter dem Niveau des Kaders",
      ageing: (value) => `In die Jahre gekommen (${value})`,
      expiring: (value) => `Vertrag endet in ${value} ${value === "1" ? "Tag" : "Tagen"}`,
      highWage: (value) => `Hohes Gehalt für seine Rolle (${value} p/W)`,
      unhappy: () => "Unzufrieden",
      lowMorale: () => "Schwache Moral",
      blocked: () => "Braucht Spiele, um sich zu entwickeln",
      unwanted: () => "Teamstatus: Nicht benötigt",
      listed: () => "Bereits auf der Transferliste",
    },
  },

  errors,
};
