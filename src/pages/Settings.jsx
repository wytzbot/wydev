import { useEffect, useRef, useState } from "react";
import { getLocalPreferences, loadState, saveState, syncPreferences, loadSyncedPreferences } from "../storage";
import { confirmDialog } from "../dialog";
import Select from "../components/Select";
import { enableNotifications, disableNotifications, getNotificationPermission, isNotificationsEnabled, refreshNotificationPermission, isMedianApp } from "../notifications";
import { isWyBuildApp, nativeDeviceInfo, nativeBatteryPercent, nativeIsOnline } from "../wybuildBridge";

export default function Settings() {
  const [font, setFont] = useState(loadState("fontSize", 16));
  const [wrap, setWrap] = useState(loadState("wordWrap", true));
  const [motion, setMotion] = useState(loadState("reducedMotion", false));
  const [density, setDensity] = useState(loadState("density", "comfortable"));
  const [syncing, setSyncing] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => isNotificationsEnabled());
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [deviceInfo] = useState(() => nativeDeviceInfo());
  const [battery, setBattery] = useState(() => nativeBatteryPercent());
  const [online, setOnline] = useState(() => nativeIsOnline());
  const syncTimer = useRef(null);

  useEffect(() => {
    if (!isWyBuildApp()) return;
    const refreshDiagnostics = () => { setBattery(nativeBatteryPercent()); setOnline(nativeIsOnline()); };
    const timer = setInterval(refreshDiagnostics, 30000);
    window.addEventListener("online", refreshDiagnostics);
    window.addEventListener("offline", refreshDiagnostics);
    return () => { clearInterval(timer); window.removeEventListener("online", refreshDiagnostics); window.removeEventListener("offline", refreshDiagnostics); };
  }, []);

  const apply = (prefs) => {
    if (prefs.fontSize !== undefined) { setFont(prefs.fontSize); document.documentElement.style.setProperty("--ui-font", prefs.fontSize + "px"); }
    if (prefs.wordWrap !== undefined) setWrap(prefs.wordWrap);
    if (prefs.reducedMotion !== undefined) setMotion(prefs.reducedMotion);
    if (prefs.density !== undefined) setDensity(prefs.density);
  };

  useEffect(() => {
    let alive = true;
    loadSyncedPreferences().then((remote) => { if (alive && Object.keys(remote).length) apply(remote); }).catch(() => {});
    return () => { alive = false; if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, []);

  // In a Median.co-wrapped build, permission is checked over the native
  // bridge asynchronously — the initial useState value above is just the
  // last cached result, so refresh it once the bridge has had a chance to
  // load. A no-op (resolves immediately to the same value) everywhere else.
  useEffect(() => {
    let alive = true;
    refreshNotificationPermission().then((p) => { if (alive) setNotificationPermission(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const queueSync = () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncing(true); setSyncError("");
      try { await syncPreferences(getLocalPreferences()); }
      catch (e) { setSyncError("Saved on this device. Cloud sync will retry next time you change a setting."); }
      finally { setSyncing(false); }
    }, 350);
  };

  const update = (k, v) => {
    saveState(k, v);
    apply({[k]:v});
    queueSync();
  };

  const clearWorkingData = async () => {
    const ok = await confirmDialog({
      title: "Clear local working data",
      message: "Delete WyteLab local working states? Unsaved changes will be lost.",
      confirmLabel: "Clear data",
      danger: true,
    });
    if (!ok) return;
    Object.keys(localStorage).filter((k) => k.startsWith("wydev:project:")).forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  return (
    <div className="page">
      <header><div><span className="eyebrow">PREFERENCES</span><h1>Settings</h1></div></header>
      <section className="panel">
        <h3>ACCESSIBILITY</h3>
        <label>Interface font size<Select value={font} onChange={(v) => update("fontSize", +v)} options={[{value:14,label:"Small"},{value:16,label:"Medium"},{value:18,label:"Large"},{value:20,label:"Extra Large"}]} /></label>
        <label>Density<Select value={density} onChange={(v) => update("density", v)} options={[{value:"compact",label:"Compact"},{value:"comfortable",label:"Comfortable"}]} /></label>
        <label>Word wrap<input type="checkbox" checked={wrap} onChange={(e) => update("wordWrap", e.target.checked)} /></label>
        <label>Reduced motion<input type="checkbox" checked={motion} onChange={(e) => update("reducedMotion", e.target.checked)} /></label>
        <p className="muted">{syncing ? "Syncing preferences…" : syncError || "Preferences sync to your WyteLab account."}</p>
      </section>
      <section className="panel">
        <h3>NOTIFICATIONS</h3>
        <p className="muted">Receive failed-build alerts, a gentle Good Morning message, free-plan limit reminders, and Pro renewal reminders.</p>
        <button
          disabled={notificationBusy || notificationsEnabled}
          onClick={async () => {
            setNotificationBusy(true); setSyncError("");
            try {
              await enableNotifications();
            } catch (e) {
              setSyncError(e.message || "Notifications could not be enabled.");
            } finally {
              setNotificationPermission(getNotificationPermission());
              setNotificationsEnabled(isNotificationsEnabled());
              setNotificationBusy(false);
            }
          }}
        >
          {notificationsEnabled ? "Notifications enabled" : "Enable notifications"}
        </button>
        {notificationsEnabled && (
          <button
            disabled={notificationBusy}
            onClick={async () => {
              setNotificationBusy(true); setSyncError("");
              try {
                await disableNotifications();
              } catch (e) {
                setSyncError(e.message || "Notifications could not be disabled.");
              } finally {
                setNotificationPermission(getNotificationPermission());
                setNotificationsEnabled(isNotificationsEnabled());
                setNotificationBusy(false);
              }
            }}
          >
            Disable notifications
          </button>
        )}
        {notificationPermission === "denied" && (
          <p className="muted">
            {isMedianApp()
              ? "Notifications are blocked. Allow them for this app in your device's Settings."
              : "Notifications are blocked by the browser. Allow them in your browser site settings."}
          </p>
        )}
      </section>
      <section className="panel">
        <h3>LOCAL DATA</h3>
        <button onClick={() => { localStorage.removeItem("wydev:recentProjects"); location.reload(); }}>Clear recent projects</button>
        <button onClick={clearWorkingData}>Clear local working data</button>
      </section>
      {isWyBuildApp() && (
        <section className="panel">
          <h3>APP INFO</h3>
          {deviceInfo && <p className="muted">{deviceInfo.manufacturer} {deviceInfo.model} · Android {deviceInfo.version} (SDK {deviceInfo.sdk})</p>}
          <p className="muted">
            {battery != null && `Battery: ${battery}% · `}
            {online ? "Online" : "Offline"}
          </p>
        </section>
      )}
    </div>
  );
}
