# Flux

Application web statique permettant de gérer et d'écouter des flux audio.
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

Aucune installation n'est requise. Ouvrez simplement le fichier `index.html`
dans votre navigateur pour lancer l'application.

Pour lancer un petit serveur de développement local avec Node.js :

```bash
npx http-server .
```

## Contribution

Les contributions sont les bienvenues. Merci de respecter les points suivants :

1. Rédigez vos messages de commit en français.
2. Décrivez clairement vos modifications dans la description de la Pull Request.

## Licence

Ce projet est mis à disposition sous une licence libre. Vous pouvez l'utiliser
et le modifier à votre convenance.
