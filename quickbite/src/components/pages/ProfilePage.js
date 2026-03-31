'use client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

export default function ProfilePage({ navigate }) {
  const { user, role, logout } = useAuth();
  const { orders } = useApp();

  const handleLogout = async () => {
    await logout();
  };

  const totalSpent = orders
    ?.filter(o => o.status === 'Picked Up')
    .reduce((sum, o) => sum + (o.total || 0), 0) || 0;

  const totalOrders = orders?.filter(o => o.status === 'Picked Up').length || 0;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '80px 20px 40px' }}>

      {/* Profile Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #E07010 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 24px',
        textAlign: 'center',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-30px', left: '-10px',
          width: '100px', height: '100px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)'
        }} />

        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 800, color: 'white',
          margin: '0 auto 16px', border: '3px solid rgba(255,255,255,0.4)',
          position: 'relative', zIndex: 1,
        }}>
          {initials}
        </div>

        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
          {user?.name || 'Loading...'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
          {user?.email || 'No email linked'}
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <span style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            padding: '4px 12px', borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize'
          }}>
            {role || 'Student'}
          </span>
          {user?.register_number && (
            <span style={{
              background: 'rgba(255,255,255,0.2)', color: 'white',
              padding: '4px 12px', borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem', fontWeight: 600
            }}>
              #{user.register_number}
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--bg-white)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{totalOrders}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Orders Completed</div>
        </div>
        <div style={{
          background: 'var(--bg-white)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)' }}>₹{totalSpent.toFixed(0)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total Spent</div>
        </div>
      </div>

      {/* Account Details */}
      <div style={{
        background: 'var(--bg-white)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)', marginBottom: '12px', overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Account Details
          </div>
        </div>
        {[
          { label: 'Full Name', value: user?.name || '—' },
          { label: 'Register Number', value: user?.register_number || '—' },
          { label: 'Email', value: user?.email || 'Not linked' },
          { label: 'Role', value: role ? role.charAt(0).toUpperCase() + role.slice(1) : '—' },
          { label: 'Account Status', value: '✅ Active' },
        ].map((item, i, arr) => (
          <div key={item.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 18px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.label}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div style={{
        background: 'var(--bg-white)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)', marginBottom: '20px', overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Quick Links
          </div>
        </div>
        {[
          { icon: '📋', label: 'My Orders', sub: 'View order history', action: () => navigate('orders') },
          { icon: '📊', label: 'Budget Tracker', sub: 'Track your spending', action: () => navigate('budget') },
          { icon: '🔔', label: 'Notifications', sub: 'View all alerts', action: () => navigate('notifications') },
        ].map((item, i, arr) => (
          <button key={item.label} onClick={item.action} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
            textAlign: 'left', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{
              width: '38px', height: '38px', borderRadius: 'var(--radius)',
              background: 'var(--primary-bg)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0
            }}>
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>›</span>
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          width: '100%', padding: '13px', borderRadius: 'var(--radius)',
          border: '1px solid var(--red)', background: 'var(--red-bg)',
          color: 'var(--red)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = 'white'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.color = 'var(--red)'; }}
      >
        Log Out
      </button>

    </div>
  );
}