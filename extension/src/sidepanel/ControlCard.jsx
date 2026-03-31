import React, { useState } from 'react';
import ArticleSelector from './ArticleSelector';
import './control-card.css';

const INTERVALS = [
  { label: '2分钟', value: 2 },
  { label: '5分钟', value: 5 },
  { label: '10分钟', value: 10 },
];

const WX_URL_PATTERN = 'https://mp.weixin.qq.com/*';

/**
 * Fetch the article list from the WeChat tab's content script.
 * Returns { ok, articles } where articles is the full array (unfiltered).
 * @returns {Promise<{ ok: boolean, articles?: Array, error?: string }>}
 */
async function fetchArticlesFromContentScript() {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return { ok: false, error: 'chrome_unavailable' };
  }
  const tabs = await chrome.tabs.query({ url: WX_URL_PATTERN });
  if (tabs.length === 0) {
    return { ok: false, error: 'no_wx_tab' };
  }
  try {
    const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'FETCH_ARTICLES' });
    if (!response || !response.ok) {
      return { ok: false, error: response?.error || 'fetch_failed' };
    }
    return { ok: true, articles: response.data.articles || [] };
  } catch (e) {
    return { ok: false, error: 'content_script_not_injected' };
  }
}

/**
 * ControlCard — frosted glass card with interval selector and capture button.
 * Sprint 4: capture button fetches article list and shows ArticleSelector.
 *
 * @param {object}   props
 * @param {number}   props.interval             Currently selected interval in minutes
 * @param {Function} props.onChangeInterval     Called with new interval value when user selects a capsule
 * @param {boolean}  props.isCapturing          True when a capture is in progress (auto or manual)
 * @param {{ current: number, total: number } | null} props.progress   Capture progress or null
 * @param {Function} props.onTriggerNow         Called with articleIds[] to start a manual capture
 * @param {Function} props.onNoWxTab            Called when no WeChat tab is found during article fetch
 */
export default function ControlCard({
  interval,
  onChangeInterval,
  isCapturing,
  progress,
  onTriggerNow,
  onNoWxTab,
}) {
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [fetchingArticles, setFetchingArticles] = useState(false);
  const [articles, setArticles] = useState([]);

  const handleIntervalClick = async (value) => {
    if (value === interval || intervalLoading) return;
    setIntervalLoading(true);
    try {
      await onChangeInterval(value);
    } finally {
      setIntervalLoading(false);
    }
  };

  /**
   * Handle the "立即抓取" button click.
   * If selector is already open, close it. Otherwise fetch articles and open.
   */
  const handleCaptureClick = async () => {
    if (isCapturing) return; // button is disabled when capturing

    // Toggle off if already open
    if (showSelector) {
      setShowSelector(false);
      return;
    }

    setFetchingArticles(true);
    try {
      const result = await fetchArticlesFromContentScript();
      if (!result.ok) {
        if (result.error === 'no_wx_tab') {
          onNoWxTab && onNoWxTab();
        }
        return;
      }
      // Filter to only articles with comments before showing selector
      const eligible = (result.articles || []).filter((a) => a.comment_count > 0);
      setArticles(eligible);
      setShowSelector(true);
    } finally {
      setFetchingArticles(false);
    }
  };

  const handleConfirm = async (articleIds) => {
    setShowSelector(false);
    if (onTriggerNow) {
      await onTriggerNow(articleIds);
    }
  };

  const handleCancel = () => {
    setShowSelector(false);
  };

  // Collapse selector when a capture starts (e.g., triggered by alarm)
  const selectorVisible = showSelector && !isCapturing;

  const captureButtonLabel = fetchingArticles ? '加载中...' : '立即抓取';

  return (
    <div className="sp-card">
      {/* Interval selector row */}
      <div className="control-interval-row">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            className={`interval-capsule${interval === value ? ' interval-capsule--selected' : ''}`}
            onClick={() => handleIntervalClick(value)}
            disabled={intervalLoading}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Manual capture button */}
      <button
        className="btn-primary"
        disabled={isCapturing || fetchingArticles}
        onClick={handleCaptureClick}
      >
        {captureButtonLabel}
      </button>

      {/* Article selector panel */}
      {selectorVisible && (
        <ArticleSelector
          articles={articles}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Progress bar (shown when capturing) */}
      {isCapturing && progress && (
        <div className="progress-container">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: progress.total > 0
                  ? `${Math.round((progress.current / progress.total) * 100)}%`
                  : '0%',
              }}
            />
          </div>
          <p className="progress-text">
            抓取中 {progress.current} / {progress.total}
          </p>
        </div>
      )}
    </div>
  );
}
