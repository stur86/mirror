import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';

export function App() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.body.classList.toggle('bp6-dark', isDark);
  }, [isDark]);

  const handleThemeToggle = () => setIsDark(!isDark);

  return (
    <Layout onThemeToggle={handleThemeToggle} isDark={isDark}>
      {/* Main content area - empty for now */}
    </Layout>
  );
}
