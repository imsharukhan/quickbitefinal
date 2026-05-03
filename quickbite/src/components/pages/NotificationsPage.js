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

// SVG icons — no emoji, no text placeholders
const BellIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const ReadyIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const PayIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

const CookIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
    <line x1="6" y1="17" x2="18" y2="17"/>
  </svg>
);

const CancelIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6M9 9l6 6"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const CheckAllIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12 7 17 22 7"/><path d="M16 7 11 12"/>
  </svg>
);

function getNotifMeta(message = '') {
  const msg = message.toLowerCase();
  if (msg.includes('ready') || msg.includes('pickup'))
    return { Icon: ReadyIcon, bg: '#E8F5EC', color: '#2B8A3E', label: 'Ready' };
  if (msg.includes('confirmed') || msg.includes('payment') || msg.includes('paid'))
    return { Icon: PayIcon, bg: '#E8F0FE', color: '#2B7DE9', label: 'Paid' };
  if (msg.includes('prepar') || msg.includes('cooking') || msg.includes('making'))
    return { Icon: CookIcon, bg: '#FFF8E1', color: '#E8A317', label: 'Prep' };
  if (msg.includes('cancel'))
    return { Icon: CancelIcon, bg: '#FDECEA', color: '#D63031', label: 'Cancelled' };
  return { Icon: BellIcon, bg: '#FFF3E6', color: '#FC8019', label: 'Update' };
}

export default function NotificationsPage({ navigate }) {
  const { notifications, markNotificationRead, markAllNotificationsRead, isNotifsLoading, setNotifications } = useApp();
  const [markingAll, setMarkingAll] = useState(false);

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    // Optimistic
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await markAllNotificationsRead(); } catch (_) {}
    finally { setMarkingAll(false); }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isNotifsLoading && notifications.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px', borderColor: 'rgba(252,128,25,0.2)', borderTopColor: '#FC8019' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '0 16px 120px' }}>
      <style>{notifStyles}</style>

      {/* Header */}
      <div className="nf-header">
        <div>
          <h1 className="nf-title">Notifications</h1>
          <p className="nf-sub">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <button className="nf-mark-all-btn" onClick={handleMarkAllRead} disabled={markingAll}>
            <CheckAllIcon />
            {markingAll ? 'Saving...' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#FFF3E6', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <BellIcon size={28} color="#FC8019" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>All quiet here</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Order something and we'll keep you posted.
          </p>
        </div>
      ) : (
        <div className="nf-list">
          {notifications.map(notif => {
            const { Icon, bg, color } = getNotifMeta(notif.message);
            const isClickable = !!notif.related_order_id;
            return (
              <div
                key={notif.id}
                className={`nf-item ${!notif.is_read ? 'unread' : ''} ${isClickable ? 'clickable' : ''}`}
                onClick={() => {
                  if (!notif.is_read) markNotificationRead(notif.id);
                  if (isClickable && navigate) navigate('orders');
                }}
              >
                {/* Icon bubble */}
                <div className="nf-icon-bubble" style={{ background: bg }}>
                  <Icon size={17} color={color} />
                </div>

                {/* Body */}
                <div className="nf-body">
                  <p className="nf-msg">{notif.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span className="nf-time">{formatRelativeTime(notif.created_at)}</span>
                    {isClickable && (
                      <span className="nf-view-btn">
                        View order <ArrowIcon />
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {!notif.is_read && <div className="nf-unread-dot" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const notifStyles = `
.nf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0 18px;
  gap: 12px;
}
.nf-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
}
.nf-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
  font-weight: 500;
}
.nf-mark-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: white;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s;
  flex-shrink: 0;
}
.nf-mark-all-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.nf-mark-all-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  position: relative;
  transition: all 0.18s;
}
.nf-item.unread {
  background: #FFFAF5;
  border-color: rgba(252,128,25,0.25);
}
.nf-item.clickable {
  cursor: pointer;
}
.nf-item.clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.nf-icon-bubble {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nf-body {
  flex: 1;
  min-width: 0;
}
.nf-msg {
  font-size: 0.875rem;
  color: var(--text);
  line-height: 1.5;
  margin: 0;
  font-weight: 500;
}
.nf-time {
  font-size: 0.72rem;
  color: var(--text-muted);
}
.nf-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary);
}
.nf-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
  margin-top: 5px;
}
`;