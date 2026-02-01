import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';

// Sample content for demonstration
const SAMPLE_SOURCE = `<h1>Lorem Ipsum</h1>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ac maximus nunc, id rutrum tellus. 
Cras pellentesque auctor quam ac laoreet. Praesent diam mi, pharetra nec vestibulum sagittis, pulvinar luctus metus. 
Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec sed velit diam. 
Duis non ornare sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
Nunc sit amet odio vulputate, accumsan ex non, dapibus dui. Vestibulum nec arcu a sem tempor semper in a justo. 
In volutpat id ligula at dictum. Nunc eget purus non dolor ultricies maximus. Sed finibus et enim eu mattis. 
Praesent velit ex, auctor vitae leo fermentum, facilisis fringilla ligula. Maecenas blandit in tortor sed sodales. 
Aliquam erat volutpat.</p>
`;

export function App() {
  const [isDark, setIsDark] = useState(true);
  const [sourceContent] = useState(SAMPLE_SOURCE);
  const [translationContent, setTranslationContent] = useState(SAMPLE_SOURCE);

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
