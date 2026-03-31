import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL = 5;

/**
 * Sends a message to the service worker.
 * Returns null when the chrome API is unavailable (e.g. local dev).
 * @param {object} msg
 * @returns {Promise<object|null>}
 */
async function sendToSW(msg) {
  if (typeof chrome === 'undefined' || !chrome.runtime) return null;
  return chrome.runtime.sendMessage(msg);
}

/**
 * Formats an ISO 8601 timestamp as a relative time string in Chinese.
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '尚未抓取';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return '刚刚';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  return `${Math.floor(diffHour / 24)} 天前`;
}

/**
 * Formats a millisecond duration as mm:ss.
 * @param {number} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Custom hook that manages capture status and alarm countdown.
 * Exposes: lastRun, newCount, countdown, interval, refreshStatus, setInterval,
 *          isCapturing, progress, errorMsg, triggerNow
 */
export function useStatus() {
  const [lastRun, setLastRun] = useState(null);
  const [newCount, setNewCount] = useState(null);
  const [nextAlarmTime, setNextAlarmTime] = useState(null);
  const [countdown, setCountdown] = useState('--:--');
  const [interval, setIntervalValue] = useState(DEFAULT_INTERVAL);
  const [wxTabMissing, setWxTabMissing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total } | null
  const [errorMsg, setErrorMsg] = useState(null); // string | null
  const tickRef = useRef(null);
  const errorTimerRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    const status = await sendToSW({ type: 'GET_STATUS' });
    if (!status) return;
    setLastRun(status.lastRun ?? null);
    setNewCount(status.newCount ?? null);
    setNextAlarmTime(status.nextAlarmTime ?? null);

    // Read current interval from storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const { wecatch_interval } = await chrome.storage.local.get('wecatch_interval');
      if (wecatch_interval) setIntervalValue(wecatch_interval);
    }
  }, []);

  // Countdown tick: restarts whenever nextAlarmTime changes
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (!nextAlarmTime) {
      setCountdown('--:--');
      return;
    }

    const tick = () => {
      const remaining = nextAlarmTime - Date.now();
      setCountdown(remaining > 0 ? formatCountdown(remaining) : '00:00');
    };

    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [nextAlarmTime]);

  // Load on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  /**
   * Shows an error message and auto-clears it after 3 seconds.
   * @param {string} msg
   */
  const showError = useCallback((msg) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 3000);
  }, []);

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Listen for broadcast messages from service worker
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    const onMessage = (msg) => {
      if (msg.type === 'POLL_DONE') {
        setWxTabMissing(false);
        setIsCapturing(false);
        setProgress(null);
        refreshStatus();
      } else if (msg.type === 'NO_WX_TAB') {
        setWxTabMissing(true);
      } else if (msg.type === 'CAPTURE_ERROR') {
        setWxTabMissing(false);
        setIsCapturing(false);
        setProgress(null);
        console.warn('[WeCatch] capture error:', msg.error);
        if (msg.error === 'content_script_not_injected') {
          showError('请刷新微信后台页面后重试');
        } else {
          // backend_unreachable or any other error
          showError('后端服务不可达');
        }
      } else if (msg.type === 'PROGRESS') {
        setIsCapturing(true);
        setProgress({ current: msg.current, total: msg.total });
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [refreshStatus, showError]);

  /**
   * Changes the poll interval. Sends SET_INTERVAL to service worker and refreshes status.
   * @param {number} value
   */
  const changeInterval = useCallback(async (value) => {
    const resp = await sendToSW({ type: 'SET_INTERVAL', interval: value });
    if (resp && resp.ok) {
      setIntervalValue(value);
      // Refresh so nextAlarmTime (and countdown) updates immediately
      await refreshStatus();
    }
  }, [refreshStatus]);

  /**
   * Triggers a manual capture for the given article IDs.
   * Sends TRIGGER_NOW to the service worker and handles error responses.
   * @param {string[]} articleIds
   */
  const triggerNow = useCallback(async (articleIds) => {
    const resp = await sendToSW({ type: 'TRIGGER_NOW', articleIds });
    if (!resp) return;
    if (!resp.ok) {
      if (resp.error === 'capturing_in_progress') {
        showError('正在抓取中，请稍候');
      } else if (resp.error === 'no_wx_tab') {
        setWxTabMissing(true);
      } else {
        showError('抓取失败，请重试');
      }
    }
    // On success, progress state will be set via PROGRESS broadcast from SW
  }, [showError]);

  return {
    lastRun,
    newCount,
    countdown,
    interval,
    wxTabMissing,
    refreshStatus,
    changeInterval,
    isCapturing,
    progress,
    errorMsg,
    triggerNow,
  };
}
