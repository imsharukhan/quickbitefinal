// Mock data for Quick Bite application

export const outlets = [
  {
    id: 'outlet-1',
    name: 'Dimora',
    description: 'Biryanis, curries, fried rice & classic meals',
    cuisine: 'North Indian',
    rating: 4.6,
    deliveryTime: '15-20 min',
    image: '/images/dimora.jpg',
    isOpen: true,
    featured: true,
  },
  {
    id: 'outlet-2',
    name: 'Reenu',
    description: 'South Indian tiffins, snacks & beverages',
    cuisine: 'South Indian',
    rating: 4.5,
    deliveryTime: '10-15 min',
    image: '/images/reenu.jpg',
    isOpen: true,
    featured: true,
  },
  {
    id: 'outlet-3',
    name: 'Bhojan',
    description: 'Juices, shakes, sandwiches & fast food',
    cuisine: 'Cafe & Fast Food',
    rating: 4.4,
    deliveryTime: '10-15 min',
    image: '/images/bhojan.jpg',
    isOpen: true,
    featured: true,
  },
];

export const menuItems = {
  'outlet-1': [
    { id: 'rk-1', name: 'Chicken Biryani', price: 150, category: 'Biryani', description: 'Aromatic basmati rice with tender chicken', veg: false, bestseller: true },
    { id: 'rk-2', name: 'Mutton Biryani', price: 200, category: 'Biryani', description: 'Slow-cooked mutton with fragrant rice', veg: false, bestseller: true },
    { id: 'rk-3', name: 'Veg Biryani', price: 120, category: 'Biryani', description: 'Mixed vegetable biryani with raita', veg: true, bestseller: false },
    { id: 'rk-4', name: 'Egg Biryani', price: 130, category: 'Biryani', description: 'Boiled egg biryani with gravy', veg: false, bestseller: false },
    { id: 'rk-5', name: 'Chicken Fried Rice', price: 120, category: 'Rice', description: 'Stir-fried rice with chicken & veggies', veg: false, bestseller: true },
    { id: 'rk-6', name: 'Veg Fried Rice', price: 100, category: 'Rice', description: 'Stir-fried rice with mixed vegetables', veg: true, bestseller: false },
    { id: 'rk-7', name: 'Paneer Butter Masala', price: 140, category: 'Curries', description: 'Creamy tomato gravy with paneer cubes', veg: true, bestseller: true },
    { id: 'rk-8', name: 'Chicken Curry', price: 150, category: 'Curries', description: 'Traditional chicken curry with spices', veg: false, bestseller: false },
    { id: 'rk-9', name: 'Dal Fry', price: 80, category: 'Curries', description: 'Tempered yellow lentils', veg: true, bestseller: false },
    { id: 'rk-10', name: 'Chapati (2 pcs)', price: 30, category: 'Breads', description: 'Soft wheat flatbread', veg: true, bestseller: false },
    { id: 'rk-11', name: 'Naan', price: 40, category: 'Breads', description: 'Tandoor-baked flatbread', veg: true, bestseller: false },
    { id: 'rk-12', name: 'Gulab Jamun (2 pcs)', price: 50, category: 'Desserts', description: 'Soft milk dumplings in sugar syrup', veg: true, bestseller: true },
  ],
  'outlet-2': [
    { id: 'sa-1', name: 'Masala Dosa', price: 60, category: 'Tiffin', description: 'Crispy dosa with potato masala filling', veg: true, bestseller: true },
    { id: 'sa-2', name: 'Idli (3 pcs)', price: 40, category: 'Tiffin', description: 'Steamed rice cakes with sambar & chutney', veg: true, bestseller: true },
    { id: 'sa-3', name: 'Vada (2 pcs)', price: 40, category: 'Tiffin', description: 'Crispy lentil fritters with chutney', veg: true, bestseller: false },
    { id: 'sa-4', name: 'Pongal', price: 50, category: 'Tiffin', description: 'Rice & lentil porridge with ghee', veg: true, bestseller: false },
    { id: 'sa-5', name: 'Poori Masala', price: 60, category: 'Tiffin', description: 'Fried bread with potato curry', veg: true, bestseller: true },
    { id: 'sa-6', name: 'Uttapam', price: 55, category: 'Tiffin', description: 'Thick pancake with onion & tomato', veg: true, bestseller: false },
    { id: 'sa-7', name: 'Sambar Rice', price: 70, category: 'Meals', description: 'Rice mixed with sambar & veggies', veg: true, bestseller: false },
    { id: 'sa-8', name: 'Curd Rice', price: 50, category: 'Meals', description: 'Rice mixed with yogurt & tempering', veg: true, bestseller: true },
    { id: 'sa-9', name: 'Lemon Rice', price: 60, category: 'Meals', description: 'Tangy rice with peanuts & curry leaves', veg: true, bestseller: false },
    { id: 'sa-10', name: 'Filter Coffee', price: 25, category: 'Beverages', description: 'Traditional South Indian filter coffee', veg: true, bestseller: true },
    { id: 'sa-11', name: 'Tea', price: 15, category: 'Beverages', description: 'Hot milk tea', veg: true, bestseller: false },
    { id: 'sa-12', name: 'Badam Milk', price: 35, category: 'Beverages', description: 'Warm almond-flavored milk', veg: true, bestseller: false },
  ],
  'outlet-3': [
    { id: 'uc-1', name: 'Veg Sandwich', price: 50, category: 'Sandwiches', description: 'Grilled sandwich with veggies & cheese', veg: true, bestseller: true },
    { id: 'uc-2', name: 'Chicken Sandwich', price: 70, category: 'Sandwiches', description: 'Grilled sandwich with chicken filling', veg: false, bestseller: true },
    { id: 'uc-3', name: 'Veg Puff', price: 25, category: 'Snacks', description: 'Flaky pastry with spiced potato filling', veg: true, bestseller: true },
    { id: 'uc-4', name: 'Egg Puff', price: 30, category: 'Snacks', description: 'Flaky pastry with boiled egg filling', veg: false, bestseller: false },
    { id: 'uc-5', name: 'Samosa (2 pcs)', price: 30, category: 'Snacks', description: 'Crispy pastry with spiced potato filling', veg: true, bestseller: true },
    { id: 'uc-6', name: 'French Fries', price: 60, category: 'Snacks', description: 'Crispy potato fries with ketchup', veg: true, bestseller: false },
    { id: 'uc-7', name: 'Mango Juice', price: 40, category: 'Juices', description: 'Fresh mango juice', veg: true, bestseller: true },
    { id: 'uc-8', name: 'Watermelon Juice', price: 35, category: 'Juices', description: 'Refreshing watermelon juice', veg: true, bestseller: false },
    { id: 'uc-9', name: 'Oreo Shake', price: 70, category: 'Shakes', description: 'Creamy milkshake with Oreo cookies', veg: true, bestseller: true },
    { id: 'uc-10', name: 'Chocolate Shake', price: 65, category: 'Shakes', description: 'Rich chocolate milkshake', veg: true, bestseller: false },
    { id: 'uc-11', name: 'Cold Coffee', price: 50, category: 'Beverages', description: 'Blended iced coffee with cream', veg: true, bestseller: true },
    { id: 'uc-12', name: 'Lemon Soda', price: 30, category: 'Beverages', description: 'Fresh lime soda, sweet or salt', veg: true, bestseller: false },
  ],
};

export const pickupTimeSlots = [
  '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
  '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
  '1:00 PM', '1:15 PM', '1:30 PM', '1:45 PM',
  '2:00 PM', '2:15 PM', '2:30 PM', '2:45 PM',
  '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM',
  '4:00 PM', '4:15 PM', '4:30 PM', '4:45 PM',
  '5:00 PM',
];

export const ORDER_STATUS = {
  PLACED: 'Placed',
  PREPARING: 'Preparing',
  PICKED_UP: 'Picked Up',
  CANCELLED: 'Cancelled',
};
