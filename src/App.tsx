import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';

// Sample content for demonstration
const SAMPLE_SOURCE = `<h1>Welcome to Mirror</h1>
<p>Mirror is an AI-assisted translation editor designed for pleasant, focused work.</p>
<p>This is the source text pane. It displays the original content that needs to be translated. The text here is read-only.</p>
<h2>Features</h2>
<ul>
<li>Split-pane editor with source and translation views</li>
<li>Synchronized scrolling by paragraph</li>
<li>WYSIWYG markdown editing</li>
<li>Dark and light theme support</li>
</ul>
<p>Try scrolling this pane and watch the translation pane follow along when scroll sync is enabled.</p>
<blockquote>Translation is not just about converting words, but conveying meaning and intent across cultures.</blockquote>
<p>The editor supports various formatting options including <strong>bold</strong>, <em>italic</em>, and <code>inline code</code>.</p>`;

export function App() {
  const [isDark, setIsDark] = useState(true);
  const [sourceContent] = useState(SAMPLE_SOURCE);
  const [translationContent, setTranslationContent] = useState('');

  useEffect(() => {
    document.body.classList.toggle('bp6-dark', isDark);
  }, [isDark]);

  const handleThemeToggle = () => setIsDark(!isDark);

  return (
    <Layout onThemeToggle={handleThemeToggle} isDark={isDark}>
      <TranslationEditor
        sourceContent={sourceContent}
        translationContent={translationContent}
        onTranslationChange={setTranslationContent}
      />
    </Layout>
  );
}
