'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 2592000) return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  return date.toLocaleDateString();
}

export default function NotificationsPage({ navigate }) {
  const { notifications, markNotificationRead, markAllNotificationsRead, isNotifsLoading, setNotifications } = useApp();
  const [markingAll, setMarkingAll] = useState(false);

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await markAllNotificationsRead(); } catch (_) {}
    finally { setMarkingAll(false); }
  };

  const handleClearAll = async () => {
    await handleMarkAllRead();
  };

  if (isNotifsLoading && notifications.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 16px 120px' }}>
      <style>{notifStyles}</style>

      <div className="nf-header">
        <div className="nf-header-left">
          <h1 className="nf-title">Notifications</h1>
          <p className="nf-sub">Stay updated on your orders</p>
        </div>
        {notifications.length > 0 && (
          <div className="nf-actions">
            <button className="nf-btn-text" onClick={handleMarkAllRead} disabled={markingAll}>
              {markingAll ? 'Saving...' : 'Mark all read'}
            </button>
            <button className="nf-btn-clear" onClick={handleClearAll} disabled={markingAll}>Clear all</button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">Bell</div>
          <h3>All caught up!</h3>
          <p>You have no new notifications.</p>
        </div>
      ) : (
        <div className="nf-list">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`nf-item ${!notif.is_read ? 'unread' : ''}`}
              onClick={() => {
                if (!notif.is_read) markNotificationRead(notif.id);
                if (notif.related_order_id && navigate) navigate('orders');
              }}
              style={{ cursor: notif.related_order_id ? 'pointer' : 'default' }}
            >
              <div className="nf-icon">
                {notif.message.toLowerCase().includes('ready')
                  ? 'Meal'
                  : notif.message.toLowerCase().includes('confirmed')
                    ? 'Paid'
                    : 'Bell'}
              </div>
              <div className="nf-body">
                <p className="nf-msg">
                  {notif.message}
                  {notif.related_order_id && (
                    <span className="nf-view"> - View Order</span>
                  )}
                </p>
                <span className="nf-time">{formatRelativeTime(notif.created_at)}</span>
              </div>
              {!notif.is_read && <div className="nf-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const notifStyles = `
.nf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0 20px;
}
.nf-header-left {
  min-width: 0;
  flex: 1;
}
.nf-title {
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nf-sub {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nf-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}
.nf-btn-text {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}
.nf-btn-text:disabled,
.nf-btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nf-btn-clear {
  background: var(--red-bg, #fff0f0);
  border: 1px solid var(--red, #e53935);
  color: var(--red, #e53935);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}
.nf-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nf-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--bg-white);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  transition: background 0.15s;
  position: relative;
}
.nf-item.unread {
  background: var(--primary-bg, #fff8f0);
  border-color: var(--primary-light, #fcd49a);
}
.nf-icon {
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--primary);
  flex-shrink: 0;
  margin-top: 3px;
}
.nf-body {
  flex: 1;
  min-width: 0;
}
.nf-msg {
  font-size: 0.87rem;
  color: var(--text);
  line-height: 1.5;
  margin: 0 0 4px;
  word-break: break-word;
}
.nf-view {
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
}
.nf-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}
.nf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
  margin-top: 5px;
}
`;
