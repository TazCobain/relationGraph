const NodoPersona = require('./Nodo');

class GrafoRubrica {
    constructor() {
        this.nodi = new Map();        // ID -> Dati Persona (Puntatore)
        this.archi = new Map();       // ID -> Set di ID connessi (Lista Adiacenza)
        this.indiceUnivoco = new Map(); // Es. email -> ID (Deduplicazione)
    }

    // --- OPERAZIONI BASE (CRUD) ---
    /**
     * @contract Inserimento Sicuro (O(1))
     * @description Aggiunge un nodo al grafo. Se viene fornita una chiave univoca 
     * già presente (es. email), previene il duplicato e restituisce l'ID esistente.
     * 
     * @param {Object} dati - L'oggetto con i dati della persona.
     * @param {String|null} [chiaveUnivoca=null] - (Opzionale) Es. email o telefono per deduplicazione.
     * @returns {String} UUID del nodo (nuovo o esistente).
     */
    aggiungiPersona(dati, chiaveUnivoca = null) {
        // Deduplicazione: se esiste già, ritorna l'ID senza creare duplicati
        if (chiaveUnivoca && this.indiceUnivoco.has(chiaveUnivoca)) {
            return this.indiceUnivoco.get(chiaveUnivoca);
        }

        const nuovaPersona = NodoPersona.crea(dati); // uso la struttura standard definita in Nodo.js
        const id = nuovaPersona.id;
        
        this.nodi.set(id, nuovaPersona);
        this.archi.set(id, new Set());

        if (chiaveUnivoca) {
            this.indiceUnivoco.set(chiaveUnivoca, id);
        }

        return id;
    }


    /**
     * @contract Aggiornamento Parziale Profondo (O(1))
     * @description Unisce i nuovi campi forniti con quelli esistenti senza sovrascriverli 
     * interamente, mantenendo intatto l'indirizzo di memoria del nodo. Unisce anche i tag.
     * 
     * @param {String} id - UUID del nodo da modificare.
     * @param {Object} nuoviDati - Oggetto parziale con i campi da aggiornare.
     * @returns {Boolean} True se l'aggiornamento è avvenuto, False se il nodo non esiste.
     */
    aggiornaPersona(id, nuoviDati) {
        if (!this.nodi.has(id)) return false;

        const nodoEsistente = this.nodi.get(id);

        // Merge profondo per non sovrascrivere i campi esistenti con "null"
        const nodoAggiornato = {
            ...nodoEsistente,
            ...nuoviDati,
            identita: { ...nodoEsistente.identita, ...(nuoviDati.identita || {}) },
            contatti: { ...nodoEsistente.contatti, ...(nuoviDati.contatti || {}) },
            background: { ...nodoEsistente.background, ...(nuoviDati.background || {}) },
            // Unisce i tag vecchi e nuovi eliminando i duplicati
            tags: Array.from(new Set([...(nodoEsistente.tags || []), ...(nuoviDati.tags || [])]))
        };

        // Aggiorna il puntatore in RAM
        this.nodi.set(id, nodoAggiornato);
        return true;
    }


