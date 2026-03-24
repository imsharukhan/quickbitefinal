import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata = {
  title: 'QuickBite – Smart Campus Food Ordering',
  description: 'Pre-order food from campus cafeterias, make digital payments, and skip the queue. The smart way to eat on campus.',
  keywords: 'campus food, cafeteria, pre-order, college food ordering',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
