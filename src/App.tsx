import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import About from './pages/About';
import Catalog from './pages/Catalog';
import ProductPage from './pages/ProductPage';
import Quote from './pages/Quote';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ProductForm from './pages/admin/ProductForm';
import Quotes from './pages/admin/Quotes';
import QuoteDetail from './pages/admin/QuoteDetail';
import { RequireAuth } from './components/RequireAuth';
import { QuoteCartPill } from './components/QuoteCartPill';

function PublicCartPill() {
  const location = useLocation();
  // No mostrar pill en rutas admin
  if (location.pathname.startsWith('/admin')) return null;
  return <QuoteCartPill />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "'DM Sans', sans-serif" } }}
      />
      <PublicCartPill />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/catalogo/:slug" element={<ProductPage />} />
        <Route path="/cotizar" element={<Quote />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/admin/products/new" element={<RequireAuth><ProductForm /></RequireAuth>} />
        <Route path="/admin/products/:id" element={<RequireAuth><ProductForm /></RequireAuth>} />
        <Route path="/admin/cotizaciones" element={<RequireAuth><Quotes /></RequireAuth>} />
        <Route path="/admin/cotizaciones/:id" element={<RequireAuth><QuoteDetail /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
