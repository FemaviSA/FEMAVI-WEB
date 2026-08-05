import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { RequireAuth } from './components/RequireAuth';
import { QuoteCartPill } from './components/QuoteCartPill';
import { WhatsAppButton } from './components/WhatsAppButton';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Catalog = lazy(() => import('./pages/Catalog'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const Quote = lazy(() => import('./pages/Quote'));
const OrderForm = lazy(() => import('./pages/OrderForm'));
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm'));
const Quotes = lazy(() => import('./pages/admin/Quotes'));
const QuoteDetail = lazy(() => import('./pages/admin/QuoteDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Articles = lazy(() => import('./pages/admin/Articles'));
const ArticleForm = lazy(() => import('./pages/admin/ArticleForm'));
const Transporte = lazy(() => import('./pages/industrias/Transporte'));
const Gastronomia = lazy(() => import('./pages/industrias/Gastronomia'));
const Edificios = lazy(() => import('./pages/industrias/Edificios'));
const Industria = lazy(() => import('./pages/industrias/Industria'));
const Limpieza = lazy(() => import('./pages/industrias/Limpieza'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PublicCartPill() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  return <QuoteCartPill />;
}

function PublicWhatsApp() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  return <WhatsAppButton />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "'DM Sans', sans-serif" } }}
      />
      <PublicCartPill />
      <PublicWhatsApp />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nosotros" element={<About />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/catalogo/categoria/:slug" element={<CategoryPage />} />
          <Route path="/catalogo/:slug" element={<ProductPage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/cotizar" element={<Quote />} />
          <Route path="/pedidos" element={<OrderForm />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/admin/products/new" element={<RequireAuth><ProductForm /></RequireAuth>} />
          <Route path="/admin/products/:id" element={<RequireAuth><ProductForm /></RequireAuth>} />
          <Route path="/admin/cotizaciones" element={<RequireAuth><Quotes /></RequireAuth>} />
          <Route path="/admin/cotizaciones/:id" element={<RequireAuth><QuoteDetail /></RequireAuth>} />
          <Route path="/admin/blog" element={<RequireAuth><Articles /></RequireAuth>} />
          <Route path="/admin/blog/new" element={<RequireAuth><ArticleForm /></RequireAuth>} />
          <Route path="/admin/blog/:id" element={<RequireAuth><ArticleForm /></RequireAuth>} />
          <Route path="/industrias/transporte" element={<Transporte />} />
          <Route path="/industrias/gastronomia" element={<Gastronomia />} />
          <Route path="/industrias/edificios" element={<Edificios />} />
          <Route path="/industrias/industria" element={<Industria />} />
          <Route path="/industrias/limpieza" element={<Limpieza />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
