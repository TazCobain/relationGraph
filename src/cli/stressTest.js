const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { performance } = require('perf_hooks');

const GrafoRubrica = require('../core/Grafo');
const JsonAdapter = require('../storage/jsonAdapter');

// Salviamo direttamente nel file di produzione della UI
const PERCORSO_DB = path.join(__dirname, '../../data/rubrica.json');

const CONFIG = {
    TOTALE_NODI: 2000,
    CONNESSIONI_MAX_PER_NODO: 15
};

const NOMI = ['Marco', 'Giulia', 'Luca', 'Elena', 'Matteo', 'Chiara', 'Davide', 'Sara', 'Andrea', 'Silvia', 'Alessandro', 'Francesca', 'Lorenzo', 'Martina'];
const COGNOMI = ['Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Ricci', 'Marino', 'Greco', 'Conti', 'Bruno', 'Gallo', 'Romano', 'Colombo'];
const CLUSTERS = [
    { tag: 'tech', ruoli: ['Software Engineer', 'Frontend Dev', 'CTO', 'DevOps', 'Data Scientist'] },
    { tag: 'bio', ruoli: ['Biologo Marino', 'Ricercatore', 'Genetista', 'Lab Manager'] },
    { tag: 'design', ruoli: ['Product Designer', 'UI/UX Expert', 'Art Director', 'Grafico'] },
    { tag: 'trieste', ruoli: ['Imprenditore', 'Consulente', 'Studente', 'Libero Professionista'] }
];

function log(msg, ms = null) {
    const time = ms ? ` (${ms.toFixed(2)} ms)` : '';
    console.log(`✅ ${msg}${time}`);
}

