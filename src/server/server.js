const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const GrafoRubrica = require('../core/Grafo');
const JsonAdapter = require('../storage/jsonAdapter');

const PORT = 3000;
const DB_PATH = path.join(__dirname, '../../data/rubrica.json');
const PUBLIC_DIR = path.join(__dirname, '../public');

const rubrica = new GrafoRubrica();
const adapter = new JsonAdapter(DB_PATH);

// Caricamento in RAM all'avvio
adapter.carica(rubrica);
console.log(`[CORE] Grafo caricato in RAM: ${rubrica.nodi.size} nodi attivi.`);

// Helper per servire file statici
function servStatic(reqPath, res) {
    let filePath = reqPath === '/' ? '/index.html' : reqPath;
    const fullPath = path.join(PUBLIC_DIR, filePath);

    const ext = path.extname(fullPath);
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml'
    };

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
    });
}

// Helper per leggere il body JSON delle richieste POST
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Headers CORS per sviluppo locale
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ==========================================
    // API REST
    // ==========================================

    // 1. Statistiche rapide
    if (pathname === '/api/stats' && method === 'GET') {
        const totArchi = Array.from(rubrica.archi.values()).reduce((acc, s) => acc + s.size, 0) / 2;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            nodiTotali: rubrica.nodi.size,
            archiTotali: totArchi,
            indiciUnivoci: rubrica.indiceUnivoco.size
        }));
        return;
    }

    // 2. Lista e Ricerca contatti
    if (pathname === '/api/contatti' && method === 'GET') {
        const q = (parsedUrl.query.q || '').trim().toLowerCase();
        const limit = parseInt(parsedUrl.query.limit || '60', 10);
        let lista = Array.from(rubrica.nodi.values());

        if (q) {
            lista = lista.filter(n => {
                const dn = (n.identita?.display_name || '').toLowerCase();
                const ruolo = (n.background?.ruolo || '').toLowerCase();
                const tags = (n.tags || []).join(' ').toLowerCase();
                const emails = (n.contatti?.emails || []).map(e => e.valore).join(' ').toLowerCase();
                return dn.includes(q) || ruolo.includes(q) || tags.includes(q) || emails.includes(q);
            });
        }

        const risultatoPaginato = lista.slice(0, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            totaleTrovati: lista.length,
            contatti: risultatoPaginato
        }));
        return;
    }

    // 3. Dettaglio singolo contatto con relazioni risolte
    if (pathname === '/api/contatto' && method === 'GET') {
        const id = parsedUrl.query.id;
        if (!id || !rubrica.nodi.has(id)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: 'Contatto non trovato' }));
            return;
        }

        const nodo = rubrica.nodi.get(id);
        const viciniIds = rubrica.archi.get(id) || new Set();
        const connessioni = Array.from(viciniIds).map(vid => {
            const v = rubrica.nodi.get(vid);
            return {
                id: vid,
                display_name: v?.identita?.display_name || 'Sconosciuto',
                ruolo: v?.background?.ruolo || ''
            };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ nodo, connessioni }));
        return;
    }

    // 4. Verifica preventiva duplicati (Fuzzy Matching)
    if (pathname === '/api/verifica-duplicati' && method === 'POST') {
        try {
            const dati = await parseBody(req);
            const candidati = rubrica.trovaCandidatiSimili(dati, 55);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(candidati));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: 'JSON malformato' }));
        }
        return;
    }

    // 5. Inserimento nuovo contatto
    if (pathname === '/api/contatti' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const chiave = body.chiaveUnivoca || null;
            const id = rubrica.aggiungiPersona(body.dati, chiave);

            // Se sono stati specificati contatti da connettere
            if (Array.isArray(body.connettiA)) {
                body.connettiA.forEach(targetId => rubrica.aggiungiConnessione(id, targetId));
            }

            adapter.salva(rubrica);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, id }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: e.message }));
        }
        return;
    }

    // 6. Fusione nodi (Merge)
    if (pathname === '/api/merge' && method === 'POST') {
        try {
            const { idTarget, nuoviDati, idDaEliminare } = await parseBody(req);
            const risultato = rubrica.unisciNodi(idTarget, nuoviDati, idDaEliminare);
            adapter.salva(rubrica);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !!risultato, id: risultato }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: e.message }));
        }
        return;
    }

    // 7. Cancellazione contatto
    if (pathname === '/api/contatti' && method === 'DELETE') {
        const id = parsedUrl.query.id;
        if (!id || !rubrica.nodi.has(id)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: 'Contatto inesistente' }));
            return;
        }

        rubrica.cancellaPersona(id);
        adapter.salva(rubrica);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 8. Esplorazione BFS (per future viste grafo)
    if (pathname === '/api/grafo' && method === 'GET') {
        const idCentro = parsedUrl.query.id;
        const depth = parseInt(parsedUrl.query.depth || '2', 10);

        if (!idCentro || !rubrica.nodi.has(idCentro)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errore: 'ID nodo non valido' }));
            return;
        }

        const sottografo = rubrica.esploraRete(idCentro, depth);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sottografo));
        return;
    }

    // Fallback: file statici
    servStatic(pathname, res);
});

function avviaServer() {
    server.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 Personal CRM avviato su http://localhost:${PORT}`);
        console.log(`==================================================\n`);
    });
}

if (require.main === module) {
    avviaServer();
}

module.exports = { avviaServer, rubrica, adapter };