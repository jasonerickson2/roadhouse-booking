
import { BrowserRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AppRoutes } from './router'
import Header from './components/feature/Header'

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <ScrollToTop />
      <Header />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
