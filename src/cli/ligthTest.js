const path = require('path');
const fs = require('fs');
const assert = require('assert');

const GrafoRubrica = require('../core/Grafo');
const JsonAdapter = require('../storage/jsonAdapter');

// Percorso definitivo dello storage persistente
const PERCORSO_STORAGE = path.join(__dirname, '../../data/rubrica.json');

console.log("==========================================");
console.log("🧪 AVVIO TEST LIGHT CON PERSISTENZA");
console.log("==========================================\n");

const rubrica = new GrafoRubrica();
const adapter = new JsonAdapter(PERCORSO_STORAGE);

// --- 1. TEST CREAZIONE NODO & DISPLAY NAME ---
console.log("1️⃣  Test creazione e normalizzazione...");
const idIo = rubrica.aggiungiPersona({
    identita: { nome: "Arael", cognome: "Dev" },
    tags: ["me", "tech"]
}, "arael@test.local");

const idAlice = rubrica.aggiungiPersona({
    identita: { nome: "Alice", cognome: "Bianchi", soprannome: "Ali" },
    contatti: {
        emails: [{ tipo: "lavoro", valore: "alice@bio.org" }],
        telefoni: [{ tipo: "cellulare", valore: "+39333111222" }]
    },
    background: { ruolo: "Biologa Marina" },
    tags: ["bio", "ricerca"]
}, "alice@bio.org");

const idBob = rubrica.aggiungiPersona({
    identita: { nome: "Bob", cognome: "Verdi" },
    background: { ruolo: "DevOps" },
    tags: ["tech", "cloud"]
}, "bob@tech.org");

assert.strictEqual(rubrica.nodi.get(idIo).identita.display_name, "Arael Dev");
assert.strictEqual(rubrica.nodi.get(idAlice).identita.display_name, "Alice Bianchi");
console.log("   ✅ Nodi creati e display_name calcolati correttamente.");

// --- 2. TEST DEDUPLICAZIONE DETERMINISTICA ---
console.log("\n2️⃣  Test deduplicazione tramite chiave univoca...");
const idDuplicato = rubrica.aggiungiPersona({
    identita: { nome: "Alice Clonata" }
}, "alice@bio.org");

assert.strictEqual(idDuplicato, idAlice, "La deduplicazione su chiave univoca ha fallito");
assert.strictEqual(rubrica.nodi.size, 3, "Il numero di nodi è aumentato invece di deduplicare");
console.log("   ✅ Deduplicazione per chiave univoca funzionante.");

// --- 3. TEST CONNESSIONI BIDIREZIONALI ---
console.log("\n3️⃣  Test archi e relazioni bidirezionali...");
rubrica.aggiungiConnessione(idIo, idAlice);
rubrica.aggiungiConnessione(idAlice, idBob);
rubrica.aggiungiConnessione(idIo, idAlice);
rubrica.aggiungiConnessione(idIo, idIo);

assert.strictEqual(rubrica.archi.get(idIo).has(idAlice), true);
assert.strictEqual(rubrica.archi.get(idAlice).has(idIo), true);
assert.strictEqual(rubrica.archi.get(idAlice).has(idBob), true);
assert.strictEqual(rubrica.archi.get(idIo).size, 1, "Rilevati archi multipli o auto-connessione");
console.log("   ✅ Connessioni bidirezionali e prevenzione loop funzionanti.");

// --- 4. TEST RICERCA CLUSTER PER TAG ---
console.log("\n4️⃣  Test ricerca cluster (#bio)...");
const biologi = rubrica.cercaPerTag("bio");
assert.strictEqual(biologi.length, 1);
assert.strictEqual(biologi[0].id, idAlice);
console.log(`   ✅ Trovato contatto: ${biologi[0].identita.display_name}`);

// --- 5. TEST ESPLORAZIONE BFS ---
console.log("\n5️⃣  Test navigazione rete (BFS a profondità 2)...");
const rete = rubrica.esploraRete(idIo, 2);
assert.strictEqual(rete.nodi.length, 3, "La BFS non ha raggiunto tutti i nodi previsti");
assert.strictEqual(rete.archi.length, 2, "Il numero di archi estratti non coincide");

