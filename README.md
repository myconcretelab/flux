# Flux

Application web permettant de gérer et d'écouter des flux audio.
Un serveur Node.js expose les flux et les métadonnées de lecture via une API.
L'interface se compose de trois panneaux glissables :

1. **Lecteur** – contrôle de la lecture en cours.
2. **Gestion des flux** – ajout, édition, import/export et classement.
3. **Options avancées** – réglages divers de l'application.

## Fonctionnalités

- Thème aux accents bleu nuit.
- Lecture et pause d'un flux audio ; la reprise rouvre le flux au direct.
- Préparation du dernier flux écouté au démarrage, sans lecture automatique imposée.
- Liste de flux favoris ou personnalisés avec notes et format.
- Étoile activable sur chaque pad de station pour ajouter ou retirer un favori
  sans modifier la lecture en cours.
- Filtre dynamique **★ Favoris** dans le lecteur et la bibliothèque, toutes
  catégories confondues, actualisé dès qu'une étoile est ajoutée ou retirée.
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

## Recherche de radios

Le bouton flottant **+** ouvre Radio Browser en plein écran sur mobile. Recherche
par nom, filtres pays/style/langue/débit, tri et pagination sont disponibles.
Choisissez une catégorie existante ou saisissez un nouveau nom, puis ajoutez les
radios en un clic. **Personnaliser** permet de modifier nom, catégorie, favoris
et notes avant l'ajout. Les doublons sont détectés par UUID ou URL.

Le serveur interroge les miroirs Radio Browser découverts par DNS, avec délais
limités et repli sur un autre miroir. Aucun jeton API n'est nécessaire. Les flux
HTTP et HLS restent soumis aux possibilités de lecture du navigateur.

Validation : `node --test tests/radio-browser.test.js`, puis
`npm --prefix frontend run build`.

## Lecture sur iPhone et écran verrouillé

Le lecteur utilise un seul élément audio pour les radios enregistrées et les
préécoutes. Les boutons de l'application et les commandes Media Session de
l'écran verrouillé pilotent le même lecteur. Les titres reçus sont transmis à
Media Session avec le nom de la radio. Précédent/suivant parcourent la liste
filtrée affichée dans le lecteur, si le navigateur expose ces commandes.

Une pause ne cherche plus la position zéro d'un flux en direct. La reprise
ouvre une nouvelle connexion. Les erreurs réseau et les blocages de plus de
15 secondes déclenchent au maximum trois reconnexions espacées de 1, 3 et
7 secondes. Hors ligne, le lecteur attend le retour du réseau. Une pause de
l'utilisateur, une interruption iOS ou le minuteur annulent les reconnexions ;
le retour au premier plan ne force pas la lecture. Les erreurs sont affichées
dans le lecteur et consignées dans le journal.

L'API Audio Session est configurée en mode `playback` lorsqu'elle est disponible,
et ses interruptions sont traitées comme une pause.
Les commandes Media Session non prises en charge sont ignorées individuellement.
Les possibilités en arrière-plan et l'affichage des commandes dépendent encore
de la version d'iOS, du navigateur et du flux.

Validation locale :

```bash
node --test tests/radio-player.test.mjs tests/radio-browser.test.js
npm --prefix frontend run build
```

À vérifier sur un iPhone réel, dans Safari puis depuis le raccourci d'accueil :

1. Lancer une radio HTTPS, verrouiller l'écran et vérifier le nom et le titre.
2. Mettre en pause et reprendre depuis l'écran verrouillé et les écouteurs.
3. Changer de station avec précédent/suivant, lorsque ces boutons sont proposés.
4. Couper puis rétablir le réseau ; vérifier aussi qu'une pause pendant la
   reconnexion empêche la reprise automatique.
5. Après un appel ou la lecture dans une autre application, vérifier que Flux
   reste en pause jusqu'à une nouvelle commande de lecture.
6. Modifier un favori pendant la lecture, puis tester une préécoute et sa
   fermeture : aucun second lecteur ni interruption due au favori.

Les tests de navigateur sur ordinateur ne reproduisent pas la suspension iOS
ni les commandes physiques de l'écran verrouillé.
