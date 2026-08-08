# Kispályás bajnokság – admin és publikus felület

React + Supabase alapú webalkalmazás 6 csapatos kispályás bajnokság
mérkőzéseinek adminisztrálásához és élő állásának megjelenítéséhez.

## Felépítés

- `/` – publikus nézet: élő mérkőzések, tabella, menetrend. Realtime
  feliratkozással, F5 nélkül frissül minden gólnál.
- `/admin` – admin nézet: bejelentkezés után mérkőzés indítása, gól/
  büntető rögzítése, mérkőzés lezárása.

## Előfeltételek

1. Egy Supabase projekt ([supabase.com](https://supabase.com)).
2. A korábban elkészített `schema.sql` lefuttatva a Supabase SQL
   editorában (táblák: `teams`, `matches`, `match_events`; view-k:
   `match_scores`, `match_results`, `standings`).

## Gyors indulás

```bash
npm install
cp .env.example .env
# töltsd ki a .env fájlt a Supabase projekt URL-jével és anon kulcsával
# (Supabase Dashboard → Project settings → API)
npm run dev
```

## Admin felhasználó létrehozása

Az admin felület a Supabase Auth email/jelszó bejelentkezését
használja. Hozz létre egy admin felhasználót:

Supabase Dashboard → Authentication → Users → **Add user**, majd add
meg az admin e-mail címét és jelszavát.

## Row Level Security – szükséges minimum

Alapból egy Supabase tábla RLS-sel védett, tehát írás/olvasás nélküle
nem működik. Ez a gyors induláshoz elég kiindulópont (a finomhangolt
policy-ket – pl. csak a saját meccséhez írhasson egy bíró – külön
lépésben érdemes kidolgozni):

```sql
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- Mindenki olvashatja (publikus nézethez)
CREATE POLICY "Publikus olvasás" ON teams FOR SELECT USING (true);
CREATE POLICY "Publikus olvasás" ON matches FOR SELECT USING (true);
CREATE POLICY "Publikus olvasás" ON match_events FOR SELECT USING (true);

-- Csak bejelentkezett admin írhat
CREATE POLICY "Admin írás" ON match_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin írás" ON matches FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin módosítás" ON matches FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admin törlés" ON matches FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin írás" ON teams FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin módosítás" ON teams FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admin törlés" ON teams FOR DELETE
  USING (auth.role() = 'authenticated');
```

A csapatok és a menetrend admin felülete (hozzáadás, szerkesztés,
törlés, automata sorsolás) ezekre a policy-kre épül – nélkülük a
Supabase alapból minden ilyen műveletet elutasít.

## Csapatok és menetrend felvitele

Az admin felület **Csapatok** és **Menetrend** fülén mindkettő
kezelhető, SQL nélkül:

- **Csapatok**: hozzáadás, átnevezés, törlés. Ha egy csapatnak már
  van felvitt mérkőzése, a törlés hibaüzenetet ad (a `matches` tábla
  idegenkulcs-kényszere miatt) – előbb a mérkőzéseit kell törölni
  vagy a menetrendet újrasorsolni.
- **Menetrend**: a *Menetrend generálása* gomb körmérkőzéses
  (mindenki mindenkivel egyszer) sorsolást készít a felvitt
  csapatokból. Megadható az első mérkőzésnap dátuma, a kezdés
  időpontja, a naponta lejátszott fordulók száma (pl. 2 forduló/nap
  6 csapatnál = 6 mérkőzés egy napon), a mérkőzésnapok közötti
  napok száma, és hogy egy pályán belül hány perc teljen el két
  mérkőzés között. A generátor a mérkőzéseket **A és B pályára**
  osztja el felváltva, hogy két meccs is futhasson párhuzamosan.
  Ha már van `upcoming` státuszú mérkőzés, az újragenerálás lecseréli
  azokat (az élő és lezárt meccseket nem érinti). Ezen kívül
  egyenként is felvehető, módosítható (dátum, időpont, pálya) és
  törölhető mérkőzés – a pálya kötelező mező, generálásnál és kézi
  felvitelnél is.

### Migráció – ha korábban már lefuttattad a séma első verzióját

Ha a Supabase projektedben már létezik a `matches` tábla `court`
oszlop nélkül, ezt kell futtatnod az SQL editorban (a friss
`schema.sql` már tartalmazza ezt egy új projektnél):

```sql
ALTER TABLE matches ADD COLUMN court TEXT NOT NULL DEFAULT 'A' CHECK (court IN ('A', 'B'));
ALTER TABLE matches ALTER COLUMN court DROP DEFAULT;

CREATE OR REPLACE VIEW match_results AS
SELECT
    m.id AS match_id,
    m.status,
    m.scheduled_at,
    ht.name AS home_team,
    at_.name AS away_team,
    COALESCE(hs.goals, 0) AS home_goals,
    COALESCE(as_.goals, 0) AS away_goals,
    m.court
FROM matches m
JOIN teams ht  ON ht.id  = m.home_team_id
JOIN teams at_ ON at_.id = m.away_team_id
LEFT JOIN match_scores hs  ON hs.match_id  = m.id AND hs.team_id  = m.home_team_id
LEFT JOIN match_scores as_ ON as_.match_id = m.id AND as_.team_id = m.away_team_id;
```

A `court`-ot szándékosan tettük a `SELECT` lista **végére**: a
Postgres a `CREATE OR REPLACE VIEW`-nál csak a meglévő oszlopok
végéhez enged újat hozzáfűzni, a sorrendjüket nem enged megváltoztatni
("cannot change name of view column ... to ..." hiba, ha valamelyik
oszlop más pozícióba kerülne). Ha a fenti view-t korábban már más
oszlopsorrenddel próbáltad lecserélni és hibát kaptál, ez a verzió
már rendben lefut.

A `DEFAULT 'A'` csak a meglévő sorok feltöltésére kell; utána
eltávolítjuk, hogy minden új mérkőzésnél kötelező legyen explicit
pályát választani.

## Build

```bash
npm run build
```

A `dist/` mappa bármelyik statikus hosztra feltölthető (pl. Vercel,
Netlify, Cloudflare Pages).

## Futtatás Dockerben

A `Dockerfile` egy két lépcsős (multi-stage) buildet végez: először egy
`node:20-alpine` image-ben lefordítja az alkalmazást, majd egy
`nginx:alpine` image-ben szolgálja ki a statikus fájlokat.

**Fontos:** a Vite a `VITE_*` környezeti változókat build időben égeti
be a kódba, nem futásidőben olvassa. Emiatt ezeket build argumentumként
kell átadni, és ha a Supabase URL vagy kulcs változik, az image-et
újra kell buildelni.

### docker compose-zal (ajánlott)

A `docker-compose.yml` automatikusan beolvassa a projekt gyökerében
lévő `.env` fájlt:

```bash
cp .env.example .env   # ha még nincs kitöltve
docker compose up --build
```

Az alkalmazás ezután a `http://localhost:8080` címen érhető el.

### sima docker build/run-nal

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=<supabase-url> \
  --build-arg VITE_SUPABASE_ANON_KEY=<supabase-anon-key> \
  -t foci-bajnoksag .

docker run -p 8080:80 foci-bajnoksag
```

## Élesítés Cloudflare Pages-re (ingyenes, Docker nélkül)

Az alkalmazás statikus fájlokra fordul (a `dist/` mappára), a Docker
image-ben a nginx is csak ezeket szolgálja ki – élesítéshez emiatt
nem feltétlenül kell a konténer, egy statikus hoszt egyszerűbb és a
Cloudflare Pages ingyenes csomagja korlátlan sávszélességet ad.

### 1. Kód felküldése GitHub-ra

Ha a projekt még nincs Git repóban:

```bash
cd foci-bajnoksag
git init
git add .
git commit -m "Kezdeti commit"
git branch -M main
git remote add origin https://github.com/<felhasznalonev>/foci-bajnoksag.git
git push -u origin main
```

### 2. Projekt létrehozása a Cloudflare dashboardon

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. **Create application** → **Pages** → **Connect to Git**
3. Válaszd ki a `foci-bajnoksag` repót

### 3. Build beállítások

| Mező | Érték |
|---|---|
| Framework preset | Vite (általában automatikusan felismeri) |
| Build command | `npm run build` |
| Build output directory | `dist` |

### 4. Környezeti változók

Még az első build előtt (**Settings → Environment variables**) add
meg ugyanazt a két változót, ami a `.env` fájlban is van – ezeket a
Vite build időben égeti a kódba, tehát build előtt kell léteznie:

| Változó | Érték |
|---|---|
| `VITE_SUPABASE_URL` | a Supabase projekted URL-je |
| `VITE_SUPABASE_ANON_KEY` | a Supabase projekted anon kulcsa |

### 5. Deploy

**Save and Deploy** – a Cloudflare lehúzza a repót, lefuttatja a
buildet, és pár másodperc múlva élesben lesz egy
`https://foci-bajnoksag.pages.dev` jellegű címen. Minden `main`
branch-re történő push-nál automatikusan újra deployol.

A `public/_redirects` fájl (ami már a projektben van) gondoskodik
róla, hogy a `/admin` közvetlen megnyitása vagy frissítése is
működjön – enélkül a React Router kliensoldali útvonalai 404-et
adnának Cloudflare Pages-en.

### Hibaelhárítás – "Vite version ... cannot be automatically configured"

2026 folyamán a Cloudflare a klasszikus Pages felületet fokozatosan
egy egységes "Workers Builds" rendszerre cseréli. Ha a projekted már
ezen az új felületen jött létre, nem lesz külön "Framework preset"
mező a beállításoknál – helyette egy automatikus konfiguráló fut le,
ami megpróbálja a `@cloudflare/vite-plugin`-t bedrótozni, ez viszont
Vite 6+-at igényel, és ezért ezzel a hibával áll le:

```
[ERROR] The version of Vite used in the project ("5.4.21") cannot be
automatically configured. Please update the Vite version to at
least "6.0.0" and try again.
```

Ez a projekt egy sima statikus build, nincs szüksége a Cloudflare
Vite plugin-jére. A `wrangler.jsonc` fájl (ami már a projektben van)
ezt előre, explicit módon beállítja, így az automatikus konfiguráló
ki sem fog futni, és a Vite verziót sem kell frissíteni. A
`not_found_handling: "single-page-application"` beállítás ugyanazt
a szerepet tölti be, mint a `public/_redirects` fájl: a `/admin`
útvonal közvetlen megnyitásánál is az `index.html`-t szolgálja ki.

Ha a hiba a `wrangler.jsonc` felküldése után is jelentkezik, érdemes
egy üres commit-tal újra triggerelni a buildet (a Cloudflare néha a
korábbi, gyorsítótárazott build-konfigurációt használja az első
próbálkozásnál).

### 6. Egyedi domain (opcionális)

**Custom domains** fülön hozzáadhatod a saját domainedet, a Cloudflare
automatikusan kiállítja hozzá az SSL tanúsítványt.
