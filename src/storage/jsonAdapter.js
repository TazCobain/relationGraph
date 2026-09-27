const fs = require('fs');
const path = require('path');

class JsonAdapter {
    /**
     * @param {String} percorsoFile - Percorso relativo o assoluto (es. './data/rubrica.json')
     */
    constructor(percorsoFile) {
        this.percorsoFile = path.resolve(percorsoFile);
    }

    /**
     * @contract Caricamento Dati
     * @description Legge il file JSON da disco e popola le strutture in RAM del grafo.
     * @param {Object} grafo - Istanza di GrafoRubrica.
     * @returns {Boolean} True se il caricamento è riuscito, False se il file non esiste o è corrotto.
     */
    carica(grafo) {
        if (!fs.existsSync(this.percorsoFile)) {
            return false;
        }

        try {
            const rawData = fs.readFileSync(this.percorsoFile, 'utf-8');
            if (!rawData.trim()) return false;

            const dati = JSON.parse(rawData);
            grafo.importaDati(dati);
            return true;
        } catch (errore) {
            console.error(`[STORAGE ERROR] Impossibile leggere il file ${this.percorsoFile}:`, errore.message);
            return false;
        }
    }

    /**
     * @contract Salvataggio Dati
     * @description Prende lo snapshot esportato dal grafo e lo scrive su file formattato.
     * @param {Object} grafo - Istanza di GrafoRubrica.
     * @returns {Boolean} True se il salvataggio è andato a buon fine.
     */
    salva(grafo) {
        try {
            const datiDaSalvare = grafo.esportaDati();

            // Assicura che la directory esista prima di scrivere
            const dir = path.dirname(this.percorsoFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.percorsoFile, JSON.stringify(datiDaSalvare, null, 2), 'utf-8');
            return true;
        } catch (errore) {
            console.error(`[STORAGE ERROR] Errore durante la scrittura su disco:`, errore.message);
            return false;
        }
    }
}

module.exports = JsonAdapter;