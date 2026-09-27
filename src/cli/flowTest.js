const path = require('path');
const GrafoRubrica = require('../core/Grafo');
const JsonAdapter = require('../storage/jsonAdapter');

// Inizializziamo il motore e l'adapter per la persistenza
const rubrica = new GrafoRubrica();
const PERCORSO_FILE = path.join(__dirname, '../../data/rubrica.json');
const adapter = new JsonAdapter(PERCORSO_FILE);

console.log("==================================================");
console.log("🧪 AVVIO TEST: FLUSSO COMPLETO RUBRICA A GRAFO");
console.log("==================================================\n");

// -------------------------------------------------------------------
// 1. INSERIMENTO 4 CONTATTI PRIMARI E 3 SECONDARI CONNESSI
// -------------------------------------------------------------------
console.log("1️⃣  Creazione dei contatti...");

// 4 Contatti Primari
const idMarco = rubrica.aggiungiPersona({
    identita: { nome: "Marco", cognome: "Rossi", soprannome: "Mark" },
    contatti: {
        emails: [{ tipo: "personale", valore: "marco.rossi@email.com" }],
        telefoni: [{ tipo: "cellulare", valore: "+39 340 1234567" }]
    },
    background: { ruolo: "Software Engineer", organizzazione: "Tech Hub" },
    tags: ["tech", "developer", "milano"]
}, "marco.rossi@email.com");

const idGiulia = rubrica.aggiungiPersona({
    identita: { nome: "Giulia", cognome: "Bianchi", soprannome: "Giuls" },
    contatti: {
        emails: [{ tipo: "lavoro", valore: "giulia.b@biolab.org" }],
        socials: [{ piattaforma: "LinkedIn", username: "giulia-bianchi-bio" }]
    },
    background: { ruolo: "Biologa Marina", organizzazione: "Area Science Park" },
    tags: ["bio", "ricerca", "trieste"]
}, "giulia.b@biolab.org");

const idLuca = rubrica.aggiungiPersona({
    identita: { nome: "Luca", cognome: "Verdi" },
    contatti: {
        emails: [{ tipo: "personale", valore: "luca.verdi@design.it" }]
    },
    background: { ruolo: "Product Designer" },
    tags: ["design", "ui", "freelance"]
}, "luca.verdi@design.it");

const idElena = rubrica.aggiungiPersona({
    identita: { nome: "Elena", cognome: "Neri" },
    background: { ruolo: "Avvocato", settore: "IP & Brevetti" },
    tags: ["legal", "startup"]
});

const primari = [idMarco, idGiulia, idLuca, idElena];

// 3 Contatti Secondari
const idChiara = rubrica.aggiungiPersona({
    identita: { nome: "Chiara", cognome: "Rizzo" },
    background: { ruolo: "Ricercatrice Genetica" },
    tags: ["bio", "phd"]
});

const idMatteo = rubrica.aggiungiPersona({
    identita: { nome: "Matteo", cognome: "Gallo" },
    background: { ruolo: "Frontend Dev" },
    tags: ["tech", "react"]
});

const idSara = rubrica.aggiungiPersona({
    identita: { nome: "Sara", soprannome: "Saretta" },
    tags: ["amici", "trieste"]
});

const secondari = [idChiara, idMatteo, idSara];

// Collegamenti casuali tra i secondari e i 4 primari
secondari.forEach(idSec => {
    // Scegliamo 1 o 2 primari a caso a cui connetterlo
    const primarioScelto = primari[Math.floor(Math.random() * primari.length)];
    rubrica.aggiungiConnessione(idSec, primarioScelto);
});

// Aggiungiamo anche un paio di connessioni tra i primari per creare ponti
rubrica.aggiungiConnessione(idMarco, idGiulia);
rubrica.aggiungiConnessione(idGiulia, idLuca);

console.log(`   ✅ 7 persone create e connesse.`);
console.log(`   Nodi totali in RAM: ${rubrica.nodi.size}\n`);

// -------------------------------------------------------------------
// 2. STAMPA A SCHERMO DI 2 CONTATTI (STRUTTURA DATI)
// -------------------------------------------------------------------
console.log("2️⃣  Ispezione struttura dati (2 contatti):");
console.log("--- Contatto 1 (Marco) ---");
console.log(JSON.stringify(rubrica.nodi.get(idMarco), null, 2));

