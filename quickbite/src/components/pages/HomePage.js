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

  const filters = ['All', 'Open Now', 'Closed'];

  const fetchOutlets = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await outletService.getAllOutlets();
      setOutlets(data || []);
    } catch (err) {
      if (!silent) setError('Failed to load outlets. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Show cached data instantly if available, then refresh silently
    outletService.getAllOutlets().then(data => {
      if (data?.length) {
        setOutlets(data);
        setLoading(false);
        // Silent background refresh
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
      activeFilter === 'Open Now' ? o.is_open :
      activeFilter === 'Closed' ? !o.is_open : true;
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
            {f === 'Open Now' ? '🟢 ' : (f === 'Closed' ? '🔴 ' : '')}{f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="custom-outlet-grid">
          {[1, 2, 3].map(i => (
            <div key={i} style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white', border: '1px solid var(--border-light)' }}>
              <div className="skeleton" style={{ height: '180px' }} />
              <div style={{ padding: '20px' }}>
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
          <div className="section-header">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              🔴 Closed <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({closedOutlets.length})</span>
            </h2>
          </div>
          <div className="custom-outlet-grid" style={{ opacity: 0.7 }}>
            {closedOutlets.map(o => (
              <OutletCard key={o.id} outlet={o} onClick={() => navigate('menu', o)} />
            ))}
          </div>
        </>
      )}

      {/* Grid Layout Styles */}
      <style>{`
        .custom-outlet-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }
        @media (min-width: 1024px) {
          .custom-outlet-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

function OutletCard({ outlet, onClick }) {
  const handleMouseEnter = (e) => {
    e.currentTarget.style.transform = 'scale(1.02)';
    // Prefetch menu on hover so it's instant when they click
    import('@/services/menuService').then(m => m.getMenuByOutlet(outlet.id)).catch(() => {});
  };

  const getMappedImage = (name) => {
    if (name.includes('Dimora')) return '/images/dimora.jpg';
    if (name.includes('Reenu')) return '/images/reenu.jpg';
    if (name.includes('Bhojan')) return '/images/bhojan.jpg';
    return outlet.image_url;
  };
  const imageUrl = getMappedImage(outlet.name);

  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 transform" 
      onClick={onClick}
      style={{ 
        border: '1px solid var(--border-light)', 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div className="aspect-video w-full overflow-hidden relative" style={{ backgroundColor: 'var(--primary)', aspectRatio: '16/9' }}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={outlet.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            className="transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white" style={{ fontSize: '3rem', fontWeight: 'bold' }}>
            {outlet.name.charAt(0)}
          </div>
        )}
        {!outlet.is_open && (
           <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
             🔴 Closed
           </div>
        )}
      </div>
      <div className="flex-1 flex flex-col" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text)', marginBottom: '6px' }}>{outlet.name}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>{outlet.description || outlet.cuisine || 'Campus Canteen'}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {outlet.cuisine || 'Campus Canteen'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            🕐 {outlet.opening_time ? `${formatTime(outlet.opening_time)} – ${formatTime(outlet.closing_time)}` : 'Timings'}
          </span>
          <span style={{ color: outlet.is_open ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: outlet.is_open ? 'var(--green)' : 'var(--red)' }}></span>
            {outlet.is_open ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
    </div>
  );
}