# InspeksjonsVakt v1.2.2

Mobilvennlig webapp for å vise den enkeltes inspeksjoner, med ukeoversikt og neste inspeksjon.

## Innhold
- `index.html` – appens side
- `styles.css` – design og mobiltilpasning
- `app.js` – logikk, ukevisning og PDF-lesing
- `plan.json` – inspeksjonsplanen som er lest fra PDF-en fra 19.10.2026

## Hva er nytt i v1.2.2
- Alle personnavn vises i formatet `Etternavn, Fornavn`, i tråd med inspeksjonsplanen.
- Bekreftede oppslag: `BIRO` = Birkeland, Oda; `LIET` = Lie, Tore; `ROLT` = Roll, Tone.
- Alle ansattkodene i den innlastede inspeksjonsplanen har et navneoppslag.
- Versjonsnummer oppdatert til v1.2.2.

## Funksjoner i appen
- Personlig ukeplan mandag–fredag for valgt ansatt.
- Tydelig felt for **Din neste inspeksjon** med dato, tidspunkt og område.
- Favorittvalg av ansatt lagres lokalt i nettleseren.
- Admin-del for å laste opp ny PDF med samme tabellmal.
- PDF-avlesning, kontroll av ukjente koder og eksport av ny `plan.json`.
- Alternasjon mellom partalls- og oddetallsuker for koder med skråstrek.

## Publiser via GitHub Pages
1. Opprett et repository på GitHub.
2. Pakk ut ZIP-filen og last opp alle fire filene til repositoryets rot.
3. Velg **Settings → Pages → Deploy from a branch**.
4. Velg `main` og `/ (root)`, og trykk **Save**.
5. Åpne GitHub Pages-adressen som vises i Pages-innstillingene.

## Oppdatere inspeksjonsplanen
1. Åpne appen og fold ut **Administrasjon**.
2. Velg ny PDF og sett mandagen planen gjelder fra.
3. Velg **Les PDF og erstatt plan**.
4. Kontroller ukeplanen og løs eventuelle ukjente ansattkoder i administrasjonen.
5. Velg **Last ned plan.json**.
6. Erstatt `plan.json` i GitHub-repositoryet med den nedlastede filen og publiser commit.

Appen forventer at nye PDF-er følger samme tabelloppsett som PDF-en den er tilpasset. Skannede PDF-er uten tekstlag, eller planer med en annen kolonneplassering, vil ikke kunne leses automatisk. Kontroller alltid resultatet før publisering.

## Hvordan dato og uker tolkes
Filnavnet på den opplastede PDF-en angir at planen gjelder fra mandag 19.10.2026. Ukesplanen gjentas fra denne datoen. Ved koder skrevet som `XXXX/YYYY` er første kode tolket som partallsuke og andre kode som oddetallsuke, i tråd med merknaden i originaldokumentet. Kontroller denne tolkningen med skolens planansvarlige.

## Viktig om personvern og deling
`plan.json` inneholder ansattes navn, inspeksjonsområder og tidspunkt. GitHub Pages på et offentlig repository gjør filene tilgjengelige for alle på internett. Ikke publiser denne planen offentlig uten uttrykkelig godkjenning fra skolen. Denne versjonen har ikke brukerkontoer, tilgangsstyring eller passordbeskyttelse. For ordinær intern bruk bør skolen velge en løsning med innlogging og tilgangskontroll.

## Begrensninger
- Data og favorittnavn oppdateres i nettleseren; favoritten er enhets-/nettleserbasert.
- PDF-opplasting erstatter planen i gjeldende nettleserøkt. For å dele planen med alle må administrator laste ned og erstatte `plan.json` i GitHub.
- `FLYT1` og `FLYT2` vises med områdebeskrivelsene fra merknaden i PDF-en: Fotballbanen/Fana og Fana/Paradis.