    /**
     * @contract Fusione Nodi (Merge Manuale)
     * @description Fonde i dati di due entità senza perdere contatti o tag,
     * trasferisce tutti gli archi al nodo principale ed elimina il duplicato.
     * 
     * @param {String} idPrincipale - UUID del nodo da mantenere.
     * @param {Object} datiNuovi - Oggetto contenente i dati del secondo nodo (o dati freschi).
     * @param {String|null} [idDaEliminare=null] - UUID del nodo ridondante da distruggere.
     * @returns {String|Boolean} UUID del nodo mantenuto o false se non trovato.
     */
    unisciNodi(idPrincipale, datiNuovi, idDaEliminare = null) {
        if (!this.nodi.has(idPrincipale)) return false;

        const target = this.nodi.get(idPrincipale);

        // 1. Unione profonda dei dati
        target.identita = { ...target.identita, ...(datiNuovi.identita || {}) };
        target.background = { ...target.background, ...(datiNuovi.background || {}) };
        target.tags = Array.from(new Set([...(target.tags || []), ...(datiNuovi.tags || [])]));

        // 2. Unione sicura degli array di contatti (evita di perdere vecchi numeri/email)
        const contattiTarget = target.contatti || {};
        const contattiSource = datiNuovi.contatti || {};

        const unisciArrayContatti = (arr1 = [], arr2 = [], chiaveConfronto = 'valore') => {
            const mappa = new Map();
            [...arr1, ...arr2].forEach(item => {
                if (item && item[chiaveConfronto]) {
                    mappa.set(item[chiaveConfronto].toLowerCase(), item);
                }
            });
            return Array.from(mappa.values());
        };

        target.contatti = {
            telefoni: unisciArrayContatti(contattiTarget.telefoni, contattiSource.telefoni, 'valore'),
            emails: unisciArrayContatti(contattiTarget.emails, contattiSource.emails, 'valore'),
            socials: unisciArrayContatti(contattiTarget.socials, contattiSource.socials, 'username')
        };

        // 3. Ricalcola il display_name in caso si siano aggiunti nome o cognome
        let dn = target.identita.display_name;
        if (target.identita.nome && target.identita.cognome) {
            dn = `${target.identita.nome} ${target.identita.cognome}`;
        } else if (target.identita.nome) {
            dn = target.identita.nome;
        } else if (target.identita.soprannome) {
            dn = target.identita.soprannome;
        }
        target.identita.display_name = dn;

        // 4. Se è specificato un nodo da eliminare, trasferiamo le sue connessioni
        if (idDaEliminare && this.nodi.has(idDaEliminare) && idDaEliminare !== idPrincipale) {
            const viciniVecchio = this.archi.get(idDaEliminare) || new Set();
            
            for (let idVicino of viciniVecchio) {
                if (idVicino !== idPrincipale) {
                    this.aggiungiConnessione(idPrincipale, idVicino); 
                }
                this.archi.get(idVicino).delete(idDaEliminare); // Rimuove il vecchio arco
            }

            this.archi.delete(idDaEliminare);
            this.nodi.delete(idDaEliminare);
        }

        return idPrincipale;
    }


    /**
     * @contract Cancellazione a Cascata (O(K))
     * @description Rimuove il nodo dalla memoria e recide istantaneamente tutti 
     * gli archi che lo collegano ai suoi vicini, garantendo l'integrità del grafo.
     * 
     * @param {String} id - UUID del nodo da eliminare.
     */
    cancellaPersona(id) {
        if (!this.nodi.has(id)) return;

        // O(K) - Elimina l'ID dai Set di tutte le persone a cui era collegato
        const connessioni = this.archi.get(id);
        for (let idConnesso of connessioni) {
            this.archi.get(idConnesso).delete(id);
        }

        this.archi.delete(id);
        this.nodi.delete(id);

        // Pulizia indice univoco
        for (let [chiave, idSalvato] of this.indiceUnivoco.entries()) {
            if (idSalvato === id) {
                this.indiceUnivoco.delete(chiave);
                break;
            }
        }
    }


    // --- RELAZIONI ---
    /**
     * @contract Collegamento Bidirezionale (O(1))
     * @description Crea un arco (edge) tra due nodi. Grazie alla struttura a Set, 
     * chiamate ripetute con gli stessi ID non creeranno archi duplicati.
     * 
     * @param {String} id1 - UUID della prima persona.
     * @param {String} id2 - UUID della seconda persona.
     */
    aggiungiConnessione(id1, id2) {
        if (id1 === id2) return; // Niente auto-connessioni
        
        if (this.nodi.has(id1) && this.nodi.has(id2)) {
            this.archi.get(id1).add(id2);
            this.archi.get(id2).add(id1); // Bidirezionale
        }
    }


