import React from 'react';

/**
 * DashboardButton — ghost button that opens the dashboard tab.
 * If a dashboard tab already exists, activates and reloads it.
 * If not, creates a new tab.
 */
export default function DashboardButton() {
  const openDashboard = async () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
    const tabs = await chrome.tabs.query({ url: dashboardUrl });

    if (tabs.length > 0) {
      const tab = tabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.tabs.reload(tab.id);
    } else {
      await chrome.tabs.create({ url: dashboardUrl });
    }
  };

  return (
    <button className="btn-ghost" onClick={openDashboard}>
      打开数据看板
    </button>
  );
}
