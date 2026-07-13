import { useState, useMemo } from 'react';
import './App.css';
import { LinkCard } from './components/LinkCard';
import initialData from './data.json';

function App() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return initialData;
    
    const query = searchQuery.toLowerCase();
    return initialData.map(category => {
      const filteredLinks = category.links.filter(link => 
        link.name.toLowerCase().includes(query) || 
        link.desc.toLowerCase().includes(query)
      );
      return {
        ...category,
        links: filteredLinks
      };
    }).filter(category => category.links.length > 0);
  }, [searchQuery]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Navigation</h1>
        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Search tools, docs, and sites..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8' }}>
            <p>No results found for "{searchQuery}"</p>
          </div>
        ) : (
          filteredData.map((category, idx) => (
            <section key={idx} className="category-section">
              <h2 className="category-title">{category.category}</h2>
              <div className="links-grid">
                {category.links.map((link, linkIdx) => (
                  <LinkCard key={linkIdx} link={link} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

export default App;
