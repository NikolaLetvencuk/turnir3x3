# Turnir Kula — Biznis plan (v0.1)

> Početna verzija. Sve brojke su procene, kalibriraj na osnovu prvih
> nekoliko prodaja. Sekcije sa **[?]** zahtevaju da dopuniš ili odlučiš.

---

## 1. Šta je ovo

**Turnir Kula** je web aplikacija (SaaS) za organizovanje malih i
srednjih fudbalskih turnira — primarno format 3 na 3, ali primenljiva
i na manje 5 na 5 ili turnirske formate van fudbala.

Aplikacija pokriva ceo životni ciklus turnira:
- Unos timova i igrača
- Sinhronizovan žreb sa animacijom uživo
- Raspored mečeva, grupna faza, eliminacije (sa produžecima i penalima)
- Live unos rezultata sa telefona
- Automatsko ažuriranje tabela, top strelaca, eliminacionog stabla
- Fantasy liga sa privatnim ligama
- Eksport postera za Instagram (Story i Feed format)

Web sajt je već u produkciji: `turnir3x3.vercel.app`.

---

## 2. Problem koji rešava

Trenutno stanje kod 90% lokalnih turnira:
- Rezultati se šalju u WhatsApp grupe
- Tabela se vodi u Excel-u, ažurira ručno, sa kašnjenjem
- Žreb se snima telefonom i baca na priče
- Igrači ne znaju kad igraju, gde igraju, koliko ima poena
- Organizator gubi 1–2 sata dnevno na ručnu administraciju
- Sponzori dobijaju amaterski utisak → manje sponzorskog novca

Turnir Kula rešava sve to jednom platformom, sa jeftinijom cenom od
pristojne kotizacije za dva tima.

---

## 3. Ciljno tržište

### Primarno: Lokalni amaterski turniri u Srbiji
- 3x3, 5x5, kvartovski, klubovski mini-turniri
- Prosečno 10–25 ekipa
- Trajanje: 2–4 nedelje
- Budžet: 100k–300k RSD ukupno

**Konzervativna procena tržišta**:
- Vojvodina: ~80 ovakvih turnira godišnje
- Cela Srbija: ~250 turnira godišnje
- Regionalno (BiH, HR, MNE, MK): +200 turnira

### Sekundarno: Sportska udruženja i klubovi
- Klubovi koji organizuju ligu sezonski (jeftinija godišnja pretplata)
- FK omladinske selekcije
- Korporativni turniri (firme, hateliji, festivali)

### Tercijarno (kasniji rast): Drugi sportovi
- Mali fudbal, košarka 3x3, odbojka, hand-ball
- Format se vrlo lako prilagođava

---

## 4. Konkurencija i pozicija

| Konkurent | Cena | Mana |
|---|---|---|
| Excel + WhatsApp (DIY) | 0 RSD | Amaterski, 1-2h/dan rada, niko ne prati |
| TournamentSoftware.com | ~$30-50/mesec | Engleski, generičan, nema fantasy |
| SportsManager.io | $40+/mesec | Komplikovan, B2B fokus |
| Custom razvoj (drugi programer) | 500k–1M RSD | Skupo, vremenski zahtevno |

**Naša pozicija**: jeftinija od profesionalne, ali znatno
profesionalnija od DIY. Srpski jezik, mobile-first, dizajnirano za
male turnirske budžete. Fantasy + auto-posteri su diferencijatori
koje konkurencija nema.

---

## 5. Cenovnik (videti CENOVNIK.md za detalje)

| Paket | Cena | Sažetak |
|---|---:|---|
| **Standalone mesečna** | 70.000 RSD | Referentna; profesionalni klijenti |
| **A — Full** | 25.000 RSD | Sve, 3 nedelje |
| **B — Standard (bez fantasy)** | 14.000 RSD | Bez fantasy modula |
| **C — Standard + naše reklame** | 5.000 RSD | Heavy popust za promotivni prostor |
| **D — Full + besplatna kotizacija moje ekipe** | 22.000 RSD | Bundle |

**Add-ons (kasnije, kad ima više klijenata):**
- Custom domen (npr. `kupturnir2026.rs`): +3.000 RSD
- Brendiranje sponzora u footer-u: +5.000 RSD
- Mailing/SMS podsetnici igračima: +3.000 RSD
- Predan setup (ja unesem sve podatke): +5.000 RSD (inače uključen)

