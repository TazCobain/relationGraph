let contattoSelezionatoId = null;
let payloadInAttesa = null;

// Elementi DOM
const searchInput = document.getElementById('searchInput');
const contactGrid = document.getElementById('contactGrid');
const counterDisplay = document.getElementById('counterDisplay');
const formContatto = document.getElementById('formContatto');

// Stats
const statNodi = document.getElementById('statNodi');
const statArchi = document.getElementById('statArchi');

// Dettagli
const detailEmpty = document.getElementById('detailEmpty');
const detailContent = document.getElementById('detailContent');
const detNome = document.getElementById('detNome');
const detRuolo = document.getElementById('detRuolo');
const detTags = document.getElementById('detTags');
const detContatti = document.getElementById('detContatti');
const detVicini = document.getElementById('detVicini');
const detRelazioniTitle = document.getElementById('detRelazioniTitle');
const btnEliminaContatto = document.getElementById('btnEliminaContatto');

// Modale
const modalDuplicati = document.getElementById('modalDuplicati');
const listaCandidati = document.getElementById('listaCandidati');
const btnForzaCreazione = document.getElementById('btnForzaCreazione');
const btnAnnullaModal = document.getElementById('btnAnnullaModal');

// Caricamento Statistiche
async function aggiornaStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        statNodi.textContent = data.nodiTotali;
        statArchi.textContent = data.archiTotali;
    } catch (err) {
        console.error("Errore stats:", err);
    }
}

// Caricamento Contatti con Debounce sulla ricerca
let debounceTimer;
async function caricaContatti(query = '') {
    try {
        const res = await fetch(`/api/contatti?q=${encodeURIComponent(query)}&limit=60`);
        const data = await res.json();
        counterDisplay.textContent = `(${data.totaleTrovati})`;

        contactGrid.innerHTML = data.contatti.map(c => `
            <div class="contact-card ${c.id === contattoSelezionatoId ? 'selected' : ''}" onclick="selezionaContatto('${c.id}')">
                <h3>${c.identita?.display_name || 'Anonimo'}</h3>
                <div class="ruolo">${c.background?.ruolo || 'Nessun ruolo'}</div>
                <div class="tag-cloud">
                    ${(c.tags || []).slice(0, 3).map(t => `<span class="badge">#${t}</span>`).join('')}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Errore caricamento:", err);
    }
}

searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => caricaContatti(e.target.value), 200);
});

// Selezione e Dettaglio Contatto
window.selezionaContatto = async function(id) {
    contattoSelezionatoId = id;
    
    // Aggiorna evidenziazione
    document.querySelectorAll('.contact-card').forEach(card => card.classList.remove('selected'));
    
    const res = await fetch(`/api/contatto?id=${id}`);
    if (!res.ok) return;
    const { nodo, connessioni } = await res.json();

    detailEmpty.classList.add('hidden');
    detailContent.classList.remove('hidden');

    detNome.textContent = nodo.identita?.display_name || 'Senza Nome';
    detRuolo.textContent = nodo.background?.ruolo || 'Nessun ruolo specificato';

    // Tags
    detTags.innerHTML = (nodo.tags || []).map(t => `<span class="badge">#${t}</span>`).join('') || '<span class="subtext">Nessun tag</span>';

    // Canali di contatto
    const emails = (nodo.contatti?.emails || []).map(e => `<div>📧 ${e.valore}</div>`).join('');
    const telefoni = (nodo.contatti?.telefoni || []).map(t => `<div>📱 ${t.valore}</div>`).join('');
    detContatti.innerHTML = (emails || telefoni) ? `${emails}${telefoni}` : '<span class="subtext">Nessun recapito registrato</span>';

    // Connessioni
    detRelazioniTitle.textContent = `Connessioni Dirette (${connessioni.length})`;
    detVicini.innerHTML = connessioni.map(v => `
        <div class="relazione-item" onclick="selezionaContatto('${v.id}')">
            <span><strong>${v.display_name}</strong></span>
            <span class="subtext">${v.ruolo}</span>
        </div>
    `).join('') || '<div class="subtext">Nessuna connessione attiva</div>';
};

// Eliminazione Contatto Selezionato
btnEliminaContatto.addEventListener('click', async () => {
    if (!contattoSelezionatoId) return;
    if (!confirm("Sei sicuro di voler eliminare questo contatto e recidere tutti i suoi legami?")) return;

    await fetch(`/api/contatti?id=${contattoSelezionatoId}`, { method: 'DELETE' });
    contattoSelezionatoId = null;
    detailContent.classList.add('hidden');
    detailEmpty.classList.remove('hidden');

    await aggiornaStats();
    await caricaContatti(searchInput.value);
});

// Invio Form Inserimento
formContatto.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome').value.trim();
    const cognome = document.getElementById('cognome').value.trim();
    const soprannome = document.getElementById('soprannome').value.trim();
    const ruolo = document.getElementById('ruolo').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const tagsRaw = document.getElementById('tags').value;

    const payload = {
        dati: {
            identita: { nome: nome || undefined, cognome: cognome || undefined, soprannome: soprannome || undefined },
            background: { ruolo: ruolo || undefined },
            tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
            contatti: {
                emails: email ? [{ tipo: 'lavoro', valore: email }] : [],
                telefoni: telefono ? [{ tipo: 'cellulare', valore: telefono }] : []
            }
        },
        chiaveUnivoca: email || null
    };

    // 1. Controllo Fuzzy Match
    const verifyRes = await fetch('/api/verifica-duplicati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.dati)
    });
    const candidati = await verifyRes.json();

    if (candidati.length > 0) {
        payloadInAttesa = payload;
        apriModaleDuplicati(candidati);
    } else {
        await salvaDefinitivo(payload);
    }
});

function apriModaleDuplicati(candidati) {
    listaCandidati.innerHTML = candidati.map(cand => `
        <div class="candidate-card">
            <div>
                <strong>${cand.nodo.identita.display_name}</strong>
                <div style="font-size:0.75rem; color:#9ca3af;">${cand.nodo.background?.ruolo || 'Senza ruolo'}</div>
                <div style="font-size:0.75rem; color:#6b7280;">Conosce: ${cand.connessioni.map(c => c.nome).join(', ') || 'Nessuno'}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="candidate-score">${cand.score}%</span>
                <button class="btn primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="eseguiMerge('${cand.nodo.id}')">Unisci</button>
            </div>
        </div>
    `).join('');

    modalDuplicati.classList.remove('hidden');
}

btnAnnullaModal.addEventListener('click', () => {
    modalDuplicati.classList.add('hidden');
    payloadInAttesa = null;
});

btnForzaCreazione.addEventListener('click', async () => {
    modalDuplicati.classList.add('hidden');
    if (payloadInAttesa) {
        await salvaDefinitivo(payloadInAttesa);
        payloadInAttesa = null;
    }
});

window.eseguiMerge = async function(idTarget) {
    if (!payloadInAttesa) return;

    await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idTarget: idTarget,
            nuoviDati: payloadInAttesa.dati
        })
    });

    modalDuplicati.classList.add('hidden');
    payloadInAttesa = null;
    formContatto.reset();

    await aggiornaStats();
    await caricaContatti(searchInput.value);
    selezionaContatto(idTarget);
};

async function salvaDefinitivo(payload) {
    const res = await fetch('/api/contatti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await res.json();

    formContatto.reset();
    await aggiornaStats();
    await caricaContatti(searchInput.value);
    if (result.id) selezionaContatto(result.id);
}

// Inizializzazione all'avvio
aggiornaStats();
caricaContatti();