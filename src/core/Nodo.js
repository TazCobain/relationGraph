/**
 * Script per standardizzare la creazione del nodo (contatto) allinterno del sistema.
 * 
 * il contatto ha 3 blocchi fondamentali:
 *  -   identità: dati anagrafici come nome, cognome, soprannome, ecc...
 *  -   contatti: vari recapiti dalle email ai social
 *  -   background: percorso professionale e titoli
 *  -   note: una sezione "bonus" in cui aggiungere informazioni accessorie
*/
const crypto = require('crypto');

class NodoPersona {
    
    /**
     * @contract Costruttore Standardizzato del Nodo
     * @description Riceve dati grezzi o parziali e restituisce una struttura dati coerente, 
     * allocando un UUID e calcolando automaticamente il display_name.
     * 
     * @param {Object} dati - Dati grezzi della persona (identita, contatti, tags, ecc.)
     * @returns {Object} Oggetto Persona completo e formattato, pronto per la RAM.
     */
    static crea(dati) {
        // Estraiamo i blocchi o assegniamo oggetti/array vuoti di default
        const {
            identita = {},
            contatti = {},
            background = {},
            tags = [],
            note_contesto = ""
        } = dati;

        // Autogenerazione del Display Name
        let displayName = "Sconosciuto";
        if (identita.nome && identita.cognome) {
            displayName = `${identita.nome} ${identita.cognome}`;
        } else if (identita.nome) {
            displayName = identita.nome;
        } else if (identita.soprannome) { // se il soprannome esiste pravale sul resto
            displayName = identita.soprannome;
        }
        identita.display_name = displayName;

        // Ritorna l'oggetto "Persona" definitivo
        return {
            id: crypto.randomUUID(),
            data_creazione: new Date().toISOString(),
            identita,
            contatti,
            background,
            tags,
            note_contesto
        };
    }
}

module.exports = NodoPersona;