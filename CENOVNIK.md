# Turnir Kula — Cenovnik i ponuda

Web aplikacija za organizovanje fudbalskih turnira (3v3 i sl.), sa
realtime rezultatima, fantazi igrom, automatskim žrebom, eliminacijama,
posterima za društvene mreže i admin panelom.

---

## 1. Šta sve aplikacija ima

### Za posetioca (svako ko otvori sajt)

**Početna stranica**
- Pre žreba: lista prijavljenih ekipa (sa grbovima, klikabilno)
- Tokom odbrojavanja: vidljiv tajmer "Žreb počinje za HH:MM:SS"
  i plavo dugme "Otvori žreb"
- Nakon žreba: pregled trenutnih mečeva uživo, narednih i nedavno
  završenih, top 3 po grupi i top strelci
- Popup reklama (paljiv/gasiv iz admina)

**Žreb uživo (`/draw`)**
- Sinhronizovano odbrojavanje na svim uređajima (telefon + ekran u sali)
- Cinematic animacija: intro → priprema → izvlačenje sa "mystery crest"
  efektom (crni štit treperi bojama pa otkrije tim) → finale sa
  konfetima i prikazom svih grupa

**Rezultati i tabele**
- Lista svih mečeva sa filterom po kolu i statusu (LIVE / zakazano / završeno)
- Detalj meča: sat uživo, tok meča (gol/karton/asistencija sa minutom),
  formacije timova, forma poslednjih 3 meča
- Tabele po grupama sa svim tiebreaker-ima (poeni, gol-razlika,
  postignuti golovi, ime)
- Bracket sa eliminacionim stablom (osmina/četvrtfinale/polufinale/finale + 3. mesto)

**Statistike**
- Lista igrača sortirana po golovima, asistencijama, kartonima ili fantasy ceni
- Profil igrača: sve sezonske statistike + razrada bodova po kolu
- Profil tima: roster, istorija mečeva (W/D/L badžovi), poslednji rezultati

**Fantasy liga**
- Sastavljanje tima od 3 igrača u okviru budžeta (početak 30M)
- Pitch view: dresovi u bojama klubova na zelenom terenu
- Klik na dres → modal sa razradom bodova ("2× Gol = +8", itd.)
- Aktivno kolo: veliki broj bodova ovog kola + manji "ukupno"
  prikazuje se tek pošto kolo počne
- Oznaka "Tek igra" za igrače čija ekipa još nije nastupila u kolu
- Privatne lige: kreiranje preko invite koda, leaderboard, klik na člana
  za pregled njegovog tima kroz sva kola (kao pitch)
- Istorija tima (snapshot po kolu)
- Auto-naplata cena igrača nakon svakog kola (poskupljuje/pojeftinjuje
  na osnovu performanse)
- Tim se prenosi kroz kola dok ga korisnik ne promeni

**Autentikacija**
- Email + lozinka registracija
- Prijava preko Google naloga (OAuth)
- Reset lozinke

### Za organizatora (admin panel)

**Pregled (`/admin`)**
- Statistike: broj timova/igrača/kola/mečeva
- Live mečevi sa quick-link na live entry
- Toggle za popup reklamu na sajtu

**Timovi**
- CRUD operacije sa imenom, skraćenicom (3-4 znaka), primarnom i sekundarnom bojom
- Live preview grba dok biraš boje

**Igrači**
- CRUD igrača sa pridruživanjem timu
- Upload slike (auto-resize na max 400px, optimizovana JPEG kompresija)
- Batch editovanje kroz tabelu

**Žreb**
- *Cinematic mod*: zakazuješ za određeni datum/vreme, broj grupa
  2-8, korisnici na sajtu vide odbrojavanje, na T-0 počne animacija
- Promena broja grupa moguća sve dok odbrojavanje traje
- Otkazivanje zakazanog žreba
- *Ručni mod*: ručno raspoređuješ ekipe u grupe sa auto-fill helper-om
- Automatski generiše sva kola grupne faze i mečeve

**Raspored**
- Drag-and-drop premestanje mečeva između kola
- Zaključana kola ne prihvataju nove mečeve

**Mečevi**
- Lista svih mečeva po kolima, set/clear vreme početka
- Bulk-fill kickoff vremena (start time + interval)
- Pokreni / Završi pojedinačni meč

**Live unos meča**
- Sat uživo (1. poluvreme → pauza → 2. poluvreme → finiš)
- Panel po timu sa **odvojenim dugmadima** za svaki tip događaja:
  - Tim X postiže gol → popup sa strelcem i opcionim asistentom
  - Tim X autogol → popup sa igračem
  - Tim X žuti karton → popup
  - Tim X crveni karton → popup
