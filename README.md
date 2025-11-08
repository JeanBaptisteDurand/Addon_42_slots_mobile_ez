# 42 Slots Mobile Manager — README

Addon mobile pour simplier les slots sur mobile (protection minimum 30 min et auto adjust sur les quart dheures)

## 🔧 1) Pré-requis

- **Android + Firefox for Android** (version récente) installé.  
- Accès à la page **https://profile.intra.42.fr/slots** où tu es déjà connecté.  
- Le **userscript** (le code du script `42 Slots Mobile Manager`) copié dans le presse-papier.  
- Si ton Firefox ne propose pas **Tampermonkey**, prends **Violentmonkey** (même usage).  
  Les deux sont disponibles sur le site des modules Firefox (AMO).

> 💡 Si ta version de Firefox ne permet pas les extensions, installe **Firefox Nightly**  
> ou utilise **Kiwi Browser** / **Bromite** (Android) qui supportent les extensions Chrome.

---

## ⚙️ 2) Installer l’extension userscript (Tampermonkey / Violentmonkey)

1. Ouvre **Firefox** sur ton mobile.  
2. Va dans le menu (⋮) → **Add-ons** (ou tape `about:addons` dans la barre d’adresse).  
3. Recherche **Tampermonkey** ou **Violentmonkey** et installe-la (**Add to Firefox**).  
4. Une fois installée, tu devrais voir l’icône de l’extension dans le menu Add-ons.

---

## 📄 3) Ajouter le userscript

1. Ouvre l’extension (Menu → Add-ons → Tampermonkey/Violentmonkey → **Ouvrir**).  
2. Choisis **Create a new script** (ou **New → Script**).  
3. Efface tout le contenu et **colle le code complet** du script *42 Slots Mobile Manager*.  
4. Vérifie la ligne :
```
@match https://profile.intra.42.fr/slots
```
Si tu veux qu’il s’exécute aussi ailleurs, ajuste le `@match`.  
5. Clique sur **Save**.  
6. Donne un nom clair : **42 Slots Mobile Manager**.

---

## 🚀 4) Autoriser / activer et tester

1. Ouvre un nouvel onglet et va sur **https://profile.intra.42.fr/slots**.  
2. L’extension injecte automatiquement le script (si le `@match` est correct).  
3. Tu verras apparaître en bas de l’écran un **panneau flottant**.  

### 🔍 Test rapide
- Remplis **Begin / End** (`datetime-local`),  
- Vérifie ou saisis ton **User ID** (auto-détecté via cookie),  
- Clique **Poster**.  
- Regarde le message de succès / erreur.  
- Vérifie sur la page 42 que le slot est bien visible.

> Pour le premier test, crée un **slot non critique** (facile à supprimer ensuite).

---

## 🧩 5) Nouvelles fonctionnalités (par rapport à la version précédente)

### ✅ Création de slot
- Création simple : `Begin`, `End`, `User ID`  
- Arrondi automatique à la granularité **15 min**  
- Vérification de durée minimale (**30 min**)  
- Auto-détection du `user_id` via cookie  

### 🔄 Lecture / Liste
- Charge tes slots sur une **période donnée** (`start` / `end`).  
- Affiche chaque slot avec :  
- **Début**, **Fin**, **ID**, **Groupe** (si plusieurs IDs liés).  
- Affiche le nombre total de slots trouvés.  

### ❌ Suppression
- **Supprimer un slot** spécifique via son ID.  
- **Supprimer un groupe complet** (plusieurs IDs liés).  
- Confirmation visuelle du succès / échec.  
- Rafraîchissement automatique de la liste après suppression.

### 🪶 Interface mobile améliorée
- Panneau flottant **responsive**, adapté aux écrans Android.  
- Navigation fluide, boutons espacés et lisibles.  
- Sauvegarde temporaire des dates de recherche (par défaut : aujourd’hui → +7 jours).  

---

## 🧰 6) Si l’UI n’apparaît pas / problèmes courants

- Vérifie que le script est **activé** pour le site (`@match` correct).  
- Recharge la page (balaye vers le bas ou redémarre Firefox).  
- Si le **CSRF** n’est pas trouvé, reconnecte-toi à `profile.intra.42.fr`.  
- Si tu as une erreur `4xx` : ouvre la console (si dispo) ou consulte les logs Tampermonkey.  
- Si Firefox bloque l’extension, installe **Violentmonkey** ou **Kiwi Browser**.

---

## 🔐 7) Sécurité & bonnes pratiques

- Garde ce script **strictement privé** : il agit avec **ton compte 42**.  
- Ne **commite** jamais le script ou tes **cookies**.  
- Fais toujours un test manuel avant d’automatiser.  
- Respecte les **règles de la plateforme** :  
- slots ≥ 30 min,  
- granularité de 15 min,  
- maximum 2 semaines d’avance.  

---

## 💡 Bonus possibles (non inclus mais faciles à ajouter)

- Mode **multi-création** (créer plusieurs slots sur plusieurs jours).  
- Thème **sombre** automatique.  
- Sauvegarde locale des paramètres (`user_id`, dates par défaut).  
- Bouton “Supprimer tous les slots de la semaine”.

Si tu veux une de ces options, il suffit de l’ajouter dans le script — demande-moi laquelle et je te génère la version correspondante.

---