    // --- RICERCA ED ESPLORAZIONE ---
    /**
     * @contract Ricerca per Cluster (O(N))
     * @description Esegue una scansione lineare in memoria per trovare tutti i nodi 
     * che contengono il tag specificato nel loro array "tags".
     * 
     * @param {String} tag - Il tag da cercare (es. "biologia", "lavoro").
     * @returns {Array<Object>} Array di puntatori ai nodi trovati.
     */
    cercaPerTag(tag) {
        return Array.from(this.nodi.values()).filter(p => p.tags && p.tags.includes(tag));
    }


    /**
     * @contract Esplorazione Radiale / BFS (O(V+E))
     * @description Visita il grafo a strati partendo da un nodo centrale. Utile per 
     * calcolare i gradi di separazione ed estrarre il sottografo da renderizzare in 3D.
     * 
     * @param {String} idPartenza - UUID del nodo centrale (es. "Io").
     * @param {Number} profonditaMassima - Livello massimo di separazione da esplorare.
     * @returns {Object|null} Oggetto { nodi: [...], archi: [...] } formattato per frontend.
     */
    esploraRete(idPartenza, profonditaMassima) {
        if (!this.nodi.has(idPartenza)) return null;

        const visitati = new Set([idPartenza]);
        const coda = [{ id: idPartenza, profondita: 0 }];
        
        const risultatoNodi = [];
        const risultatoArchi = [];

        while (coda.length > 0) {
            const { id, profondita } = coda.shift();
            
            risultatoNodi.push({ ...this.nodi.get(id), distanza: profondita });

            if (profondita >= profonditaMassima) continue;

            const connessioni = this.archi.get(id);
            for (let idVicino of connessioni) {
                if (!visitati.has(idVicino)) {
                    visitati.add(idVicino);
                    coda.push({ id: idVicino, profondita: profondita + 1 });
                }
                
                // Genera una chiave univoca per l'arco per evitare doppioni (A-B vs B-A)
                const min = id < idVicino ? id : idVicino;
                const max = id > idVicino ? id : idVicino;
                risultatoArchi.push(`${min}|${max}`);
            }
        }

        // Formatta gli archi per output
        const archiUnivoci = Array.from(new Set(risultatoArchi)).map(str => {
            const [source, target] = str.split('|');
            return { source, target };
        });

        return { nodi: risultatoNodi, archi: archiUnivoci };
    }


    // --- IMPORT / EXPORT (Verso l'Adapter) ---
    /**
     * @contract Serializzazione della RAM (O(N + E))
     * @description "Schiaccia" le Tabelle di Hash (Map e Set) convertendole in Array 
     * piatti per permettere il salvataggio su disco in formato JSON.
     * 
     * @returns {Object} Dati grezzi pronti per essere passati al jsonAdapter.
     */
    esportaDati() {
        return {
            nodi: Array.from(this.nodi.entries()),
            archi: Array.from(this.archi.entries()).map(([k, v]) => [k, Array.from(v)]), // I Set diventano Array per il JSON
            indiceUnivoco: Array.from(this.indiceUnivoco.entries())
        };
    }


    /**
     * @contract Deserializzazione verso RAM (O(N + E))
     * @description Prende l'oggetto piatto letto dal JSON e alloca i puntatori in memoria, 
     * ricostruendo le Mappe e i Set necessari per le performance del motore.
     * 
     * @param {Object} dati - Oggetto JSON contenente nodi, archi e indiceUnivoco.
     */
    importaDati(dati) {
        if (!dati || !dati.nodi) return;
        this.nodi = new Map(dati.nodi);
        this.indiceUnivoco = new Map(dati.indiceUnivoco || []);
        // Gli Array del JSON tornano a essere Set in RAM
        this.archi = new Map((dati.archi || []).map(([k, v]) => [k, new Set(v)])); 
    }

    // --- MOTORE DI DEDUPLICAZIONE (FUZZY MATCHING) ---
    
