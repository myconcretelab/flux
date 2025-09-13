import PlayerSlide from './PlayerSlide';
import LibrarySlide from './LibrarySlide';
import SettingsSlide from './SettingsSlide';

export default function Slides() {
  return (
    <main id="slides" className="slides container" tabIndex={0} aria-label="Panneaux glissables">
      <PlayerSlide />
      <LibrarySlide />
      <SettingsSlide />
    </main>
  );
}

