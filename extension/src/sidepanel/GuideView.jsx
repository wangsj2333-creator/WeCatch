import React from 'react';

/**
 * GuideView — shown when no WeChat backend tab is detected.
 * Prompts the user to open mp.weixin.qq.com.
 */
export default function GuideView() {
  const openWeChat = () => {
    chrome.tabs.create({ url: 'https://mp.weixin.qq.com' });
  };

  return (
    <div className="guide-view">
      <span className="guide-icon">🌿</span>
      <h2 className="guide-title">请先打开微信公众号后台</h2>
      <p className="guide-desc">WeCatch 需要在微信公众号后台页面中运行</p>
      <button className="guide-btn" onClick={openWeChat}>
        打开微信后台
      </button>
    </div>
  );
}
