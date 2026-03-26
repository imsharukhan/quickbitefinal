'use client';
import { useState } from 'react';
import { outlets } from '@/data/mockData';

const outletEmojis = {
    'outlet-1': '👑',
    'outlet-2': '🍛',
    'outlet-3': '🥤',
};

export default function HomePage({ navigate }) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOutlets = outlets.filter(outlet =>
        outlet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        outlet.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-container">
            <section className="hero" style={{
                backgroundImage: "url('/images/ayya.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                    borderRadius: '12px',
                    padding: '32px',
                    position: 'relative',
                    zIndex: 1,
                }}>
                    <h1>What would you like to eat?</h1>
                    <p>Order ahead from campus canteens and skip the queue</p>
                    <div className="search-bar">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search for a restaurant or dish..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            id="search-input"
                        />
                    </div>
                </div>
            </section>

            <section style={{ marginBottom: '28px' }}>
                <div className="section-header">
                    <h2>Choose a canteen</h2>
                </div>
                {filteredOutlets.length > 0 ? (
                    <div className="outlet-grid">
                        {filteredOutlets.map(outlet => (
                            <div
                                key={outlet.id}
                                className="outlet-card"
                                onClick={() => outlet.isOpen && navigate('menu', outlet)}
                                style={{ opacity: outlet.isOpen ? 1 : 0.5, cursor: outlet.isOpen ? 'pointer' : 'not-allowed' }}
                                id={`outlet-${outlet.id}`}
                            >
                                <div className="outlet-card-image">
                                    {outletEmojis[outlet.id] || '🍽️'}
                                    {!outlet.isOpen && <div className="outlet-closed-badge">Closed</div>}
                                </div>
                                <div className="outlet-card-body">
                                    <h3>{outlet.name}</h3>
                                    <p>{outlet.description}</p>
                                    <div className="outlet-card-meta">
                                        <span className="rating">★ {outlet.rating}</span>
                                        <span>{outlet.deliveryTime}</span>
                                        <span>{outlet.cuisine}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h3>No results found</h3>
                        <p>Try a different search</p>
                    </div>
                )}
            </section>
        </div>
    );
}
