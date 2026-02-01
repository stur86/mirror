import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';

// Sample content for demonstration - English source
const SAMPLE_SOURCE = `<h1>The Art of Translation</h1>
<p>Translation is far more than the mere substitution of words from one language to another. It is an art form that requires deep understanding of both cultures, nuanced comprehension of context, and the creative ability to convey not just meaning, but feeling, rhythm, and intent.</p>
<p>Throughout history, translators have served as bridges between civilizations. From the ancient scholars who translated Greek philosophy into Arabic, preserving knowledge through the Dark Ages, to modern literary translators who bring contemporary voices across linguistic boundaries, their work has shaped human understanding and cultural exchange.</p>
<p>The challenges of translation are manifold. Idioms resist literal interpretation; humor often depends on cultural context that cannot be directly transferred; poetry balances meaning against meter and rhyme. A translator must make countless decisions, each one a small act of interpretation that shapes how readers will experience the text.</p>
<p>Consider the Italian concept of "sprezzatura" - a word that captures the art of making difficult things look effortless, of studied carelessness. No single English word conveys this meaning. The translator must choose: use the Italian term and explain it, find an approximate equivalent, or describe the concept in a phrase. Each choice carries consequences.</p>
<p>Some theorists argue for "foreignizing" translations that preserve the strangeness of the original, reminding readers they are encountering another culture. Others advocate "domesticating" approaches that prioritize fluency and accessibility. Most translators navigate between these poles, making choices that serve the text and its new audience.</p>
<p>Technology has transformed the translator's craft. Machine translation offers rough drafts and handles routine documents, but literary and specialized translation still demands human judgment. The best translators use these tools while bringing irreplaceable skills: cultural knowledge, aesthetic sensitivity, and the wisdom to know when rules should be broken.</p>
<p>In an increasingly connected world, translation matters more than ever. It enables international cooperation, spreads ideas across borders, and allows us to experience literature, film, and thought from every corner of the globe. Behind every translated work stands a translator who made that connection possible.</p>
<p>The translator's art remains, at its core, an act of empathy and imagination: stepping into another language's way of seeing the world, then finding a path back to share that vision with new readers. It is invisible when done well, yet indispensable to our shared human conversation.</p>
`;

// Sample content for demonstration - Italian translation
const SAMPLE_TRANSLATION = `<h1>L'arte della traduzione</h1>
<p>La traduzione è molto più della semplice sostituzione di parole da una lingua all'altra. È una forma d'arte che richiede una profonda comprensione di entrambe le culture, una sfumata capacità di cogliere il contesto e l'abilità creativa di trasmettere non solo il significato, ma anche il sentimento, il ritmo e l'intento.</p>
<p>Nel corso della storia, i traduttori hanno fatto da ponte tra le civiltà. Dagli antichi studiosi che tradussero la filosofia greca in arabo, preservando il sapere durante i secoli bui, ai traduttori letterari moderni che portano voci contemporanee oltre i confini linguistici, il loro lavoro ha plasmato la comprensione umana e lo scambio culturale.</p>
<p>Le sfide della traduzione sono molteplici. I modi di dire resistono all'interpretazione letterale; l'umorismo spesso dipende da un contesto culturale che non può essere trasferito direttamente; la poesia bilancia il significato con la metrica e la rima. Un traduttore deve prendere innumerevoli decisioni, ognuna delle quali è un piccolo atto interpretativo che determina come i lettori vivranno il testo.</p>
<p>Si consideri il concetto italiano di "sprezzatura" — una parola che cattura l'arte di far sembrare facili le cose difficili, di una studiata noncuranza. Nessuna singola parola inglese trasmette questo significato. Il traduttore deve scegliere: usare il termine italiano e spiegarlo, trovare un equivalente approssimativo, o descrivere il concetto in una locuzione. Ogni scelta comporta conseguenze.</p>
<p>Alcuni teorici sostengono traduzioni "stranianti" che preservano l'estraneità dell'originale, ricordando ai lettori che stanno incontrando un'altra cultura. Altri propugnano approcci "addomesticanti" che privilegiano la scorrevolezza e l'accessibilità. La maggior parte dei traduttori naviga tra questi poli, facendo scelte che servono il testo e il suo nuovo pubblico.</p>
<p>La tecnologia ha trasformato il mestiere del traduttore. La traduzione automatica offre bozze grezze e gestisce documenti di routine, ma la traduzione letteraria e specializzata richiede ancora il giudizio umano. I migliori traduttori usano questi strumenti apportando competenze insostituibili: conoscenza culturale, sensibilità estetica e la saggezza di sapere quando le regole vanno infrante.</p>
<p>In un mondo sempre più connesso, la traduzione conta più che mai. Permette la cooperazione internazionale, diffonde le idee oltre i confini e ci consente di sperimentare letteratura, cinema e pensiero da ogni angolo del globo. Dietro ogni opera tradotta c'è un traduttore che ha reso possibile quella connessione.</p>
<p>L'arte del traduttore rimane, nella sua essenza, un atto di empatia e immaginazione: entrare nel modo di vedere il mondo di un'altra lingua, poi trovare un percorso per condividere quella visione con nuovi lettori. È invisibile quando è fatta bene, eppure indispensabile per la nostra conversazione umana condivisa.</p>
`;

export function App() {
  const [isDark, setIsDark] = useState(true);
  const [sourceContent] = useState(SAMPLE_SOURCE);
  const [translationContent, setTranslationContent] = useState(SAMPLE_TRANSLATION);

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
