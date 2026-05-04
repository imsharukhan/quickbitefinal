'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import * as outletService from '@/services/outletService';
import { getGreeting } from '@/data/greetings';

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

const StarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="#E8A317" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

export default function HomePage({ navigate }) {
  const { user } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchFocused, setSearchFocused] = useState(false);

  const filters = ['All', 'Open Now', 'Closed'];
  const greet = getGreeting(user?.name);

  const fetchOutlets = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // silent=true means background refresh — bypass cache for fresh is_open state
      const data = await outletService.getAllOutlets(silent);
      setOutlets(data || []);
    } catch (err) {
      if (!silent) setError('Failed to load outlets. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    outletService.getAllOutlets().then(data => {
      if (data?.length) {
        setOutlets(data);
        setLoading(false);
        setTimeout(() => fetchOutlets(true), 100);
      } else {
        fetchOutlets(false);
      }
    }).catch(() => fetchOutlets(false));
    const interval = setInterval(() => fetchOutlets(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = outlets.filter(o => {
    const matchSearch = !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.cuisine || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === 'All' ? true :
      activeFilter === 'Open Now' ? isOutletEffectivelyOpen(o) :
      activeFilter === 'Closed' ? !isOutletEffectivelyOpen(o) : true;
    return matchSearch && matchFilter;
  });

  const openOutlets = filtered.filter(o => isOutletEffectivelyOpen(o));
  const closedOutlets = filtered.filter(o => !isOutletEffectivelyOpen(o));

  return (
    <div className="page-container animate-fade-in" style={{ paddingTop: 'var(--page-top-pad, 80px)' }}>

      {/* ── Greeting Hero ── */}
      <div style={{ padding: '28px 0 24px' }}>
        <p style={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}>
          {new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
        <h1 style={{
          fontSize: 'clamp(1.9rem, 5vw, 2.6rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          color: 'var(--text)',
          marginBottom: '10px',
          letterSpacing: '-0.02em',
        }}>
          {greet.salutation.replace(/,.*/, '')}{' '}
          <span style={{ color: 'var(--primary)' }}>
            {greet.salutation.includes(',') ? greet.salutation.split(/,(.+)/)[1] : ''}
          </span>
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          marginBottom: '28px',
          maxWidth: '380px',
          lineHeight: 1.55,
        }}>
          {greet.sub}
        </p>

        {/* Search Bar — pill style */}
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <span style={{
            position: 'absolute', left: '18px', top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
            transition: 'color 0.2s',
            pointerEvents: 'none',
          }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search outlets or cuisine..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: '100%',
              padding: '13px 20px 13px 46px',
              borderRadius: '999px',
              border: `1.5px solid ${searchFocused ? 'var(--primary)' : 'var(--border)'}`,
              background: 'white',
              fontSize: '0.92rem',
              outline: 'none',
              color: 'var(--text)',
              boxShadow: searchFocused
                ? '0 4px 20px rgba(252,128,25,0.13)'
                : '0 2px 14px rgba(0,0,0,0.06)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '16px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg)',
                border: 'none', borderRadius: '50%',
                width: '22px', height: '22px',
                color: 'var(--text-muted)',
                fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Filter Pills ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
        {filters.map(f => {
          const isActive = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px',
                borderRadius: '999px',
                border: isActive ? 'none' : '1.5px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'white',
                color: isActive ? 'white' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 14px rgba(252,128,25,0.28)' : '0 1px 4px rgba(0,0,0,0.04)',
                flexShrink: 0,
              }}
            >
              {f === 'Open Now' && (
                <span className={isActive ? 'dot-white-pulse' : 'dot-green-pulse'} />
              )}
              {f === 'Closed' && (
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: isActive ? 'rgba(255,255,255,0.8)' : 'var(--red)',
                  flexShrink: 0,
                }} />
              )}
              {f}
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="custom-outlet-grid">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ borderRadius: '20px', overflow: 'hidden', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="skeleton" style={{ height: '200px' }} />
              <div style={{ padding: '16px' }}>
                <div className="skeleton skeleton-text" style={{ width: '65%', marginBottom: '8px' }} />
                <div className="skeleton skeleton-text" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="empty-state">
          <div className="empty-icon">😕</div>
          <h3>Couldn't load outlets</h3>
          <p>{error}</p>
          <button className="btn btn-outline" onClick={fetchOutlets} style={{ marginTop: '14px' }}>Try Again</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🍽️</div>
          <h3>No outlets found</h3>
          <p>{search ? `No results for "${search}"` : 'No outlets available right now.'}</p>
          {search && (
            <button className="btn btn-outline" onClick={() => setSearch('')} style={{ marginTop: '14px' }}>Clear Search</button>
          )}
        </div>
      )}

      {/* Open Outlets */}
      {!loading && !error && openOutlets.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span className="live-dot-green" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Open Now</h2>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({openOutlets.length})</span>
          </div>
          <div className="custom-outlet-grid">
            {openOutlets.map(o => (
              <OutletCard key={o.id} outlet={o} onClick={() => navigate('menu', o)} />
            ))}
          </div>
        </>
      )}

      {/* Closed Outlets */}
      {!loading && !error && closedOutlets.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Closed</h2>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({closedOutlets.length})</span>
          </div>
          <div className="custom-outlet-grid" style={{ opacity: 0.65 }}>
            {closedOutlets.map(o => (
              <OutletCard key={o.id} outlet={o} onClick={() => navigate('menu', o)} />
            ))}
          </div>
        </>
      )}

      <div style={{ paddingBottom: '40px' }} />
      <style>{`
        :root { --page-top-pad: 80px; }
        @media (max-width: 768px) { :root { --page-top-pad: 68px; } }
        .custom-outlet-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        @media (max-width: 768px) {
          .custom-outlet-grid { margin-bottom: 80px; }
        }
        @media (min-width: 640px) {
          .custom-outlet-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .custom-outlet-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .live-dot-green {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: var(--green);
          flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(43,138,62,0.45);
          animation: pulse-green-ring 2.2s ease-out infinite;
        }
        @keyframes pulse-green-ring {
          0%   { box-shadow: 0 0 0 0 rgba(43,138,62,0.45); }
          60%  { box-shadow: 0 0 0 7px rgba(43,138,62,0); }
          100% { box-shadow: 0 0 0 0 rgba(43,138,62,0); }
        }
        .dot-green-pulse {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--green);
          flex-shrink: 0;
          animation: pulse-green-ring 2.2s ease-out infinite;
        }
        .dot-white-pulse {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          flex-shrink: 0;
        }
        .outlet-img-zoom {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.5s ease;
          display: block;
        }
        .outlet-card-wrap:hover .outlet-img-zoom {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}

function isOutletEffectivelyOpen(outlet) {
  if (!outlet.is_open) return false;
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (outlet.closed_dates && outlet.closed_dates.includes(todayIST)) return false;
  if (!outlet.opening_time || !outlet.closing_time) return outlet.is_open;
  const nowIST = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [nowH, nowM] = nowIST.split(':').map(Number);
  const nowMins = nowH * 60 + nowM;
  const [openH, openM] = outlet.opening_time.split(':').map(Number);
  const [closeH, closeM] = outlet.closing_time.split(':').map(Number);
  return nowMins >= openH * 60 + openM && nowMins < closeH * 60 + closeM;
}

function isClosingSoon(outlet) {
  if (!isOutletEffectivelyOpen(outlet) || !outlet.closing_time) return false;
  const nowIST = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [nowH, nowM] = nowIST.split(':').map(Number);
  const nowMins = nowH * 60 + nowM;
  const [closeH, closeM] = outlet.closing_time.split(':').map(Number);
  const closeMins = closeH * 60 + closeM;
  return closeMins - nowMins <= 60 && closeMins - nowMins > 0;
}

function OutletCard({ outlet, onClick }) {
  const open = isOutletEffectivelyOpen(outlet);
  const closingSoon = isClosingSoon(outlet);

  const getMappedImage = (name) => {
    if (name.includes('Dimora')) return '/images/dimora.jpg';
    if (name.includes('Reenu')) return '/images/reenu.jpg';
    if (name.includes('Bhojan')) return '/images/bhojan.jpg';
    return outlet.image_url;
  };
  const imageUrl = getMappedImage(outlet.name);

  return (
    <div
      className="outlet-card-wrap"
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 14px rgba(0,0,0,0.07)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.13)';
        import('@/services/menuService').then(m => m.getMenuByOutlet(outlet.id)).catch(() => {});
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.07)';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: '195px', overflow: 'hidden', background: 'var(--primary)', flexShrink: 0 }}>
        {imageUrl ? (
          <img src={imageUrl} alt={outlet.name} className="outlet-img-zoom" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white', fontWeight: 800 }}>
            {outlet.name.charAt(0)}
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />

        {/* Closes soon — top left */}
        {closingSoon && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(232,163,23,0.95)', color: 'white', padding: '4px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ⚡ Closes soon
          </div>
        )}

        {/* Closed badge — top left */}
        {!open && !closingSoon && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(214,48,49,0.9)', color: 'white', padding: '4px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
            Closed
          </div>
        )}

        {/* Rating — top right */}
        {outlet.rating > 0 && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.95)', color: '#1A1A1A', padding: '4px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <StarIcon /> {outlet.rating.toFixed(1)}
          </div>
        )}

        {/* Outlet name on image */}
        <div style={{ position: 'absolute', bottom: '13px', left: '16px', right: '16px' }}>
          <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.35)', margin: 0 }}>
            {outlet.name}
          </h3>
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.45, margin: 0 }}>
          {outlet.description || outlet.cuisine || 'Campus Canteen'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ClockIcon />
            {outlet.opening_time ? `${formatTime(outlet.opening_time)} – ${formatTime(outlet.closing_time)}` : 'See timings'}
          </span>
          <span style={{
            color: open ? 'var(--green)' : 'var(--red)',
            fontWeight: 700,
            fontSize: '0.75rem',
            background: open ? 'var(--green-bg)' : 'var(--red-bg)',
            padding: '3px 10px',
            borderRadius: '999px',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: open ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
            {open ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
    </div>
  );
}