---

## 6. Plan prodaje i marketinga

### Godina 1 — fokus na **proof of concept** i **referencama**

**Kvartal 1 (mart–maj 2026)**:
- Cilj: 3 plaćena klijenta (Kula + 2 grada u Vojvodini)
- Kanal: lični kontakti, Instagram DM organizatorima
- Zadatak: snimi 1-2 case study posle prvog turnira (video, fotke,
  citat zadovoljnog organizatora)

**Kvartal 2 (jun–avgust)**:
- Cilj: 6 plaćenih klijenata, peak letnja sezona
- Kanal: case studies + sponzorisani postovi na FK Instagram stranicama
- Cena: standard, bez popusta osim za referrere

**Kvartal 3 (sep–nov)**:
- Cilj: 3 nova klijenta + 1 godišnji ugovor sa klubom/FK
- Kanal: outreach ka klubovima koji organizuju ligu

**Kvartal 4 (dec–feb)**:
- Off-season; ovde se gradi materijal: video reklame, sajt landing,
  bolja prezentacija

### Konkretni marketinški potezi

1. **Instagram DM-ovi** — direktna komunikacija sa organizatorima.
   Cilj: 5-10 DM-ova nedeljno tokom sezone. Conversion ~10-15% u demo,
   ~50% demo u prodaju.

2. **Case studies** — video + tekst posle prvog turnira. Postavi na
   sajt + Instagram + LinkedIn.

3. **Referral popust** — organizator koji preporuči i dovede novog
   klijenta dobija -3.000 RSD popusta na sledeću sezonu.

4. **Affiliate sa lokalnim sportskim opremarama** — Sport Vision,
   Sportland, lokalne radnje. Sa popustom za zajedničke klijente.

5. **Sponzorisani postovi** — male budžete (5-10k mesečno) ka FK
   stranicama u ciljanim gradovima.

---

## 7. Procena prihoda

### Konzervativna projekcija — Godina 1

| Stavka | Količina | Cena | Prihod |
|---|---:|---:|---:|
| Paket A | 4 turnira | 25.000 | 100.000 |
| Paket B | 3 turnira | 14.000 | 42.000 |
| Paket C | 4 turnira | 5.000 | 20.000 |
| Paket D | 1 turnir | 22.000 | 22.000 |
| **Ukupno** | **12** | — | **184.000 RSD** |

### Optimistična projekcija — Godina 2

| Stavka | Količina | Cena | Prihod |
|---|---:|---:|---:|
| Paket A | 8 | 28.000 | 224.000 |
| Paket B | 6 | 16.000 | 96.000 |
| Paket C | 3 | 6.000 | 18.000 |
| Paket D | 2 | 25.000 | 50.000 |
| Godišnja pretplata (klub) | 2 | 80.000 | 160.000 |
| **Ukupno** | **21** | — | **548.000 RSD** |

### Godina 3+

- Skaliranje sa 30-50 turnira godišnje × prosek 20k = **600k–1M RSD**
- Eventualno white-label za FSS (Fudbalski savez Srbije) ili
  regionalne saveze: jednokratni ugovori po 200-500k RSD

---

## 8. Troškovi

### Fiksni troškovi (mesečno)
| Stavka | Cena |
|---|---:|
| Vercel Pro (kad budem prešao free tier) | ~$20 = 2.400 RSD |
| Supabase Pro (kad budem prešao free tier) | ~$25 = 3.000 RSD |
| Domen (`turnirkula.rs` ili sl.) | ~1.000 RSD/god / 12 = 85 RSD |
| Resend (email) free tier | 0 RSD |
| Marketing (sponzorisani postovi) | ~5.000 RSD |
| **Ukupno mesečno** | **~10.500 RSD** |

Godišnje fiksno: **~125.000 RSD** (samo u godini 2+, kad pređem free tier)

### Variabilni troškovi (po turniru)
- Vreme setup-a: ~2-4h (potencijalno outsource kasnije)
- Telefonska podrška tokom turnira: ~2-3h ukupno

### Trenutno (Godina 1)
- Vercel/Supabase: free tier verovatno dovoljan
- Domen: 1.000 RSD/god opciono
- Marketing: 0 (samo lični kontakti)
- **Realan trošak Godina 1: ~5-10k RSD ukupno**

