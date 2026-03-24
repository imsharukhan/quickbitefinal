'use client';
import { useApp } from '@/context/AppContext';

function timeAgo(isoString) {
    try {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    } catch {
        return '';
    }
}

export default function NotificationsPage() {
    const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useApp();

    return (
        <div className="page-container notifications-page">
            <div className="menu-header animate-fade-in" style={{ marginBottom: '20px' }}>
                <div className="menu-header-info">
                    <h1>Notifications</h1>
                    <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
                </div>
            </div>

            {unreadCount > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <button className="btn btn-outline btn-sm" onClick={markAllNotificationsRead} id="mark-all-read-btn">
                        ✓ Mark all as read
                    </button>
                </div>
            )}

            {notifications.length === 0 ? (
                <div className="empty-state animate-slide-up">
                    <div className="empty-icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>Notifications about your orders will appear here.</p>
                </div>
            ) : (
                <div className="stagger-children">
                    {notifications.map(notif => (
                        <div
                            key={notif.id}
                            className={`notification-item ${!notif.read ? 'unread' : ''}`}
                            onClick={() => markNotificationRead(notif.id)}
                            id={`notif-${notif.id}`}
                        >
                            <div className={`notif-dot ${notif.read ? 'read' : ''}`}></div>
                            <div>
                                <div className="notif-message">{notif.message}</div>
                                <div className="notif-time">{timeAgo(notif.timestamp)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
