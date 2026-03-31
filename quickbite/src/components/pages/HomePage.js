'use client';
import { useState, useEffect } from 'react';
import * as outletService from '@/services/outletService';

const CUISINE_EMOJIS = {
  'South Indian': '🍛',
  'North Indian': '🫓',
  'Chinese': '🍜',
  'Fast Food': '🍔',
  'Snacks': '🥪',
  'Beverages': '☕',
  'Desserts': '🍨',
  'default': '🍽️',
};

const getCuisineEmoji = (cuisine) => {
  if (!cuisine) return CUISINE_EMOJIS.default;
  for (const key of Object.keys(CUISINE_EMOJIS)) {
    if (cuisine.toLowerCase().includes(key.toLowerCase())) return CUISINE_EMOJIS[key];
  }
  return CUISINE_EMOJIS.default;
};

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
};

export default function HomePage({ navigate }) {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Open Now', 'South Indian', 'North Indian', 'Fast Food', 'Snacks', 'Beverages'];

  const fetchOutlets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await outletService.getAllOutlets();
      setOutlets(data || []);
    } catch (err) {
      setError('Failed to load outlets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutlets(); }, []);

  const filtered = outlets.filter(o => {
    const matchSearch = !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.cuisine || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === 'All' ? true :
      activeFilter === 'Open Now' ? o.is_open :
      (o.cuisine || '').toLowerCase().includes(activeFilter.toLowerCase());
    return matchSearch && matchFilter;
  });

  const openOutlets = filtered.filter(o => o.is_open);
  const closedOutlets = filtered.filter(o => !o.is_open);

  return (
    <div className="page-container animate-fade-in" style={{ paddingTop: '80px' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF8F0 0%, #FFF3E0 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 24px',
        marginBottom: '24px',
        border: '1px solid var(--border-light)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
            Cravings? <span style={{ color: 'var(--primary)' }}>Fast.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
            Pre-order from campus cafeterias — skip the queue 🚀
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: '460px' }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--text-muted)'
          }}>🔍</span>
          <input
            type="text"
            placeholder="Search outlets or cuisine..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 16px 11px 42px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'white',
              fontSize: '0.9rem',
              outline: 'none',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="category-pills" style={{ marginBottom: '20px' }}>
        {filters.map(f => (
          <button
            key={f}
            className={`category-pill ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f === 'Open Now' ? '🟢 ' : ''}{f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="outlet-grid">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white', border: '1px solid var(--border-light)' }}>
              <div className="skeleton" style={{ height: '140px' }} />
              <div style={{ padding: '14px' }}>
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
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
          <button className="btn btn-outline" onClick={fetchOutlets} style={{ marginTop: '14px' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🍽️</div>
          <h3>No outlets found</h3>
          <p>{search ? `No results for "${search}"` : 'No outlets available right now.'}</p>
          {search && (
            <button className="btn btn-outline" onClick={() => setSearch('')} style={{ marginTop: '14px' }}>
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Open Outlets */}
      {!loading && !error && openOutlets.length > 0 && (
        <>
          <div className="section-header">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              🟢 Open Now <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({openOutlets.length})</span>
            </h2>
          </div>
          <div className="outlet-grid" style={{ marginBottom: '28px' }}>
            {openOutlets.map(o => (
              <OutletCard key={o.id} outlet={o} onClick={() => navigate('menu', o)} />
            ))}
          </div>
        </>
      )}

      {/* Closed Outlets */}
      {!loading && !error && closedOutlets.length > 0 && (
        <>
          <div className="section-header">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              🔴 Closed <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({closedOutlets.length})</span>
            </h2>
          </div>
          <div className="outlet-grid" style={{ marginBottom: '28px', opacity: 0.7 }}>
            {closedOutlets.map(o => (
              <OutletCard key={o.id} outlet={o} onClick={() => navigate('menu', o)} />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

function OutletCard({ outlet, onClick }) {
  const emoji = getCuisineEmoji(outlet.cuisine);
  const rating = outlet.rating ? parseFloat(outlet.rating).toFixed(1) : '—';

  return (
    <div className="outlet-card" onClick={onClick}>
      <div className="outlet-card-image">
        <span style={{ fontSize: '2.8rem' }}>{emoji}</span>
        {!outlet.is_open && (
          <div className="outlet-closed-badge">Closed</div>
        )}
        {outlet.rating >= 4.5 && outlet.is_open && (
          <div className="outlet-featured-badge">⭐ Top Rated</div>
        )}
      </div>
      <div className="outlet-card-body">
        <h3>{outlet.name}</h3>
        <p>{outlet.cuisine || 'Campus Canteen'}</p>
        <div className="outlet-card-meta">
          <span className="rating">⭐ {rating}</span>
          <span>🕐 {outlet.opening_time ? `${formatTime(outlet.opening_time)} – ${formatTime(outlet.closing_time)}` : 'See timings'}</span>
          <span style={{ marginLeft: 'auto', color: outlet.is_open ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: '0.75rem' }}>
            {outlet.is_open ? '● Open' : '● Closed'}
          </span>
        </div>
      </div>
    </div>
  );
}