import React, { useEffect, useState, useCallback } from 'react';
import GuideView from './GuideView';
import StatusCard from './StatusCard';
import ControlCard from './ControlCard';
import DashboardButton from './DashboardButton';
import { useStatus } from './useStatus';

const WX_URL_PATTERN = 'https://mp.weixin.qq.com/*';

/**
 * Checks whether any WeChat backend tab is currently open.
 * Returns false when the chrome API is unavailable (e.g. local dev environment).
 * @returns {Promise<boolean>}
 */
async function detectWxTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) return false;
  const tabs = await chrome.tabs.query({ url: WX_URL_PATTERN });
  return tabs.length > 0;
}

/**
 * SidePanel — main component.
 * Handles WeChat tab detection and switches between GuideView and main UI.
 * Owns shared status state and passes callbacks down to children.
 */
export default function SidePanel() {
  const [wxTabExists, setWxTabExists] = useState(null); // null = loading
  const { lastRun, newCount, countdown, interval, wxTabMissing, changeInterval } = useStatus();

  const refresh = useCallback(async () => {
    const exists = await detectWxTab();
    setWxTabExists(exists);
  }, []);

  useEffect(() => {
    refresh();

    // Re-check when any tab is updated (e.g., navigated to WeChat or away)
    const onUpdated = (_tabId, changeInfo) => {
      if (changeInfo.url !== undefined || changeInfo.status === 'complete') {
        refresh();
      }
    };

    // Re-check when a tab is removed
    const onRemoved = () => {
      refresh();
    };

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      }
    };
  }, [refresh]);

  // Loading state — blank while we detect tabs
  if (wxTabExists === null) {
    return <div className="sidepanel" />;
  }

  return (
    <div className="sidepanel">
      <div className="sp-header">
        <span className="sp-logo">🌿</span>
        <span className="sp-title">WeCatch</span>
      </div>

      {wxTabExists === false || wxTabMissing ? (
        <GuideView />
      ) : (
        <>
          <StatusCard lastRun={lastRun} newCount={newCount} countdown={countdown} />
          <ControlCard interval={interval} onChangeInterval={changeInterval} />
          <DashboardButton />
        </>
      )}
    </div>
  );
}
