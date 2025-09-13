export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="container">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 128 128" aria-hidden="true">
            <rect rx="24" width="128" height="128" fill="#f4f6f8"></rect>
            <circle cx="64" cy="64" r="36" fill="var(--primary)"></circle>
            <path d="M82 64c0 9.94-8.06 18-18 18s-18-8.06-18-18 8.06-18 18-18 18 8.06 18 18z" fill="#fff" opacity=".9"></path>
          </svg>
          <span>StreamDeck</span>
        </div>
      </div>
    </header>
  );
}

