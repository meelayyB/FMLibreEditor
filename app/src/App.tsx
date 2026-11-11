import { useCallback, useEffect, useMemo, useState } from "react";
import { call, inTauri } from "./api";
import { BridgeSetup } from "./BridgeSetup";
import { ChangesView, useChangeLog } from "./ChangesView";
import { ClubBrowser } from "./ClubBrowser";
import { CompatibilityNotice } from "./CompatibilityNotice";
import { CopyDiagnostics } from "./CopyDiagnostics";
import { forgetFieldTables } from "./fieldTables";
import { describeError, describeGame, formatDate } from "./format";
import { FrozenNotice } from "./FrozenNotice";
import { GraphicsStatus } from "./GraphicsStatus";
import { SettingsMenu } from "./SettingsMenu";
import { appText, changesText, clubListText, playerListText, scoutingText, staffListText } from "./labels";
import { PlayerBrowser } from "./PlayerBrowser";
import { restored, useSnapshot } from "./restore";
import { SaveChangedNotice, useSaveChanged } from "./SaveChangedNotice";
import { ScoutingBrowser } from "./ScoutingBrowser";
import { StaffBrowser } from "./StaffBrowser";
import type { BridgeInfo, ConnectionInfo, Detection, Refrozen, ReloadInfo } from "./types";
import { useUpdateCheck } from "./update";
import { UpdateCheck, UpdateNotice } from "./UpdateNotice";
import { ComparisonContext, useComparison } from "./useComparison";
import { askToLeave, EditorContext } from "./useProfileEditing";
import "./App.css";

type View = "players" | "staff" | "clubs" | "scouting" | "changes";

const VIEWS: { id: View; label: string }[] = [
  { id: "players", label: playerListText.nav },
  { id: "staff", label: staffListText.nav },
  { id: "clubs", label: clubListText.nav },
  { id: "scouting", label: scoutingText.nav },
  { id: "changes", label: changesText.nav },
];

/** The view the window was in before the language was switched; the first one when there was no such switch. */
const readView = (value: unknown): View => VIEWS.find(({ id }) => id === value)?.id ?? "players";

/** The app's mark, as on its icon: FML over FM's four bands. */
function BrandMark() {
  return (
    <span className="brand" title="FMLibreEditor">
      <span className="brand-word" aria-hidden="true">
        FML
      </span>
      <span className="brand-bands" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">FMLibreEditor</span>
    </span>
  );
}

