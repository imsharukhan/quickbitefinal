'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { menuItems } from '@/data/mockData';

const foodEmojis = {
    Salads: '🥗', Wraps: '🌯', Beverages: '🥤', Bowls: '🥣',
    Rice: '🍚', Curries: '🍛', Snacks: '🍟', 'Main Course': '🍽️',
    Pizza: '🍕', Sides: '🧄', Pasta: '🍝', Noodles: '🍜',
    Starters: '🥟', Soup: '🍲', Chai: '☕', Coffee: '☕',
    Sandwiches: '🥪', Desserts: '🍫', Juices: '🧃', Shakes: '🥛',
};

export default function MenuPage({ outlet, navigate, showToast }) {
    const { cart, addToCart } = useApp();
    const [selectedCategory, setSelectedCategory] = useState('All');

    if (!outlet) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-icon">🍽️</div>
                    <h3>No outlet selected</h3>
                    <p>Go back and pick a restaurant first.</p>
                    <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '14px' }}>
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const items = menuItems[outlet.id] || [];
    const categories = useMemo(() => ['All', ...new Set(items.map(i => i.category))], [items]);

    const filteredItems = selectedCategory === 'All' ? items : items.filter(i => i.category === selectedCategory);

    const isInCart = (itemId) => cart.some(ci => ci.id === itemId);
    const getCartQty = (itemId) => { const f = cart.find(ci => ci.id === itemId); return f ? f.quantity : 0; };

    const handleAdd = (item) => {
        addToCart(item, outlet.id, outlet.name);
        showToast(`Added ${item.name} to cart`);
    };

    return (
        <div className="page-container">
            <div className="menu-header">
                <button className="back-btn" onClick={() => navigate('home')} id="back-to-home">←</button>
                <div className="menu-header-info">
                    <h1>{outlet.name}</h1>
                    <p>{outlet.description} · ★ {outlet.rating} · {outlet.deliveryTime}</p>
                </div>
            </div>

            <div className="category-pills" style={{ marginTop: '14px' }}>
                {categories.map(cat => (
                    <button key={cat} className={`category-pill ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>
                        {cat}
                    </button>
                ))}
            </div>

            <div className="menu-grid">
                {filteredItems.map(item => (
                    <div key={item.id} className="menu-item-card" id={`menu-item-${item.id}`}>
                        <div className="menu-item-info">
                            <div className="menu-item-badges">
                                {item.veg ? <div className="veg-badge"></div> : <div className="nonveg-badge"></div>}
                                {item.bestseller && <span className="bestseller-badge">Bestseller</span>}
                            </div>
                            <h4>{item.name}</h4>
                            <p className="description">{item.description}</p>
                            <div className="menu-item-price">₹{item.price}</div>
                        </div>
                        <div className="menu-item-image">
                            {foodEmojis[item.category] || '🍽️'}
                            <button
                                className={`add-btn ${isInCart(item.id) ? 'in-cart' : ''}`}
                                onClick={() => handleAdd(item)}
                                id={`add-btn-${item.id}`}
                            >
                                {isInCart(item.id) ? `Added (${getCartQty(item.id)})` : 'ADD'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {cart.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '72px', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--primary)', color: 'white',
                    padding: '12px 28px', borderRadius: 'var(--radius-full)',
                    boxShadow: '0 4px 16px rgba(232,111,44,0.35)',
                    cursor: 'pointer', zIndex: 50,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 600, fontSize: '0.9rem',
                }}
                    onClick={() => navigate('cart')}
                    id="floating-cart-btn"
                >
                    {cart.reduce((s, i) => s + i.quantity, 0)} items · ₹{cart.reduce((s, i) => s + i.price * i.quantity, 0)} — View Cart
                </div>
            )}
        </div>
    );
}
