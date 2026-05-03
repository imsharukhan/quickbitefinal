'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import * as notificationService from '@/services/notificationService';

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
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

function getNotifMeta(message = '') {
  const msg = message.toLowerCase();
  if (msg.includes('ready') || msg.includes('pickup'))
    return { Icon: ReadyIcon, bg: '#E8F5EC', color: '#2B8A3E' };
  if (msg.includes('confirmed') || msg.includes('payment') || msg.includes('paid'))
    return { Icon: PayIcon, bg: '#E8F0FE', color: '#2B7DE9' };
  if (msg.includes('prepar') || msg.includes('cooking') || msg.includes('making'))
    return { Icon: CookIcon, bg: '#FFF8E1', color: '#E8A317' };
  if (msg.includes('cancel'))
    return { Icon: CancelIcon, bg: '#FDECEA', color: '#D63031' };
  return { Icon: BellIcon, bg: '#FFF3E6', color: '#FC8019' };
}

export default function NotificationsPage({ navigate }) {
  const {
    notifications, setNotifications,
    markNotificationRead, markAllNotificationsRead,
    isNotifsLoading,
  } = useApp();

  const [markingAll, setMarkingAll]   = useState(false);
  const [clearing, setClearing]       = useState(false);
  // tracks which ids are fading out
  const [fadingIds, setFadingIds]     = useState(new Set());

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hasAny      = notifications.length > 0;
  const hasUnread   = unreadCount > 0;

  // ── Mark all read — keeps list, just flips is_read ─────────────────
  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await markAllNotificationsRead(); } catch (_) {}
    finally { setMarkingAll(false); }
  };

  // ── Clear all — fade out then empty ────────────────────────────────
  const handleClearAll = async () => {
    if (clearing) return;
    setClearing(true);
    // mark all as read first (backend)
    try { await markAllNotificationsRead(); } catch (_) {}
    // fade all out
    const allIds = new Set(notifications.map(n => n.id));
    setFadingIds(allIds);
    // after css transition (300ms), clear state
    setTimeout(() => {
      setNotifications([]);
      setFadingIds(new Set());
      setClearing(false);
    }, 350);
  };

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

      {/* ── Header ── */}
      <div className="nf-header">
        <div>
          <h1 className="nf-title">Notifications</h1>
          <p className="nf-sub">
            {hasUnread ? `${unreadCount} unread` : hasAny ? 'All caught up' : 'Nothing here yet'}
          </p>
        </div>

        {/* Buttons — logic:
            - Mark all read: only when there are unread
            - Clear all: always when there's anything            */}
        {hasAny && (
          <div className="nf-btn-group">
            {hasUnread && (
              <button
                className="nf-btn nf-btn-read"
                onClick={handleMarkAllRead}
                disabled={markingAll || clearing}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12 7 17 22 7"/><path d="M16 7 11 12"/>
                </svg>
                {markingAll ? 'Saving…' : 'Mark all read'}
              </button>
            )}
            <button
              className="nf-btn nf-btn-clear"
              onClick={handleClearAll}
              disabled={clearing || markingAll}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
        )}
      </div>

      {/* ── Empty ── */}
      {!hasAny && (
        <div style={{ textAlign: 'center', padding: '64px 20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#FFF3E6', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <BellIcon size={28} color="#FC8019" />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
            All quiet here
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Order something and we'll keep you posted.
          </p>
        </div>
      )}

      {/* ── List ── */}
      {hasAny && (
        <div className="nf-list">
          {notifications.map(notif => {
            const { Icon, bg, color } = getNotifMeta(notif.message);
            const isClickable = !!notif.related_order_id;
            const isFading    = fadingIds.has(notif.id);
            return (
              <div
                key={notif.id}
                className={`nf-item${!notif.is_read ? ' unread' : ''}${isClickable ? ' clickable' : ''}${isFading ? ' fading' : ''}`}
                onClick={() => {
                  if (!notif.is_read) markNotificationRead(notif.id);
                  if (isClickable && navigate) navigate('orders');
                }}
              >
                <div className="nf-icon-bubble" style={{ background: bg }}>
                  <Icon size={17} color={color} />
                </div>
                <div className="nf-body">
                  <p className="nf-msg">{notif.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span className="nf-time">{formatRelativeTime(notif.created_at)}</span>
                    {isClickable && (
                      <span className="nf-view-btn">
                        View order <ArrowIcon />
                      </span>
                    )}
                  </div>
                </div>
                {!notif.is_read && <div className="nf-dot" />}
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 0 18px;
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
  margin-top: 3px;
  font-weight: 500;
}

/* Button group — stacks the two buttons vertically, right-aligned */
.nf-btn-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  flex-shrink: 0;
}
.nf-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s;
  border: 1.5px solid transparent;
}
.nf-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.nf-btn-read {
  background: white;
  border-color: var(--border);
  color: var(--text-secondary);
}
.nf-btn-read:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.nf-btn-clear {
  background: #FFF0F0;
  border-color: rgba(214,48,49,0.25);
  color: var(--red, #D63031);
}
.nf-btn-clear:hover:not(:disabled) {
  background: var(--red, #D63031);
  border-color: var(--red, #D63031);
  color: white;
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
  transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.18s;
  opacity: 1;
}
.nf-item.fading {
  opacity: 0;
  transform: translateX(16px);
  pointer-events: none;
}
.nf-item.unread {
  background: #FFFAF5;
  border-color: rgba(252,128,25,0.22);
}
.nf-item.clickable {
  cursor: pointer;
}
.nf-item.clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.nf-item.fading.clickable:hover {
  transform: translateX(16px);
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
.nf-body { flex: 1; min-width: 0; }
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
.nf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
  margin-top: 5px;
}
`;