function App() {
  const [detection, setDetection] = useState<Detection | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  // False until the app has asked whether it is connected already (see the effect below): the connect panel would
  // flash up for a moment after the window was reloaded to change the language.
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  // What connecting froze again of what was frozen in the save before, until the notice that says so is dismissed.
  const [refrozen, setRefrozen] = useState<Refrozen | null>(null);
  const [view, setView] = useState<View>(() => restored("view", readView));
  useSnapshot("view", () => view);
  // The players picked for a comparison: in the player list's profiles and in those opened from a club's squad.
  const comparison = useComparison();
  const { log, error: logError, reload: reloadLog, clear: clearLog } = useChangeLog();
  const update = useUpdateCheck();
  // Whether Check for updates was pressed: only then does the foot of the window say what was found.
  const [askedUpdate, setAskedUpdate] = useState(false);
  // Whether the game has loaded a save, or gone back to its main menu, since the data was read.
  const saveChanged = useSaveChanged(connection !== null, dataVersion);

  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const detect = useCallback(
    () => run(appText.detecting, async () => setDetection(await call<Detection>("detect_game"))),
    [run],
  );

  const connect = () =>
    run(appText.connecting, async () => {
      const { refrozen: again, ...connected } = await call<ConnectionInfo>("connect");
      // A new connection has an empty change log, and its field tables may differ. Its lists start afresh, with no one
      // picked for a comparison.
      forgetFieldTables();
      clearLog();
      comparison.clear();
      setConnection(connected);
      setRefrozen(again ?? null);
      setDataVersion((v) => v + 1);
    });

  const reload = () =>
    run(appText.reloading, async () => {
      try {
        const { refrozen: again, ...reloaded } = await call<ReloadInfo>("reload");
        setConnection((c) => c && { ...c, ...reloaded });
        if (again) {
          setRefrozen(again);
        }
        setDataVersion((v) => v + 1);
      } catch (e) {
        // The Rust side drops the connection when reading fails (e.g. the game was closed).
        setConnection(null);
        void detect();
        throw e;
      }
    });

  // At startup: the Rust side keeps its connection, lists and change log when the window is reloaded (that is how a
  // change of language keeps the connection), so the app first asks for the connection it may have already. With
  // one, it shows the connected app right away, without reading the game again; without one, it looks for the game.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      let current: ConnectionInfo | null = null;
      try {
        current = await call<ConnectionInfo | null>("current_connection");
      } catch {
        // Not knowing is no reason to stop: looking for the game says what is wrong, if anything is.
      }
      if (cancelled) {
        return;
      }
      if (current) {
        setConnection(current);
        setDataVersion((v) => v + 1);
        void reloadLog();
      } else {
        void detect();
      }
      setChecked(true);
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [detect, reloadLog]);

  // Changes were written or undone: the lists and the open profile read the game again, and so does the log.
  // The lists keep their search, filters, sort and selection when they do.
  const edited = useCallback(() => {
    setDataVersion((v) => v + 1);
    void reloadLog();
  }, [reloadLog]);

  // A version of the game the editor has no profile for is read-only until editing it is allowed.
  const allowEditing = async () => {
    setError(null);
    try {
      setConnection(await call<ConnectionInfo>("allow_editing"));
    } catch (e) {
      setError(describeError(e));
    }
  };

  const editable = connection?.editable ?? false;
  // The note on applying edits, the colophon's first: whole in its hover too, should a window ever be too narrow for it.
  // While nothing can be edited, it is also the hover of what that turns off.
  const note = !connection
    ? appText.noteNotConnected
    : editable
      ? appText.noteEditable
      : connection.writable
        ? appText.noteUnknownBuild
        : appText.noteReadOnly;
  const editor = useMemo(() => ({ editable, readOnlyNote: note, onEdited: edited }), [editable, note, edited]);

  // With edits pending in the open profile, leaving for another view asks first.
  const show = (id: View) => {
    if (id !== view) {
      askToLeave(() => setView(id));
    }
  };

  return (
    <div className="app">
      <header className="masthead">
        <BrandMark />
        <nav className="tabs">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={id === view ? "tab active" : "tab"}
              aria-current={id === view ? "page" : undefined}
              onClick={() => show(id)}
            >
              {label}
              {id === "changes" && log.length > 0 && <small>{log.length}</small>}
            </button>
          ))}
        </nav>
        <div className="masthead-side">
          {busy && <span className="busy">{busy}</span>}
          {connection &&
            (connection.gameDate ? (
              <span className="game-date">{formatDate(connection.gameDate)}</span>
            ) : (
              <span className="game-date missing" title={appText.noDateTitle}>
                {appText.noDate}
              </span>
            ))}
          {connection ? (
            <button onClick={reload} disabled={busy !== null}>
              {appText.reload}
            </button>
          ) : (
            <button onClick={detect} disabled={busy !== null}>
              {appText.refresh}
            </button>
          )}
          <SettingsMenu busy={busy !== null} />
        </div>
      </header>

      <div className="main">
        {update.notice && (
          <UpdateNotice
            release={update.notice}
            current={update.current}
            selfUpdate={update.selfUpdate}
            onLater={update.later}
          />
        )}
        {connection && (
          <CompatibilityNotice
            connection={connection}
            busy={busy !== null}
            onAllow={allowEditing}
            onCheckUpdates={() => {
              setAskedUpdate(true);
              update.check();
            }}
          />
        )}
        {connection && saveChanged && <SaveChangedNotice busy={busy !== null} onReload={reload} />}
        {connection && refrozen && <FrozenNotice refrozen={refrozen} onDismiss={() => setRefrozen(null)} />}
        {error && <div className="banner">{error}</div>}

        {connection ? (
          // All the lists stay mounted, so each keeps its search and selection while another is shown.
          <EditorContext.Provider value={editor}>
            <ComparisonContext.Provider value={comparison}>
              <div className="views">
                <PlayerBrowser
                  version={dataVersion}
                  active={view === "players"}
                  genderKnown={connection.genderKnown}
                  comparison={comparison}
                />
                <StaffBrowser version={dataVersion} active={view === "staff"} genderKnown={connection.genderKnown} />
                <ClubBrowser version={dataVersion} active={view === "clubs"} />
                <ScoutingBrowser version={dataVersion} active={view === "scouting"} />
                {view === "changes" && <ChangesView log={log} error={logError} reload={reloadLog} onUndone={edited} />}
              </div>
            </ComparisonContext.Provider>
          </EditorContext.Provider>
        ) : (
          checked && (
            <ConnectPanel
              detection={detection}
              busy={busy !== null}
              onConnect={connect}
              onBridge={(bridge) => setDetection((d) => d && { ...d, bridge })}
            />
          )
        )}
      </div>

      <footer className="colophon">
        <div className="colophon-main">
          <span className="colophon-name">
            FMLibreEditor{update.current && ` ${update.current}`} · {appText.stage}
          </span>
          {update.current && (
            <UpdateCheck
              state={update.state}
              asked={askedUpdate}
              onCheck={() => {
                setAskedUpdate(true);
                update.check();
              }}
            />
          )}
          {connection && <CopyDiagnostics className="update-link" />}
          <span className={`status ${connection ? "on" : ""}`}>
            <span className="dot" />
            <span className="status-text">
              {connection
                ? [
                    describeGame(connection.game),
                    playerListText.count(connection.players),
                    staffListText.count(connection.staff),
                    clubListText.count(connection.clubs),
                  ].join(" · ")
                : appText.notConnected}
            </span>
          </span>
          {!inTauri && <span className="tag">{appText.previewTag}</span>}
        </div>
        <div className="colophon-notes">
          <p className="sidebar-note" title={note}>
            {note}
          </p>
          <GraphicsStatus />
        </div>
      </footer>
    </div>
  );
}

