'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import * as menuService from '@/services/menuService';
 
const CATEGORIES = ['All', 'Breakfast', 'Rice & Meals', 'Breads & Rotis', 'Snacks & Starters', 'Desserts & Sweets', 'Drinks & Beverages', 'Other'];
 
// ── Category image map ──────────────────────────────────────────────
// Place your images inside /public/categories/
const VALID_IMAGES = ['breakfast', 'rice_meals', 'breads_rotis', 'snacks_starters', 'desserts_sweets', 'drinks_beverages'];
const getCategoryImg = (catName) => {
  if (!catName || catName.toLowerCase() === 'all') return '/categories/other.png';
  const cleanName = catName.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
  return VALID_IMAGES.includes(cleanName) 
    ? `/categories/${cleanName}.png` 
    : '/categories/other.png';
};
const FALLBACK_IMAGE = '/categories/other.png';
 
const CATEGORY_EMOJI = {
  'Breakfast': '🍳', 'Rice & Meals': '🍛', 'Breads & Rotis': '🫓',
  'Snacks & Starters': '🍟', 'Desserts & Sweets': '🍮',
  'Drinks & Beverages': '🥤', 'Other': '🍽️',
};
 
export default function MenuPage({ outlet, navigate, showToast }) {
  const { cart, addToCart, updateCartQuantity } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
 
  const fetchMenu = async () => {
    if (!outlet?.id) return;
    try {
      const data = await menuService.getMenuByOutlet(outlet.id);
      setMenuItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchMenu();
    const interval = setInterval(fetchMenu, 60000);
    return () => clearInterval(interval);
  }, [outlet?.id]);
 
  if (!outlet) {
    return (
      <div className="empty-state" style={{ paddingTop: '100px' }}>
        <div className="empty-icon">🍽️</div>
        <h3>No outlet selected</h3>
        <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '16px' }}>
          Back to Home
        </button>
      </div>
    );
  }
 
  const handleAdd = (item) => {
    const res = addToCart(item, outlet.id, outlet.name);
    if (res?.conflict) {
      if (window.confirm(`Your cart has items from "${res.existingOutlet}". Clear cart and add from "${outlet.name}"?`)) {
        showToast('Please clear your cart first', 'error');
      }
    } else {
      showToast(`${item.name} added to cart! 🛒`);
    }
  };
 
  const filteredItems = menuItems.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchSearch && matchCategory;
  });
 
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
 
  return (
    <div style={{
      paddingTop: '60px',
      paddingBottom: cartCount > 0 ? '80px' : '40px',
      minHeight: '100vh',
      background: 'var(--bg)',
    }}>
 
      {/* Sticky Header */}
      <div style={{
        background: 'var(--bg-white)', borderBottom: '1px solid var(--border)',
        padding: '16px 20px', position: 'sticky', top: '60px', zIndex: 50,
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Outlet Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <button onClick={() => navigate('home')} style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--bg-white)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', cursor: 'pointer', flexShrink: 0,
            }}>←</button>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2 }}>{outlet.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {outlet.cuisine || 'Campus Canteen'}
                </span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: outlet.is_open ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: outlet.is_open ? 'var(--green)' : 'var(--red)',
                }}>
                  {outlet.is_open ? '● Open' : '● Closed'}
                </span>
              </div>
            </div>
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text" placeholder="Search in menu..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px 9px 36px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontSize: '0.875rem', outline: 'none',
                background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </div>
        </div>
      </div>
 
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 20px' }}>
 
        {/* Category Pills with images */}
        {!loading && (
          <div style={{
            display: 'flex', gap: '24px', overflowX: 'auto',
            paddingBottom: '16px', scrollbarWidth: 'none', marginBottom: '4px',
          }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              const imgSrc = cat === 'All' ? null : getCategoryImg(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '6px', flexShrink: 0, cursor: 'pointer', background: 'none',
                    border: 'none', padding: '4px 2px', minWidth: '80px',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.2s',
                  }}
                >
                  {/* Image circle or All pill */}
                  {cat === 'All' ? (
                    <>
                      <div style={{
                        height: '58px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          padding: '7px 20px', borderRadius: 'var(--radius-full)',
                          border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                          background: isActive ? 'var(--primary)' : 'var(--bg-white)',
                          color: isActive ? 'white' : 'var(--text-secondary)',
                          fontWeight: isActive ? 700 : 500, fontSize: '0.82rem',
                          whiteSpace: 'nowrap',
                        }}>All</div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'transparent' }}>All</span>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: '58px', height: '58px', borderRadius: '50%',
                        overflow: 'hidden', flexShrink: 0,
                        border: `2.5px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                        boxShadow: isActive ? '0 0 0 1px var(--primary)' : '0 1px 4px rgba(0,0,0,0.1)',
                        transition: 'border-color 0.18s, box-shadow 0.18s',
                      }}>
                        <img
                          src={imgSrc}
                          alt={cat}
                          onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                        whiteSpace: 'normal', maxWidth: '80px',
                        textAlign: 'center', lineHeight: 1.2,
                        transition: 'color 0.18s',
                      }}>{cat}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
 
        {/* Loading Skeleton */}
        {loading && (
          <>
            <style>{`
              .menu-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
              @media (min-width: 700px) { .menu-grid { grid-template-columns: repeat(3, 1fr); } }
              @media (min-width: 900px) { .menu-grid { grid-template-columns: repeat(4, 1fr); } }
            `}</style>
            <div className="menu-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
          </>
        )}
 
        {/* Empty */}
        {!loading && filteredItems.length === 0 && (
          <div className="empty-state" style={{ paddingTop: '40px' }}>
            <div className="empty-icon">🍽️</div>
            <h3>No items found</h3>
            <p>{searchQuery ? `No results for "${searchQuery}"` : 'No items in this category yet.'}</p>
          </div>
        )}
 
        {/* Menu Grid */}
        {!loading && filteredItems.length > 0 && (
          <>
            <style>{`
              .menu-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
              @media (min-width: 700px) { .menu-grid { grid-template-columns: repeat(3, 1fr); } }
              @media (min-width: 900px) { .menu-grid { grid-template-columns: repeat(4, 1fr); } }
            `}</style>
            <div className="menu-grid">
              {filteredItems.map(item => {
                const inCart = cart.find(ci => ci.id === item.id);
                const imgSrc = getCategoryImg(item.category);
                return (
                  <div key={item.id} style={{
                    background: 'var(--bg-white)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    opacity: item.is_available ? 1 : 0.6,
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    boxShadow: 'var(--shadow)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {/* Category image as card header */}
                    <div style={{
                      height: '110px', position: 'relative', overflow: 'hidden',
                      background: item.is_veg ? 'linear-gradient(135deg,#fff8e1,#ffe0b2)' : 'linear-gradient(135deg,#fce4ec,#ffccbc)',
                    }}>
                      <img
                        src={imgSrc}
                        alt={item.category}
                        onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {item.is_bestseller && (
                        <div style={{
                          position: 'absolute', top: '7px', left: '7px',
                          background: 'var(--primary)', color: 'white',
                          fontSize: '0.55rem', fontWeight: 800, padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>★ BESTSELLER</div>
                      )}
                      {!item.is_available && (
                        <div style={{
                          position: 'absolute', top: '7px', right: '7px',
                          background: 'var(--red)', color: 'white',
                          fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                        }}>SOLD OUT</div>
                      )}
                    </div>
 
                    {/* Card Body */}
                    <div style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '3px' }}>
                        {/* veg/non-veg indicator */}
                        <div style={{
                          width: '13px', height: '13px', flexShrink: 0, marginTop: '2px',
                          border: `1.5px solid ${item.is_veg ? 'var(--green)' : 'var(--red)'}`,
                          borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{
                            width: '6px', height: '6px',
                            borderRadius: item.is_veg ? '50%' : '0',
                            background: item.is_veg ? 'var(--green)' : 'var(--red)',
                            clipPath: item.is_veg ? 'none' : 'polygon(50% 0%, 0% 100%, 100% 100%)',
                          }} />
                        </div>
                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
                          {item.name}
                        </h4>
                      </div>
 
                      {item.description && (
                        <p style={{
                          fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{item.description}</p>
                      )}
 
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>₹{item.price}</span>
                        {item.is_available ? (
                          inCart ? (
                            <div style={{
                              display: 'flex', alignItems: 'center',
                              border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                            }}>
                              <button onClick={() => updateCartQuantity(item.id, inCart.quantity - 1)}
                                style={{ width: '26px', height: '26px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <span style={{ width: '22px', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>{inCart.quantity}</span>
                              <button onClick={() => updateCartQuantity(item.id, inCart.quantity + 1)}
                                style={{ width: '26px', height: '26px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                          ) : (
                            <button onClick={() => handleAdd(item)}
                              style={{
                                padding: '5px 14px', borderRadius: 'var(--radius-sm)',
                                border: '1.5px solid var(--primary)', background: 'white',
                                color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--primary)'; }}
                            >ADD</button>
                          )
                        ) : (
                          <button disabled style={{
                            padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)', background: 'var(--bg)',
                            color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'not-allowed',
                          }}>Sold Out</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
 
      {/* View Cart Bar */}
      {cartCount > 0 && (
        <>
          <style>{`
            .mobile-cart-bar { display: none !important; }
            @media (max-width: 768px) {
              .mobile-cart-bar { display: flex !important; }
            }
          `}</style>
          <div className="mobile-cart-bar" onClick={() => navigate('cart')} style={{
            position: 'fixed', bottom: '0', left: '0', right: '0',
            background: 'var(--primary)', color: 'white', padding: '16px 24px',
            alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', boxShadow: '0 -4px 10px rgba(0,0,0,0.1)', zIndex: 100,
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
              {cartCount} Items | ₹{cartTotal}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
              VIEW CART →
            </div>
          </div>
        </>
      )}
    </div>
  );
}
 