const distanze = Object.fromEntries(rete.nodi.map(n => [n.identita.nome, n.distanza]));
assert.strictEqual(distanze["Arael"], 0);
assert.strictEqual(distanze["Alice"], 1);
assert.strictEqual(distanze["Bob"], 2);
console.log("   ✅ Gradi di separazione calcolati con precisione (0 -> 1 -> 2).");

// --- 6. TEST FUZZY MATCHING & SOSIA ---
console.log("\n6️⃣  Test Fuzzy Matching (Rilevamento duplicati)...");
const nuovoContattoAmbiguo = {
    identita: { nome: "Alice", cognome: "Bianchi" },
    background: { ruolo: "Biologa Marina" }
};
const sosia = rubrica.trovaCandidatiSimili(nuovoContattoAmbiguo, 55);

assert(sosia.length > 0, "Nessun sosia rilevato per Alice");
assert(sosia[0].score >= 70, `Score atteso >= 70, calcolato: ${sosia[0].score}`);
assert.strictEqual(sosia[0].connessioni[0].nome, "Arael Dev", "I vicini del candidato non sono stati risolti con display_name");
console.log(`   ✅ Candidato rilevato: ${sosia[0].nodo.identita.display_name} (Score: ${sosia[0].score}%)`);

// --- 7. TEST FUSIONE NODI (MERGE MANUALE) ---
console.log("\n7️⃣  Test unione nodi (Merge) con trasferimento archi...");
const idAliProvvisorio = rubrica.aggiungiPersona({
    identita: { soprannome: "Ali_Researcher" },
    tags: ["genetica"],
    contatti: {
        emails: [{ tipo: "personale", valore: "ali.personal@gmail.com" }]
    }
});
rubrica.aggiungiConnessione(idAliProvvisorio, idBob);

rubrica.unisciNodi(idAlice, {
    tags: ["genetica"],
    contatti: {
        emails: [{ tipo: "personale", valore: "ali.personal@gmail.com" }]
    }
}, idAliProvvisorio);

assert.strictEqual(rubrica.nodi.has(idAliProvvisorio), false, "Il nodo duplicato non è stato eliminato");
assert.strictEqual(rubrica.nodi.get(idAlice).tags.includes("genetica"), true, "Tag non fusi correttamente");
assert.strictEqual(rubrica.nodi.get(idAlice).contatti.emails.length, 2, "Array emails non unito");
console.log("   ✅ Merge completato: dati uniti e nodo vecchio eliminato.");

// --- 8. TEST CANCELLAZIONE A CASCATA ---
console.log("\n8️⃣  Test cancellazione a cascata...");
rubrica.cancellaPersona(idBob);
assert.strictEqual(rubrica.nodi.has(idBob), false);
assert.strictEqual(rubrica.archi.get(idAlice).has(idBob), false, "L'arco verso Bob non è stato rimosso dal Set di Alice");
console.log("   ✅ Nodo eliminato e riferimenti orfani ripuliti.");

// --- 9. SALVATAGGIO DEFINITIVO NELLO STORAGE ---
console.log("\n9️⃣  Salvataggio su disco...");
const okSalva = adapter.salva(rubrica);
assert.strictEqual(okSalva, true, "Salvataggio su disco fallito");

// Verifica di ripristino su una nuova istanza pulita
const rubricaRipristinata = new GrafoRubrica();
const okCarica = adapter.carica(rubricaRipristinata);
assert.strictEqual(okCarica, true, "Caricamento da disco fallito");
assert.strictEqual(rubricaRipristinata.nodi.size, rubrica.nodi.size, "Numero nodi non coincidente");
assert.strictEqual(rubricaRipristinata.archi.get(idAlice).has(idIo), true, "Archi ripristinati non operativi");

console.log(`   💾 Dati scritti con successo su: ${PERCORSO_STORAGE}`);

console.log("\n==========================================");
console.log("🎉 TEST COMPLETATO E DATI CONSOLIDATI SU DISCO");
console.log("==========================================\n");