(async function runDenseStressTest() {
    console.log(`\n🚀 AVVIO GENERAZIONE DATABASE DENSO E STRESS TEST`);
    console.log(`==================================================`);
    
    const rubrica = new GrafoRubrica();
    const adapter = new JsonAdapter(PERCORSO_DB);
    const idGenerati = [];

    // --- 1. GENERAZIONE DATI (NODI ETEROGENEI) ---
    const t0 = performance.now();
    
    const idIo = rubrica.aggiungiPersona({
        identita: { nome: "Arael", cognome: "Root", soprannome: "Admin" },
        tags: ["me", "tech", "trieste"],
        background: { ruolo: "System Architect" },
        contatti: { emails: [{ tipo: "personale", valore: "admin@root.local" }] }
    }, "admin@root.local");
    idGenerati.push(idIo);

    for (let i = 1; i < CONFIG.TOTALE_NODI; i++) {
        const nome = NOMI[i % NOMI.length];
        const cognome = COGNOMI[(i * 3) % COGNOMI.length];
        const cluster = CLUSTERS[i % CLUSTERS.length]; // Assegna la persona a un cluster
        const ruolo = cluster.ruoli[(i * 7) % cluster.ruoli.length];

        const datiNodo = {
            identita: { nome, cognome },
            background: { ruolo, organizzazione: `Azienda_${i % 50}` },
            tags: [cluster.tag, i % 3 === 0 ? 'startup' : 'corporate'],
            contatti: {
                emails: [{ tipo: "lavoro", valore: `user_${i}@domain.com` }],
                telefoni: [{ tipo: "cellulare", valore: `+39340${String(i).padStart(6, '0')}` }],
                socials: i % 2 === 0 ? [{ piattaforma: "LinkedIn", username: `${nome.toLowerCase()}-${cognome.toLowerCase()}` }] : []
            }
        };

        const id = rubrica.aggiungiPersona(datiNodo, `user_${i}@domain.com`);
        idGenerati.push(id);
    }
    const t1 = performance.now();
    log(`Generati ${CONFIG.TOTALE_NODI} nodi in RAM`, t1 - t0);

    // --- 2. TOPOLOGIA A CLUSTER (DENSITÀ) ---
    const t2 = performance.now();
    let archiCreati = 0;

    // "Io" conosco le prime 100 persone
    for (let i = 1; i <= 100; i++) {
        rubrica.aggiungiConnessione(idIo, idGenerati[i]);
    }

    // Le persone tendono a conoscere altre persone del loro stesso cluster (tag principale)
    for (let i = 1; i < CONFIG.TOTALE_NODI; i++) {
        const nodoA = rubrica.nodi.get(idGenerati[i]);
        const tagPrimario = nodoA.tags[0];

        for (let k = 0; k < CONFIG.CONNESSIONI_MAX_PER_NODO; k++) {
            // Alta probabilità di pescare qualcuno vicino, bassa probabilità di fare "ponti"
            const salto = Math.random() > 0.15 ? (i + k + 1) : Math.floor(Math.random() * CONFIG.TOTALE_NODI);
            const targetIndex = salto % CONFIG.TOTALE_NODI;
            
            if (targetIndex !== 0 && targetIndex !== i) {
                rubrica.aggiungiConnessione(idGenerati[i], idGenerati[targetIndex]);
                archiCreati++;
            }
        }
    }
    
    // Convertiamo gli archi totali per display (diviso 2 per bidirezionalità)
    const totArchi = Array.from(rubrica.archi.values()).reduce((acc, set) => acc + set.size, 0) / 2;
    const t3 = performance.now();
    log(`Generati ~${totArchi} archi totali creando reti dense`, t3 - t2);

    // --- 3. RICERCA CLUSTER ---
    const t4 = performance.now();
    const techUsers = rubrica.cercaPerTag("tech");
    const t5 = performance.now();
    log(`Ricerca tag #tech: Trovati ${techUsers.length} profili`, t5 - t4);

    // --- 4. FUZZY MATCH SOTTO CARICO ---
    const t6 = performance.now();
    const duplicati = rubrica.trovaCandidatiSimili({
        identita: { nome: "Marco", cognome: "Rossi" },
        background: { ruolo: "Software Engineer" }
    }, 55);
    const t7 = performance.now();
    log(`Fuzzy Match globale: Rilevati ${duplicati.length} candidati simili a 'Marco Rossi'`, t7 - t6);

    // --- 5. MERGE DI UN HUB ---
    const t8 = performance.now();
    const idSorgente = idGenerati[500]; // Un nodo molto connesso
    const idTarget = idGenerati[501];
    rubrica.unisciNodi(idTarget, { tags: ["merged_node"] }, idSorgente);
    const t9 = performance.now();
    assert.strictEqual(rubrica.nodi.has(idSorgente), false, "Nodo sorgente non eliminato");
    log(`Merge eseguito con successo e archi trasferiti`, t9 - t8);

    // --- 6. CANCELLAZIONE A CASCATA ---
    const t10 = performance.now();
    const idDaCancellare = idGenerati[600];
    const numeroVicini = rubrica.archi.get(idDaCancellare)?.size || 0;
    rubrica.cancellaPersona(idDaCancellare);
    const t11 = performance.now();
    assert.strictEqual(rubrica.nodi.has(idDaCancellare), false);
    log(`Cancellazione a cascata: Nodo rimosso assieme a ${numeroVicini} archi bidirezionali`, t11 - t10);

    // --- 7. SALVATAGGIO DEFINITIVO (I/O) ---
    const t12 = performance.now();
    const okSalva = adapter.salva(rubrica);
    const t13 = performance.now();
    assert(okSalva, "Salvataggio fallito");
    
    const sizeMB = (fs.statSync(PERCORSO_DB).size / (1024 * 1024)).toFixed(2);
    log(`File JSON generato in ${PERCORSO_DB} (${sizeMB} MB)`, t13 - t12);

    // --- 8. VERIFICA CARICAMENTO A FREDDO ---
    const t14 = performance.now();
    const nuovaRubrica = new GrafoRubrica();
    adapter.carica(nuovaRubrica);
    const t15 = performance.now();
    
    assert.strictEqual(nuovaRubrica.nodi.size, rubrica.nodi.size, "Discrepanza nodi post-caricamento");
    log(`Ripristino da disco completato con successo. Dati pronti per l'Interfaccia Web!`, t15 - t14);

    console.log(`\n==================================================`);
    console.log(`🎉 DATABASE GENERATO E PRONTO ALL'USO!`);
    console.log(`⏱️ Tempo totale: ${(performance.now() - t0).toFixed(2)} ms`);
    console.log(`👉 Ora puoi avviare il server web: node src/server/server.js`);
    console.log(`==================================================\n`);

})();