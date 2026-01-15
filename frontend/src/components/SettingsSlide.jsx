import { Box, Button, Card, CardContent, Typography } from '../mui'

export default function SettingsSlide({ settings, setSettings, onSeed, onNuke, version }) {
  return (
    <Box component="section" aria-labelledby="settings-title" sx={{ scrollSnapAlign: 'start', flex: '0 0 100%', px: { xs: '8px', sm: '16px' }, pb: '64px' }}>
      <Typography id="settings-title" component="h1" sx={{ fontSize: 20, my: '8px', mx: '4px' }}>Options avancées</Typography>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Réseau & compatibilité iOS</Typography>
          <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!settings.tryHttp} onChange={(e) => setSettings({ ...settings, tryHttp: e.target.checked })} /> Essayer le HTTP si HTTPS échoue
          </label>
          <Typography className="muted" sx={{ color: 'var(--muted)', fontSize: 12, mt: 1 }}>
            Sur une page <strong>HTTPS</strong>, les flux <code>http://</code> sont bloqués par iOS.
            Servez cette appli en <strong>HTTP</strong> (réseau local) pour lire ces flux.
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', mb: 2 }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Interface</Typography>
          <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={!!settings.compactList} onChange={(e) => setSettings({ ...settings, compactList: e.target.checked })} /> Liste compacte</label>
          <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={!!settings.haptics} onChange={(e) => setSettings({ ...settings, haptics: e.target.checked })} /> Retour haptique (si dispo)</label>
          <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={!!settings.autoResume} onChange={(e) => setSettings({ ...settings, autoResume: e.target.checked })} /> Reprendre automatiquement le dernier flux</label>
          <label className="mui-switch" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={!!settings.showLockInfo} onChange={(e) => setSettings({ ...settings, showLockInfo: e.target.checked })} /> Afficher titre sur l’écran verrouillé</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>Couleur du lecteur (par défaut)
            <input type="color" value={settings.playerBg || '#f7f8fa'} onChange={(e) => setSettings({ ...settings, playerBg: e.target.value })} />
          </label>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        <CardContent>
          <Typography component="h2" sx={{ fontSize: 16, m: 0, mb: 1 }}>Divers</Typography>
          <Box sx={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button size="small" onClick={onSeed} sx={{ border: '1px solid var(--border)', borderRadius: '12px', background: '#fff' }}>Insérer des exemples (FIP, etc.)</Button>
            <Button size="small" onClick={onNuke} sx={{ background: 'var(--danger)', color: '#fff' }}>Tout réinitialiser</Button>
          </Box>
          <Typography className="muted" sx={{ color: 'var(--muted)', fontSize: 12, mt: 1 }}>Version <span>{version}</span></Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