function ConnectPanel(props: {
  detection: Detection | null;
  busy: boolean;
  onConnect: () => void;
  onBridge: (bridge: BridgeInfo) => void;
}) {
  const { detection, busy, onConnect, onBridge } = props;
  const game = detection?.games[0];
  // macOS: the bridge comes first while it is not set up, as nothing connects without it.
  const bridge = detection?.bridge;
  const bridgeSetup = bridge && <BridgeSetup bridge={bridge} busy={busy} onChange={onBridge} />;
  const ready = Boolean(game?.info && game.pluginLoaded);
  const text = appText.connect;

  return (
    <section className="connect">
      <div className="card">
        <h2>{text.title}</h2>
        <p className="muted">{text.intro}</p>
        {bridge && !bridge.ready && bridgeSetup}

        {detection && detection.games.length === 0 && <p className="hint">{text.notRunning}</p>}
        {game && !game.info && <p className="hint error">{text.openFailed(describeError(game.error))}</p>}
        {game?.info && (
          <dl className="facts">
            <dt>{text.game}</dt>
            <dd>{describeGame(game.info)}</dd>
            <dt>{text.gameData}</dt>
            <dd>{game.pluginLoaded ? text.loaded : text.stillLoading}</dd>
            <dt>{text.process}</dt>
            <dd>{text.pid(game.info.pid)}</dd>
          </dl>
        )}
        {detection && detection.games.length > 1 && <p className="hint">{text.several}</p>}

        <button className="primary" onClick={onConnect} disabled={busy || !ready}>
          {text.button}
        </button>
        {bridge?.ready && bridgeSetup}
      </div>
    </section>
  );
}

export default App;
