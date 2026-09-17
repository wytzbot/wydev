import { useEffect, useRef, useState } from "react";
import Menu from "./components/Menu";
import TopBar from "./components/TopBar";
import TabBar from "./components/TabBar";
import DialogHost from "./components/DialogHost";
import ToastHost from "./components/ToastHost";
import { toastSuccess, toastError, toastInfo } from "./toast";
import { openExternal } from "./utils";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Repositories from "./pages/Repositories";
import Changes from "./pages/Changes";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Project from "./pages/Project";
import SearchPage from "./pages/Search";
import LegalPage from "./pages/Legal";
import Offline from "./pages/Offline";
import Actions from "./pages/Actions";
import Logs from "./pages/Logs";
import { github } from "./github";
import { loadState, saveState } from "./storage";
import { initNotifications } from "./notifications";
import { installShareIntoAppHandler, consumeSharedPayload, nativeHaptic } from "./mobileBridge";
import { shareWyteLab } from "./utils";

export default function App() {
  const initialBillingReturn = new URLSearchParams(window.location.search).get("billing") === "return";
  const [user, setUser] = useState(null),
    [offline, setOffline] = useState(() => !navigator.onLine),
    [page, setPage] = useState(() => initialBillingReturn ? "billing" : (window.history.state?.wydevPage || (window.location.hash.replace("#","") || "home"))),
    [repos, setRepos] = useState([]),
    [repoLimit, setRepoLimit] = useState(null),
    [reposLoading, setReposLoading] = useState(false),
    [repo, setRepo] = useState(null),
    [working, setWorking] = useState(null),
    [searchQuery, setSearchQuery] = useState(""),
    [openPath, setOpenPath] = useState(""),
    [loading, setLoading] = useState(true);
  const reposRequestRef = useRef(null);
  const reposUserRef = useRef(null);
  // Always holds the most recently rendered loadRepos, so listeners that are
  // only re-attached when `user` changes (below) never call back into a
  // stale closure that still thinks `repos`/`user` look like they did the
  // moment the listener was installed.
  const loadReposRef = useRef(null);

  const loadRepos = async ({ silent = false } = {}) => {
    if (!user?.id) return [];
    // One request per signed-in account. This prevents an old request from a
    // previous account/session from ever replacing the current user's list.
    if (reposRequestRef.current && reposUserRef.current === String(user.id)) return reposRequestRef.current;

    const cacheKey = `reposCache:${String(user.id)}`;
    const cached = loadState(cacheKey, { repos: [], repoLimit: null });
    const cachedRepos = Array.isArray(cached?.repos) ? cached.repos : [];
    if (cachedRepos.length && !repos.length) {
      setRepos(cachedRepos);
      setRepoLimit(cached?.repoLimit || null);
    }

    if (!navigator.onLine) {
      setRepos(cachedRepos);
      setRepoLimit(cached?.repoLimit || null);
      setReposLoading(false);
      return cachedRepos;
    }

    setReposLoading(true);
    const accountId = String(user.id);
    const request = (async () => {
      let last = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const d = await github.repos();
          // A successful response containing zero repositories is only allowed
          // to replace an empty cache. If we already know repositories, keep
          // them when the server marks the response as a protected snapshot.
          const nextRepos = Array.isArray(d.repos) ? d.repos : [];
          const nextLimit = { total: d.total, limit: d.limit, plan: d.plan };
          if (!nextRepos.length && cachedRepos.length && !d.stale) {
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
              continue;
            }
            setRepos(cachedRepos);
            setRepoLimit(nextLimit);
            if (!silent) toastInfo("GitHub returned no repositories. Your last known repositories are still available.");
            return cachedRepos;
          }
          setRepos(nextRepos);
          setRepoLimit(nextLimit);
          saveState(cacheKey, { repos: nextRepos, repoLimit: nextLimit, savedAt: d.savedAt || Date.now(), stale: !!d.stale });
          return nextRepos;
        } catch (e) {
          last = e;
          if (Number(e?.status) === 401) {
            // Do not turn an expired/revoked GitHub session into a fake empty
            // repository list. Keep the known snapshot visible and tell the user.
            if (cachedRepos.length) {
              setRepos(cachedRepos);
              setRepoLimit(cached?.repoLimit || null);
            }
            break;
          }
          if (attempt < 2) await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
        }
      }
      if (cachedRepos.length) {
        setRepos(cachedRepos);
        setRepoLimit(cached?.repoLimit || null);
      }
      if (!silent) toastError(last?.message || "Could not refresh repositories. Your saved repository list is still available.");
      return cachedRepos;
    })();

    reposRequestRef.current = request;
    reposUserRef.current = accountId;
    try { return await request; }
    finally {
      if (reposUserRef.current === accountId) {
        reposRequestRef.current = null;
        reposUserRef.current = null;
      }
      setReposLoading(false);
    }
  };

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  loadReposRef.current = loadRepos;

  // The Android APK shell is a bare WebView. After it's been backgrounded
  // for a while, Chromium's compositor frequently stops repainting the
  // page — the DOM/React state underneath is already correct (the effect
  // below re-fetches repos on foreground just fine), but the last frame
  // that was drawn stays on screen until *something* forces a new one.
  // A tap anywhere does this as an unrelated side effect of handling the
  // touch event, which is exactly why "click any bottom tab icon" makes
  // the list "reappear" even when that icon has nothing to do with
  // repositories. Force that redraw ourselves on foreground instead of
  // waiting on an incidental tap.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const forceRepaint = () => {
      root.style.transform = "translateZ(0)";
      requestAnimationFrame(() => requestAnimationFrame(() => { root.style.transform = ""; }));
    };
    const onVisible = () => { if (document.visibilityState === "visible") forceRepaint(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // The initial repos fetch on mount can lose a race with the session cookie
  // still being written right after a hard refresh (or simply hit a network
  // blip on cold start) and fail silently, leaving the Repositories/Home
  // lists empty with nothing to prompt a retry. Re-run it whenever the app
  // is brought back to the foreground or regains connectivity — covers both
  // a fresh reload and returning to an already-open tab/PWA — so the list
  // fills in on its own instead of only refreshing when some other click
  // happens to trigger a re-render.
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState === "visible") loadReposRef.current?.({ silent: true }); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("online", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(timer);
    };
  }, [user]);

  // Keep app navigation inside browser history so Android/iOS back returns to the
  // previous WyteLab screen instead of closing the PWA/web app.
  useEffect(() => {
    if (!window.history.state?.wydevPage) {
      window.history.replaceState({ wydevPage: initialBillingReturn ? "billing" : page }, "", window.location.href);
    }
    const onPopState = (event) => {
      const next = event.state?.wydevPage;
      if (next) setPage(next);
      else {
        // Never let the browser back action leave WyteLab from its root screen.
        window.history.pushState({ wydevPage: "home" }, "", window.location.href);
        setPage("home");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (next) => {
    if (!next || next === page) return;
    window.history.pushState({ wydevPage: next }, "", `#${next}`);
    setPage(next);
    closeMenu();
  };
  const goBack = () => {
    if (page === "home") return;
    window.history.back();
  };

  useEffect(() => {
    const handleShared = (payload) => {
      if (!payload?.url) return;
      setSearchQuery(payload.url);
      navigate("search");
      nativeHaptic("notificationSuccess");
      toastInfo("Link received from the Android share menu. Search is ready.");
    };
    const cleanup = installShareIntoAppHandler(handleShared);
    const initial = consumeSharedPayload();
    if (initial) handleShared(initial);
    return cleanup;
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-font", loadState("fontSize", 16) + "px");
    github
      .session()
      .then((x) => {
        if (x?.user) {
          setUser(x.user);
          const cached = loadState(`reposCache:${String(x.user.id)}`, null);
          if (cached?.repos?.length) { setRepos(cached.repos); setRepoLimit(cached.repoLimit || null); }
          loadRepos({ silent: true });
          initNotifications(x.user).catch(() => {});
        }
      })
      .catch((e) => toastError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (repo) {
      const saved = loadState(`project:${repo.id}`, null);
      if (saved) setWorking({ repo, branch: saved.branch, files: saved.files || {}, base: saved.base || {}, changes: [] });
    }
  }, [repo]);

  if (offline) return <Offline />;
  if (loading) return <div className="loading">Loading WyteLab…</div>;
  if (!user) return <Login />;

  const open = (r) => {
    if (r) {
      setRepo(r);
      navigate("project");
      saveState("recentProjects", [{ id: r.id, full_name: r.full_name, repo: r }, ...loadState("recentProjects", []).filter((x) => x.id !== r.id)].slice(0, 10));
    } else navigate("repos");
  };
  const createRepo = async (payload) => {
    const r = await github.createRepo(payload);
    setRepos((rs) => {
      const next=[r,...rs.filter(x=>x.id!==r.id)];
      saveState(`reposCache:${String(user.id)}`, { repos: next, repoLimit, savedAt: Date.now() });
      if(next.length>=8 && next.length<=10) toastInfo(`Free plan: ${next.length}/10 repositories used.`);
      return next;
    });
    toastSuccess(`Repository ${r.full_name || r.name || payload.name} created successfully`);
    return r;
  };
  const workingChanges = working?.changes || [];
  const openFile = (path) => {
    if (repo) {
      setOpenPath(path);
      navigate("project");
      setWorking((w) => (w ? { ...w, selected: path } : w));
    }
  };
  const openMenu = () => document.body.classList.add("menu-open");
  const closeMenu = () => document.body.classList.remove("menu-open");

  return (
    <div className="app">
      <TopBar user={user} onMenu={openMenu} onSearch={() => navigate("search")} onShare={async () => { const ok = await shareWyteLab("Manage GitHub repositories, files and Actions from your phone with WyteLab."); if (ok) nativeHaptic("notificationSuccess"); }} onAvatar={() => navigate("settings")} />
      <Menu page={page} setPage={navigate} onSearch={(q) => setSearchQuery(q)} onLogout={async () => { await github.logout(); location.reload(); }} />
      <div className="menuScrim" onClick={closeMenu} />
      <section className="content">
        {page !== "home" && page !== "project" && (
          <button className="pageBack" type="button" onClick={goBack} aria-label="Go back">
            <span aria-hidden="true">‹</span> Back
          </button>
        )}
        {page === "home" && <Home repos={repos} loading={reposLoading} onOpen={open} onCreate={createRepo} />}
        {page === "repos" && <Repositories repos={repos} repoLimit={repoLimit} loading={reposLoading} onOpen={open} onCreate={createRepo} onRefresh={loadRepos} />}
        {page === "changes" && <Changes changes={workingChanges} onSelect={openFile} onDiscard={working?.discard} />}
        {page === "actions" && <Actions repos={repos} />}
        {page === "logs" && <Logs />}
        {page === "settings" && <Settings />}
        {page === "billing" && <Billing />}
        {page === "project" && repo && <Project
          repo={repo}
          openPath={openPath}
          onBack={() => navigate("repos")}
          onWorkingState={setWorking}
          onDeleteRepo={(deleted) => {
            setRepos((rs) => {
              const next = rs.filter((r) => String(r.id) !== String(deleted.id));
              saveState(`reposCache:${String(user.id)}`, { repos: next, repoLimit, savedAt: Date.now() });
              return next;
            });
            setRepo((current) => (current && String(current.id) === String(deleted.id) ? null : current));
            setWorking(null);
          }}
        />}
        {page === "search" && <SearchPage repos={repos} onOpen={open} onNavigate={navigate} query={searchQuery} repoFiles={working?.files || {}} onOpenFile={openFile} />}
        {page === "recent" && <Recent onOpen={open} />}
        {page === "help" && <Help />}
        {page === "privacy" && <LegalPage type="privacy" />}
        {page === "terms" && <LegalPage type="terms" />}
        {page === "about" && <LegalPage type="about" />}
        {page === "contact" && <LegalPage type="contact" />}
        {page === "vercel" && <div className="page"><header><div><span className="eyebrow">DEPLOYMENT</span><h1>Vercel</h1></div></header><section className="panel"><p className="muted">Open Vercel to import or deploy a GitHub repository.</p><button className="primary" onClick={() => openExternal("https://vercel.com")}>Open Vercel</button></section></div>}
      </section>
      <TabBar page={page} setPage={navigate} onMore={openMenu} />
      <DialogHost />
      <ToastHost />
    </div>
  );
}

function Recent({ onOpen }) {
  const items = loadState("recentProjects", []);
  return (
    <div className="page">
      <header>
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Recent Projects</h1>
        </div>
      </header>
      <section className="panel">
        {items.length ? (
          items.map((x) => (
            <button className="repoRow" key={x.id} onClick={() => onOpen(x.repo || x)}>
              <span>
                <b>{x.full_name}</b>
                <small>Recently opened</small>
              </span>
              <span>›</span>
            </button>
          ))
        ) : (
          <p className="muted">No recently opened repositories yet.</p>
        )}
      </section>
    </div>
  );
}

function Help() {
  return (
    <div className="page">
      <header>
        <div>
          <span className="eyebrow">SUPPORT</span>
          <h1>Help</h1>
        </div>
      </header>
      <section className="panel">
        <h3>GETTING STARTED</h3>
        <p>Sign in with GitHub, open a repository, edit files locally, review Changes, then Commit & Push.</p>
        <p className="muted">GitHub remains the source of truth. WyteLab never deploys or hosts your repository.</p>
        <h3>WHEN A PUSH FAILS</h3>
        <p>Pull the latest GitHub state and review the changes before retrying. WyteLab refuses to overwrite a newer remote branch.</p>
        <a href="https://github.com" onClick={(e) => { e.preventDefault(); openExternal("https://github.com"); }} rel="noreferrer">Open GitHub</a>
      </section>
    </div>
  );
}
