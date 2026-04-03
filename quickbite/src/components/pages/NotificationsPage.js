'use client';
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
  const { notifications, markNotificationRead, markAllNotificationsRead, isNotifsLoading } = useApp();

  if (isNotifsLoading && notifications.length === 0) {
      return (
        <div className="empty-state" style={{ height: '100vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      );
  }

  return (
    <div className="notifications-page pb-section">
      <div className="menu-header" style={{ marginBottom: '20px' }}>
        <div className="menu-header-info">
          <h1>Notifications</h1>
          <p>Stay updated on your orders</p>
        </div>
        {notifications.length > 0 && (
          <button className="text-btn" onClick={markAllNotificationsRead} style={{ color: 'var(--primary)' }}>
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h3>All caught up!</h3>
          <p>You have no new notifications.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
              onClick={() => {
                if (!notif.is_read) markNotificationRead(notif.id);
                if (notif.related_order_id && navigate) navigate('orders');
              }}
              style={{ cursor: notif.related_order_id ? 'pointer' : 'default' }}
            >
              <div className="notif-icon">
                {notif.message.toLowerCase().includes('ready') ? '🍽️' : 
                 notif.message.toLowerCase().includes('confirmed') ? '✅' : '🔔'}
              </div>
              <div className="notif-content">
                <p>{notif.message} {notif.related_order_id && <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold' }}> → View Order</span>}</p>
                <span className="notif-time">{formatRelativeTime(notif.created_at)}</span>
              </div>
              {!notif.is_read && <div className="unread-dot"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