    /**
     * @contract Fuzzy Matching (Ottimizzato per Identificatori Forti)
     * @description Confronta i dati assegnando priorità ai contatti univoci.
     */
    calcolaSimilarita(nodoEsistente, datiNuovi) {
        // --- 1. MATCH DETERMINISTICO (Ritorna 100 e ferma il calcolo) ---
        // (Nota: in produzione qui cicli gli array di email/telefoni per trovare un match esatto)
        // Se c'è un'email o un telefono in comune -> return 100;

        let score = 0;

        const identE = nodoEsistente.identita || {};
        const identN = datiNuovi.identita || {};

        // --- 2. DATI FORTI (Nome, Cognome, Soprannome) ---
        const nomeMatch = identE.nome && identN.nome && identE.nome.toLowerCase() === identN.nome.toLowerCase();
        const cognomeMatch = identE.cognome && identN.cognome && identE.cognome.toLowerCase() === identN.cognome.toLowerCase();
        const nickMatch = identE.soprannome && identN.soprannome && identE.soprannome.toLowerCase() === identN.soprannome.toLowerCase();

        if (nomeMatch && cognomeMatch) {
            score += 60; // Mario Rossi + Mario Rossi = Molto probabile
        } else if (nomeMatch || cognomeMatch) {
            score += 30; // Solo Mario = Comune, non basta per far scattare l'alert da solo
        }

        if (nickMatch) {
            score += 50; // Il soprannome è un dato molto forte in una rete personale
        }

        // Se siamo a zero dopo i nomi, inutile controllare lavoro o tag. Sono persone diverse.
        if (score === 0) return 0;

        // --- 3. MODIFICATORI DEBOLI (Lavoro, Tags) ---
        // Un peso bassissimo, utile a "confermare" un omonimia.
        if (nodoEsistente.background?.ruolo && datiNuovi.background?.ruolo) {
            if (nodoEsistente.background.ruolo.toLowerCase() === datiNuovi.background.ruolo.toLowerCase()) {
                score += 10; // Solo +10 per la professione
            }
        }

        const tagsE = nodoEsistente.tags || [];
        const tagsN = datiNuovi.tags || [];
        const matchTags = tagsN.filter(t => tagsE.includes(t)).length;
        score += (matchTags * 5); // +5 punti per ogni tag in comune

        // (Bonus Futuro) Se stiamo aggiungendo un nodo e sappiamo chi ce lo presenta, 
        // potremmo dare +20 se hanno amicizie in comune! Questo è il vero potere del grafo.

        return Math.min(score, 99); // Se non è deterministico (email/telefono), non arriva mai a 100.
    }


    /**
     * @contract Ricerca Possibili Duplicati
     * @description Scorre tutti i nodi e restituisce quelli che superano la soglia,
     * corredati dal contesto delle persone a cui sono collegati per aiutare l'utente a decidere.
     * 
     * @param {Object} datiNuovi - Dati del contatto che si intende inserire.
     * @param {Number} [sogliaMinima=55] - Punteggio minimo per far scattare l'alert.
     * @returns {Array<Object>} Lista ordinata dei candidati compatibili.
     */
    trovaCandidatiSimili(datiNuovi, sogliaMinima = 55) {
        const candidati = [];
        
        for (let nodo of this.nodi.values()) {
            const score = this.calcolaSimilarita(nodo, datiNuovi);
            if (score >= sogliaMinima) {
                // Risolviamo gli UUID dei vicini nei loro rispettivi display_name per dare contesto
                const viciniIds = this.archi.get(nodo.id) || new Set();
                const connessioniRisolte = Array.from(viciniIds).map(idVicino => {
                    const vicino = this.nodi.get(idVicino);
                    return {
                        id: idVicino,
                        nome: vicino?.identita?.display_name || "Sconosciuto"
                    };
                });

                candidati.push({
                    nodo,
                    score,
                    connessioni: connessioniRisolte
                });
            }
        }

        // Ordina dal più compatibile al meno compatibile
        return candidati.sort((a, b) => b.score - a.score);
    }

}

module.exports = GrafoRubrica;