- Minut se automatski povlači iz sata meča
- Soft-delete događaja
- **Produžeci i penali za nokaut neresene mečeve**:
  - "Idi na produžetke (2×5 min)" sa zasebnim sat-om
  - Ako i posle ET izjednačeno → unos rezultata penal-šuta
  - Pobednik se automatski propagira u sledeći krug bracket-a
- Realtime sync svih golova na sve uređaje

**Eliminacije / Bracket**
- Generiše knockout strukturu (2/4/8/16 timova, opcioni meč za 3. mesto)
- Ručno postavljanje slot-ova (ako želiš override)
- Lock grupne faze: zamrzava placeholdere, ali manuelni override ostaje
- Auto-resolve placeholders kako se grupna faza završava

**Fantasy admin**
- Manuelna rekalkulacija bodova po kolu
- Auto-recalc se dešava na svaku promenu match event-a

**Export postera (1080×1920 Story / 1080×1350 Objava)**
- **Rezultati**: izabranog kola, filter mečeva, opcioni override naslova
- **Tabele**: sve grupe sa O / GR / Bod kolonama
- **Strelci**: top 10 sa medaljnim chip-ovima
- Sve generiše server preko Vercel Satori-ja (pixel-perfect, ne treba dizajner)

**Danger zone**
- Soft reset (ostavlja timove + igrače + slike, briše rezultate i žreb)
- Full reset (briše sve)
- Load demo (4 demo ekipe sa igračima za testiranje)

---

## 2. Tehnička osnova

- Hosting: Vercel (uvek dostupno, automatski HTTPS, custom domen po želji)
- Baza: Supabase Postgres + Realtime + Auth + Storage
- Frontend: Next.js 14 + Tailwind, mobile-first responsive
- Auth: email/lozinka i Google OAuth
- Sve cene su 1-decimalne, fantasy budžet matematički nepropustljiv
- Backup baze: automatski (Supabase)
- Realtime: WebSocket-ovi, prosečno < 200ms za sve klijente

---

## 3. Cenovnik

> Sve cene su u **RSD** i odnose se na korišćenje aplikacije tokom celog
> turnira (~3 nedelje). Hosting, domen, baza i podrška uključeni.
> Cenovnik je orijentaciono baziran na prošlogodišnjem budžetu turnira
> (14 ekipa × 7.000 RSD kotizacije + sredstva opštine).

### Tržišna referenca

| Stavka | Cena |
|---|---|
| **Standalone mesečna pretplata** (referentna cena za kupca van Kule) | **70.000 RSD / mesec** |
| Custom razvoj iste aplikacije od nule (jednokratno, drugom programeru) | 500.000 – 1.000.000 RSD |
| Strane SaaS alternative (Joomla, SportsManager itd., bez fantasy + ne na srpskom) | 50–200 EUR/mesec |

Mesečna pretplata podrazumeva: pun pristup aplikaciji, custom domen,
podršku, podešavanja, garantovan rad 99.5% vremena.

### Paketi za Turnir Kula (3 nedelje korišćenja)

#### Paket A — **Full**
**25.000 RSD**

Sve što je gore opisano — kompletna aplikacija sa fantazijem, žrebom,
posterima, live unosom, eliminacijama, sve.

- Custom brendiranje (logo, naziv turnira, sponzori footer)
- Početno setapovanje (uneću sve ekipe i igrače za vas)
- Tehnička podrška svaki dan tokom turnira
- Pristup admin panelu za 2-3 osobe iz organizacije
- Reklamni prostor za sponzore koje organizator dovede (banner na početnoj)

#### Paket B — **Standard (bez fantasy modula)**
**14.000 RSD**

Sve iz Paketa A **osim fantasy lige** — fantasy sekcija je potpuno
sklonjena. Idealno ako se ne planira fantasy ili je publika manje
tehnički orijentisana.

Šta ostaje: žreb uživo, rezultati uživo, tabele, strelci, bracket,
mobilni live unos, posteri za Instagram, admin panel, sve realtime.

#### Paket C — **Standard + naše reklame**
**5.000 RSD**

