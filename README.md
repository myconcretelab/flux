# Flux

Application web permettant de gérer et d'écouter des flux audio.
Un serveur Node.js expose les flux et les métadonnées de lecture via une API.
L'interface se compose de trois panneaux glissables :

1. **Lecteur** – contrôle de la lecture en cours.
2. **Gestion des flux** – ajout, édition, import/export et classement.
3. **Options avancées** – réglages divers de l'application.

## Fonctionnalités

- Thème aux accents bleu nuit.
- Lecture/Pause/Stop d'un flux audio avec réglage du volume.
- Reprise automatique du dernier flux écouté.
- Liste de flux favoris ou personnalisés avec notes et format.
- Import et export de la liste au format JSON.
- Vérification du presse‑papier à l'ouverture du panneau « Gestion des flux » :
  si une URL valide y est détectée, elle est collée automatiquement dans le champ "URL".

## Utilisation

Installez les dépendances puis lancez le serveur :

```bash
npm install
npm start
```

Le serveur sauvegarde les flux dans `streams.json` (ignoré par Git) et
fournit les routes :

- `GET /api/streams` – liste des flux enregistrés.
- `PUT /api/streams` – remplacement de la liste des flux.
- `GET /api/metadata?url=...` – informations ICY sur le flux en cours.

## Contribution

Les contributions sont les bienvenues. Merci de respecter les points suivants :

1. Rédigez vos messages de commit en français.
2. Décrivez clairement vos modifications dans la description de la Pull Request.

## Licence

Ce projet est mis à disposition sous une licence libre. Vous pouvez l'utiliser
et le modifier à votre convenance.