console.log("\n--- Contatto 2 (Giulia) ---");
console.log(JSON.stringify(rubrica.nodi.get(idGiulia), null, 2));
console.log("");

// -------------------------------------------------------------------
// 3. MAPPA DEI CONTATTI VIA BFS (Partendo da Marco)
// -------------------------------------------------------------------
console.log("3️⃣  Esplorazione BFS: 'Mappa dei contatti' partendo da Marco (Profondità 2):");
const rete = rubrica.esploraRete(idMarco, 2);

console.log("\n--- NODI RAGGIUNTI PER GRADO DI SEPARAZIONE ---");
rete.nodi.forEach(nodo => {
    const etichettaGrado = nodo.distanza === 0 ? "Centro (0)" : `Grado ${nodo.distanza}`;
    const ruolo = nodo.background?.ruolo ? `| ${nodo.background.ruolo}` : "";
    const tags = nodo.tags.length ? `[#${nodo.tags.join(" #")}]` : "";
    console.log(`  [${etichettaGrado}] ${nodo.identita.display_name} ${ruolo} ${tags}`);
});

console.log("\n--- COLLEGAMENTI (ARCHI) ATTIVI ---");
rete.archi.forEach(arco => {
    const nomeSource = rubrica.nodi.get(arco.source)?.identita?.display_name || arco.source;
    const nomeTarget = rubrica.nodi.get(arco.target)?.identita?.display_name || arco.target;
    console.log(`  🔗 ${nomeSource} <---> ${nomeTarget}`);
});
console.log("");

// -------------------------------------------------------------------
// 4. ELIMINAZIONE DI UN CONTATTO
// -------------------------------------------------------------------
console.log("4️⃣  Eliminazione contatto (Luca Verdi)...");
const viciniLucaPrima = Array.from(rubrica.archi.get(idLuca) || []);
console.log(`   Luca era connesso a: ${viciniLucaPrima.map(id => rubrica.nodi.get(id)?.identita?.display_name).join(", ")}`);

rubrica.cancellaPersona(idLuca);

const esisteAncora = rubrica.nodi.has(idLuca);
const orfaniRimasti = viciniLucaPrima.some(idVicino => rubrica.archi.get(idVicino)?.has(idLuca));

console.log(`   Esiste in nodi? ${esisteAncora ? "❌ Sì" : "✅ No"}`);
console.log(`   Riferimenti rimasti nei vicini? ${orfaniRimasti ? "❌ Sì" : "✅ Nessuno (pulizia a cascata riuscita)"}\n`);

// -------------------------------------------------------------------
// 5. MODIFICA DI UN CONTATTO (PRIMA & DOPO)
// -------------------------------------------------------------------
console.log("5️⃣  Modifica contatto (Giulia Bianchi)...");

console.log("--- PRIMA DELLA MODIFICA ---");
console.log({
    display_name: rubrica.nodi.get(idGiulia).identita.display_name,
    ruolo: rubrica.nodi.get(idGiulia).background.ruolo,
    tags: rubrica.nodi.get(idGiulia).tags
});

// Applichiamo la modifica: promozione a Direttrice e aggiunta di nuovi tag
rubrica.aggiornaPersona(idGiulia, {
    background: { ruolo: "Direttrice di Laboratorio" },
    tags: ["direzione", "lead", "trieste"] // "trieste" è già presente e non deve duplicarsi
});

console.log("\n--- DOPO LA MODIFICA ---");
console.log({
    display_name: rubrica.nodi.get(idGiulia).identita.display_name,
    ruolo: rubrica.nodi.get(idGiulia).background.ruolo,
    tags: rubrica.nodi.get(idGiulia).tags
});
console.log("");

// -------------------------------------------------------------------
// 6. SALVATAGGIO NELLO STORAGE
// -------------------------------------------------------------------
console.log("6️⃣  Salvataggio su disco...");
const esitoSalvataggio = adapter.salva(rubrica);

if (esitoSalvataggio) {
    console.log(`   💾 Successo! File aggiornato in: ${PERCORSO_FILE}`);
} else {
    console.log(`   ❌ Errore durante la scrittura su disco.`);
}

console.log("\n==================================================");
console.log("🎉 TEST COMPLETATO");
console.log("==================================================");