Paket B (bez fantazija) + organizator dozvoljava da se na sajtu
prikazuje moja reklama (proizvod od meda/cvekle/đumbira/soli, "preworkout
domaći" — biće pušten u prodaju neposredno pre turnira).

Konkretno:
- Popup reklama proizvoda jednom po posetiocu dnevno
- Banner u footer-u svake stranice
- Ja vam štampam jedan baner/roll-up (1m × 2m) za teren — ide na vaš teren
  zajedno sa vašim banerima

Drastičan popust jer mi vredan promotivni prostor (reklamno mesto vredi
mi ~9.000 RSD u trajanju turnira).

#### Paket D — **Full + besplatna kotizacija za moju ekipu**
**22.000 RSD**

Paket A (kompletna aplikacija) + moja ekipa nastupa na turniru **bez
kotizacije** (vrednost 7.000 RSD).

Ako biste posebno naplatili Paket A (25k) i kotizaciju (7k), bilo bi
ukupno 32.000 RSD. Sa Paketom D plaćate 22k = popust od 10.000 RSD.

> Ovo je interesantan paket samo ako ste sigurni da imam svoju ekipu na
> turniru. Ako ne, idite na Paket A.

---

## 4. Šta dobijate u svakom paketu

Bez obzira koji paket izaberete:

- Aplikacija je live na vašem domenu (npr. `turnirkula.rs` ako kupite
  domen, ili na našem free subdomenu `turnir-kula-2026.vercel.app`)
- Custom logo i boje turnira u zaglavlju
- Početna konfiguracija (svi timovi, igrači, raspored) sam vam unosim
- Tutorijal za admin paneli (1h sastanak ili screencast)
- Telefonska podrška tokom celog trajanja turnira
- Bekap svih podataka posle završetka (možete da zadržite ili da
  arhivu prebacite negde drugde ako želite)
- Custom email šablon za podsetnike igračima (ako koristite mail)

---

## 5. Šta dobijate bonus (procena vrednosti)

**Više prijavljenih ekipa**
- Prošla godina: 14 ekipa × 7.000 = 98.000 RSD od kotizacije, marketing
  samo preko Instagram-a organizatora
- Sa aplikacijom: profesionalan sajt, ima i fantasy ligu (privlači
  rekreativce iz okoline), automatski generišu posteri za Instagram
  posle svakog meča → veća vidljivost → realno **18-22 ekipa**
- Pri 20 ekipa × 7.000 = 140.000 RSD = **+42.000 RSD** dodatnog prihoda
  samo od kotizacije

**Sponzori**
- Profesionalan sajt = ozbiljniji utisak na potencijalne sponzore
- Banner spot na sajtu = vredan promotivni prostor (lokalne firme:
  Apoteka, Mesara, Frizerski salon u Kuli — već su zainteresovane za
  promociju)
- Realna procena: 2-4 mala lokalna sponzora × 10-20k = **30-80k RSD**
- Plus jedan veći sponzor (Banka, Telekom...) — opciono +50-200k

**Smanjenje rada organizacije**
- Bez aplikacije: ručno unos rezultata u WhatsApp, ručno ažuriranje
  tabela, mailing svima posebno
- Sa aplikacijom: rezultat upišeš jednim klikom, sve se ažurira
  automatski + auto-generišeš postere za Instagram → organizator štedi
  ~15h rada tokom turnira

---

## 6. Predlog za organizatore

Najbolji izbor zavisi od situacije:

| Ako... | Idite na... |
|---|---|
| Hoćete da to ide kao prošle godine, samo malo bolje | **Paket B** (14k) |
| Hoćete da privučete više učesnika i sponzore | **Paket A** (25k) |
| Imate uži budžet i u redu vam je da imam svoje reklame | **Paket C** (5k) |
| Hoćete sve i da moja ekipa igra bez plaćanja | **Paket D** (22k) |

---

## 7. Šta nije uključeno

- Štampani materijal (osim banera iz Paketa C ako se ugovori)
- Logo dizajn (mogu da preporučim dizajnera za ~10k ako treba)
- Foto/video aparat tokom turnira
- Hrana, piće, nagrade — to je vaše

---

## 8. Plaćanje

- 50% pri potpisivanju, 50% u prvoj nedelji turnira
- Plaćanje preko računa (firma ili ručno na tekući račun)
- Bez ugovora — usmeni dogovor + email potvrda dovoljni za prvi turnir;
  za buduće sezone možemo pisani ugovor

---

## 9. Kontakt

Za pregled, demo ili dogovor:
- Email: nikola.letvencuk@invt.tech
- Live demo: https://turnir3x3.vercel.app (trenutni live build)

Mogu da dođem u Kulu, donesem laptop i demonstriram aplikaciju uživo
za 30-45 min sastanka.