### Margine
- Godina 1: ~95% margina (skoro sve je profit pošto je dev gotov)
- Godina 2+: ~70% margina (sa marketingom i Pro plan-ovima)

---

## 9. Rizici i mitigacije

| Rizik | Verovatnoća | Uticaj | Mitigacija |
|---|---|---|---|
| Sezonalnost (turniri uglavnom leti) | Visoka | Srednji | Razvij godišnju pretplatu za klubove |
| Klijenti tech-zaplašeni | Srednja | Visok | Predan setup uključen, video tutorial |
| "Excel je dovoljan" stav | Visoka | Visok | Naglasi profesionalan utisak, sponzori |
| Konkurencija upada na tržište | Niska | Srednji | Brz dev, predmagaze prijateljskih klijenata |
| Vercel/Supabase poskupljenje | Niska | Mali | Self-host opcija postoji |
| Solo founder izgaranje | Srednja | Visok | Outsource setup posle prvih 10 turnira |

---

## 10. Roadmap (sledećih 12 meseci)

### **[?] Postavi konkretne datume**

- **mart 2026**: kompletiraj cenovnik, sajt landing page sa case studies (i bez slučajeva za sad)
- **april**: prvi paid klijent (Kula)
- **maj**: case study iz Kule, snimi demo materijal
- **jun-avgust**: 5-8 turnira, peak sezona, fokus na ROI dokaze
- **sep-okt**: pivot ka klubovima koji rade sezonsku ligu
- **nov-dec**: pause prodaje, fokus na razvoj fičera za godinu 2
- **jan-feb 2027**: relaunch sa unapređenjima, pripremi sledeću sezonu

### Tehnički roadmap (šta dodati kasnije)
- Push notifikacije za igrače (kad ima goal, kad počinje meč)
- SMS podsetnici
- Sponzorski banner sistem (admin može da rotira reklame)
- Tema za turnir (custom boje pored plave)
- Multi-tournament dashboard za klubove
- Highlights — automatska kompilacija ključnih momenata iz live unosa
- White-label za saveze

---

## 11. Pravna/finansijska pitanja [?]

Treba odlučiti:
- **Forma poslovanja**: paušalni preduzetnik (najjednostavnije za
  prvu godinu), preduzetnik na knjige, ili LLC ako se preraste
- **PDV registracija**: praktično irelevantno do 8 miliona RSD godišnje
- **Bankovni račun**: poseban poslovni račun ili lični (paušalac može
  legalno koristiti lični)
- **Ugovor sa klijentima**: za prvi turnir verovatno usmeni dogovor +
  email potvrda. Posle, treba šablon
- **Računovođa**: za paušalca minimalan trošak (~1500 RSD/mesec)
- **Faktura**: koristi neki online sistem (eRačun, Pausal.rs)

---

## 12. Ključne metrike koje pratim

- **Broj turnira ovog meseca**: realna mera prihoda
- **Prosečna cena po turniru**: meri da li mogu da podignem cenu
- **Conversion rate** (DM → demo → prodaja): poboljšati outreach
- **Retention** (vraćaju li se za sledeće sezone): meri kvalitet
- **NPS / preporuka** (od koliko klijenata si dobio referral): meri
  fan base
- **Sati podrške po turniru**: meri operativnu skalabilnost

---

## 13. Vizija (24+ meseci, gde želim da budem)

- 50-80 turnira godišnje, prihod 1-2M RSD
- Jedan freelance dev (part-time) ili stažista za podršku
- Brend "Turnir Kula" prepoznatljiv u Vojvodini za lokalne turnire
- Spreman ulazak u BiH/HR tržište preko regionalnih partnera
- Opciono: spin-off generičke platforme za druge sportove (košarka
  3x3, odbojka)

---

## 14. Sledeći koraci ove nedelje [?]

- [ ] Pošalji Instagram DM organizatorima u Kuli (vidi tekst koji
      smo već pravili)
- [ ] Pripremi 15-min live demo (laptop, mobilni telefon, sve gotovo)
- [ ] Kupi domen `turnirkula.rs` (~1000 RSD/godina)
- [ ] Otvori paušalni preduzetnik (eUprava, 1500 RSD takse)
- [ ] Napravi excel za praćenje pipelinea (potencijalni klijenti +
      status)
