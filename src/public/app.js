// ==========================================
// STATO APPLICAZIONE
// ==========================================
let contattoSelezionatoId = null;
let payloadInAttesa = null;
let connessioniSelezionate = new Map(); // Mappa id -> infoNodo
let cacheContattiRubrica = []; // Per ricerca locale veloce nella mini-rubrica

// Palette per Avatar
const COLOR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
function getAvatarStr(nome = '', cognome = '', soprannome = '') {
    if (nome) return nome.charAt(0).toUpperCase();
    if (soprannome) return soprannome.charAt(0).toUpperCase();
    if (cognome) return cognome.charAt(0).toUpperCase();
    return '?';
}
function getAvatarColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

// ==========================================
// NAVIGAZIONE
// ==========================================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`view-${btn.dataset.target}`).classList.add('active');
        
        if (btn.dataset.target === 'lista') chiudiDettaglio();
    });
});

const detailPane = document.getElementById('detailPane');
const detailEmpty = document.getElementById('detailEmpty');
const detailContent = document.getElementById('detailContent');
document.getElementById('btnBack').addEventListener('click', chiudiDettaglio);

function apriDettaglio() {
    detailPane.classList.add('open');
    detailEmpty.classList.add('hidden');
    detailContent.classList.remove('hidden');
}
function chiudiDettaglio() {
    detailPane.classList.remove('open');
    contattoSelezionatoId = null;
    if (window.innerWidth >= 768) {
        detailEmpty.classList.remove('hidden');
        detailContent.classList.add('hidden');
    }
}

// ==========================================
// LOGICA LISTA E DETTAGLIO
// ==========================================
async function aggiornaStats() {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statsDisplay').textContent = `${data.nodiTotali} Nodi`;
}

let debounceTimer;
async function caricaContatti(query = '') {
    const res = await fetch(`/api/contatti?q=${encodeURIComponent(query)}&limit=100`);
    const data = await res.json();
    cacheContattiRubrica = data.contatti; // Salviamo in cache per la mini-rubrica
    
    document.getElementById('contactGrid').innerHTML = data.contatti.map(c => {
        const nomeDisp = c.identita?.display_name || 'Sconosciuto';
        const initial = getAvatarStr(c.identita?.nome, c.identita?.cognome, c.identita?.soprannome);
        const color = getAvatarColor(nomeDisp);
        return `
        <div class="contact-card" onclick="selezionaContatto('${c.id}')">
            <div class="avatar" style="background-color: ${color}">${initial}</div>
            <div class="card-info">
                <h3>${nomeDisp}</h3>
                <div class="ruolo-text">${c.background?.ruolo || c.background?.organizzazione || ''}</div>
                <div class="tag-cloud" style="margin-top: 4px;">
                    ${(c.tags || []).slice(0, 3).map(t => `<span class="badge">#${t}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => caricaContatti(e.target.value), 200);
});

window.selezionaContatto = async function(id) {
    contattoSelezionatoId = id;
    const res = await fetch(`/api/contatto?id=${id}`);
    const { nodo, connessioni } = await res.json();

    const nome = nodo.identita?.display_name || 'Senza Nome';
    const avEl = document.getElementById('detAvatar');
    avEl.textContent = getAvatarStr(nodo.identita?.nome, nodo.identita?.cognome, nodo.identita?.soprannome);
    avEl.style.backgroundColor = getAvatarColor(nome);

    document.getElementById('detNome').textContent = nome;
    
    let subtitle = nodo.background?.ruolo || '';
    if (nodo.background?.organizzazione) subtitle += ` @ ${nodo.background.organizzazione}`;
    document.getElementById('detRuolo').textContent = subtitle || 'Nessun ruolo specificato';
    
    document.getElementById('detTags').innerHTML = (nodo.tags || []).map(t => `<span class="badge">#${t}</span>`).join('') || '<span class="ruolo-text">-</span>';
    
    const emails = (nodo.contatti?.emails || []).map(e => `<div>📧 ${e.valore}</div>`).join('');
    const telefoni = (nodo.contatti?.telefoni || []).map(t => `<div>📱 ${t.valore}</div>`).join('');
    const socials = (nodo.contatti?.socials || []).map(s => `<div>🌐 [${s.piattaforma}] ${s.username}</div>`).join('');
    
    document.getElementById('detContatti').innerHTML = (emails || telefoni || socials) ? `${emails}${telefoni}${socials}` : '<span class="ruolo-text">Nessun recapito</span>';
    
    document.getElementById('detNote').textContent = nodo.note_aggiuntive || 'Nessuna nota.';

    document.getElementById('detRelazioniTitle').textContent = `🔗 Connessioni (${connessioni.length})`;
    document.getElementById('detVicini').innerHTML = connessioni.map(v => {
        const cColor = getAvatarColor(v.display_name);
        const cInit = getAvatarStr(v.display_name);
        return `
        <div class="relazione-item" onclick="selezionaContatto('${v.id}')" style="display:flex; align-items:center; gap:0.5rem">
            <div class="avatar" style="width:30px; height:30px; font-size:0.8rem; background:${cColor}">${cInit}</div>
            <div>
                <strong style="font-size:0.9rem">${v.display_name}</strong>
                <div class="ruolo-text">${v.ruolo}</div>
            </div>
        </div>`;
    }).join('') || '<div class="ruolo-text">Nessuna connessione</div>';

    apriDettaglio();
};

document.getElementById('btnEliminaContatto').addEventListener('click', async () => {
    if (!contattoSelezionatoId || !confirm("Vuoi recidere questo nodo dal grafo?")) return;
    await fetch(`/api/contatti?id=${contattoSelezionatoId}`, { method: 'DELETE' });
    chiudiDettaglio();
    aggiornaStats();
    caricaContatti();
});

// ==========================================
// LOGICA FORM DINAMICO (Aggiunta)
// ==========================================
let rowCounters = { telefoni: 0, emails: 0, socials: 0 };

window.aggiungiRiga = function(tipo) {
    const container = document.getElementById(`container-${tipo}`);
    const id = rowCounters[tipo]++;
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.id = `row-${tipo}-${id}`;

    if (tipo === 'socials') {
        row.innerHTML = `
            <select class="input-social-plat">
                <option value="LinkedIn">LinkedIn</option>
                <option value="Instagram">Instagram</option>
                <option value="X">X (Twitter)</option>
                <option value="GitHub">GitHub</option>
                <option value="Sito Web">Sito Web</option>
            </select>
            <input type="text" class="input-social-val" placeholder="Username o URL">
            <button type="button" class="btn-remove" onclick="document.getElementById('${row.id}').remove()">✕</button>
        `;
    } else {
        const ph = tipo === 'telefoni' ? '+39 ...' : 'email@...';
        const inputType = tipo === 'telefoni' ? 'tel' : 'email';
        row.innerHTML = `
            <input type="${inputType}" class="input-${tipo}" placeholder="${ph}">
            <button type="button" class="btn-remove" onclick="document.getElementById('${row.id}').remove()">✕</button>
        `;
    }
    container.appendChild(row);
};

// ==========================================
// LOGICA CONNESSIONI (Mini Rubrica & Chips)
// ==========================================
const btnApriMiniRubrica = document.getElementById('btnApriMiniRubrica');
const btnChiudiMiniRubrica = document.getElementById('btnChiudiMiniRubrica');
const modalConnessioni = document.getElementById('modalConnessioni');
const cercaConnessioni = document.getElementById('cercaConnessioni');
const listaMiniRubrica = document.getElementById('listaMiniRubrica');
const connessioniScelteContainer = document.getElementById('connessioni-scelte');
const btnConfermaConnessioni = document.getElementById('btnConfermaConnessioni');

function renderChipsConnessioni() {
    connessioniScelteContainer.innerHTML = '';
    connessioniSelezionate.forEach((nodo, id) => {
        const nomeD = nodo.identita?.display_name || 'Sconosciuto';
        const init = getAvatarStr(nodo.identita?.nome, nodo.identita?.cognome, nodo.identita?.soprannome);
        const color = getAvatarColor(nomeD);
        
        connessioniScelteContainer.innerHTML += `
            <div class="badge-chip">
                <div class="avatar-micro" style="background:${color}; color:#fff;">${init}</div>
                ${nomeD}
                <button type="button" class="chip-remove" onclick="rimuoviConnessione('${id}')">✕</button>
            </div>
        `;
    });
}

window.rimuoviConnessione = function(id) {
    connessioniSelezionate.delete(id);
    renderChipsConnessioni();
};

// Funzione riscritta per la visualizzazione a griglia e fallback nome/soprannome
function renderMiniRubrica(filtro = '') {
    const query = filtro.toLowerCase();
    
    // Filtriamo sia per nome che per soprannome
    const filtrati = cacheContattiRubrica.filter(n => {
        const dn = (n.identita?.display_name || '').toLowerCase();
        const sn = (n.identita?.soprannome || '').toLowerCase();
        return dn.includes(query) || sn.includes(query);
    });
    
    listaMiniRubrica.innerHTML = filtrati.map(c => {
        const nomeReale = c.identita?.nome || '';
        const cognomeReale = c.identita?.cognome || '';
        const soprannome = c.identita?.soprannome || '';

        let titoloPrincipale = '';
        let sottoTitolo = '';

        // Logica di priorità Nome vs Soprannome
        if (nomeReale) {
            titoloPrincipale = `${nomeReale} ${cognomeReale}`.trim();
            sottoTitolo = soprannome ? `"${soprannome}"` : '';
        } else if (soprannome) {
            titoloPrincipale = soprannome; // Soprannome in primo piano
            sottoTitolo = ''; 
        } else {
            titoloPrincipale = 'Sconosciuto';
        }

        const init = getAvatarStr(nomeReale, cognomeReale, soprannome);
        const color = getAvatarColor(titoloPrincipale);
        const isSelected = connessioniSelezionate.has(c.id);
        
        return `
        <div class="candidate-grid-card ${isSelected ? 'selected' : ''}" onclick="toggleConnessioneCard(this, '${c.id}')">
            <!-- Avatar ingrandito a 60x60 -->
            <div class="avatar" style="background:${color}; width:60px; height:60px; font-size:1.6rem; margin-bottom:0.8rem;">${init}</div>
            
            <!-- Testi centrati e tagliati con i puntini se troppo lunghi -->
            <div style="font-weight:600; font-size:0.9rem; text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${titoloPrincipale}
            </div>
            
            <!-- Sottotitolo (il soprannome, se presente). Min-height evita collassi layout -->
            <div style="font-size:0.75rem; color:var(--text-muted); text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-height:16px; margin-top:2px;">
                ${sottoTitolo}
            </div>
        </div>`;
    }).join('');
}

// Nuova funzione per gestire il tap sull'intera carta (senza checkbox)
window.toggleConnessioneCard = function(cardElement, id) {
    if (connessioniSelezionate.has(id)) {
        // Deseleziona: rimuove dalla mappa e toglie la classe visiva
        connessioniSelezionate.delete(id);
        cardElement.classList.remove('selected');
    } else {
        // Seleziona: aggiunge alla mappa e applica la classe visiva
        const nodo = cacheContattiRubrica.find(n => n.id === id);
        if (nodo) {
            connessioniSelezionate.set(id, nodo);
            cardElement.classList.add('selected');
        }
    }
};

window.toggleConnessione = function(checkbox, id) {
    if (checkbox.checked) {
        const nodo = cacheContattiRubrica.find(n => n.id === id);
        if (nodo) connessioniSelezionate.set(id, nodo);
        checkbox.parentElement.classList.add('selected');
    } else {
        connessioniSelezionate.delete(id);
        checkbox.parentElement.classList.remove('selected');
    }
};

btnApriMiniRubrica.addEventListener('click', () => {
    cercaConnessioni.value = '';
    renderMiniRubrica();
    modalConnessioni.classList.remove('hidden');
});

btnChiudiMiniRubrica.addEventListener('click', () => modalConnessioni.classList.add('hidden'));

btnConfermaConnessioni.addEventListener('click', () => {
    renderChipsConnessioni();
    modalConnessioni.classList.add('hidden');
});

cercaConnessioni.addEventListener('input', (e) => renderMiniRubrica(e.target.value));

// ==========================================
// SUBMIT FORM E MODALE DUPLICATI
// ==========================================
document.getElementById('formContatto').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nome').value.trim();
    const cognome = document.getElementById('cognome').value.trim();
    const soprannome = document.getElementById('soprannome').value.trim();
    
    // Validazione personalizzata: almeno nome O soprannome
    if (!nome && !soprannome) {
        alert("Attenzione: devi inserire almeno il Nome o il Soprannome.");
        return;
    }

    const tagsRaw = document.getElementById('tags').value;
    
    // Estrai dati dai campi dinamici
    const arrTelefoni = Array.from(document.querySelectorAll('.input-telefoni')).map(el => el.value.trim()).filter(v => v).map(v => ({ tipo: 'cellulare', valore: v }));
    const arrEmails = Array.from(document.querySelectorAll('.input-emails')).map(el => el.value.trim()).filter(v => v).map(v => ({ tipo: 'principale', valore: v }));
    const arrSocials = Array.from(document.querySelectorAll('#container-socials .dynamic-row')).map(row => {
        const plat = row.querySelector('.input-social-plat').value;
        const val = row.querySelector('.input-social-val').value.trim();
        return val ? { piattaforma: plat, username: val } : null;
    }).filter(v => v);

    const payload = {
        dati: {
            identita: { 
                nome: nome || undefined, 
                cognome: cognome || undefined, 
                soprannome: soprannome || undefined,
                data_nascita: document.getElementById('data_nascita').value || undefined
            },
            background: { 
                ruolo: document.getElementById('ruolo').value.trim() || undefined,
                organizzazione: document.getElementById('azienda').value.trim() || undefined,
                titolo_studio: document.getElementById('titolo_studio').value.trim() || undefined
            },
            tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
            contatti: {
                emails: arrEmails,
                telefoni: arrTelefoni,
                socials: arrSocials
            },
            note_aggiuntive: document.getElementById('note_aggiuntive').value.trim() || undefined
        },
        chiaveUnivoca: arrEmails.length > 0 ? arrEmails[0].valore : null,
        connettiA: Array.from(connessioniSelezionate.keys()) // Passa gli ID al backend
    };

    // Controllo Fuzzy Match
    const verifyRes = await fetch('/api/verifica-duplicati', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload.dati) });
    const candidati = await verifyRes.json();

    if (candidati.length > 0) {
        payloadInAttesa = payload;
        
        document.getElementById('listaCandidati').innerHTML = candidati.map(cand => {
            const nomeD = cand.nodo.identita?.display_name || 'Sconosciuto';
            const init = getAvatarStr(cand.nodo.identita?.nome, cand.nodo.identita?.cognome, cand.nodo.identita?.soprannome);
            const color = getAvatarColor(nomeD);
            return `
            <div class="contact-card" style="margin-bottom:0.5rem">
                <div class="avatar" style="background:${color}">${init}</div>
                <div class="card-info">
                    <strong>${nomeD}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted)">${cand.nodo.background?.ruolo || 'Nessun ruolo'}</div>
                    <div style="font-size:0.75rem; color:#6b7280; margin-top:4px;">Conosce: ${cand.connessioni.map(c => c.nome).join(', ') || 'Nessuno'}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                    <span style="color:var(--primary); font-weight:bold;">${cand.score}%</span>
                    <button class="btn-primary" style="padding: 0.3rem 0.6rem; width:auto; font-size:0.8rem;" onclick="eseguiMerge('${cand.nodo.id}')">Unisci</button>
                </div>
            </div>`;
        }).join('');
        document.getElementById('modalDuplicati').classList.remove('hidden');
    } else {
        await salvaDefinitivo(payload);
    }
});

document.getElementById('btnAnnullaModal').addEventListener('click', () => {
    document.getElementById('modalDuplicati').classList.add('hidden');
    payloadInAttesa = null;
});

document.getElementById('btnForzaCreazione').addEventListener('click', async () => {
    document.getElementById('modalDuplicati').classList.add('hidden');
    if (payloadInAttesa) await salvaDefinitivo(payloadInAttesa);
});

window.eseguiMerge = async function(idTarget) {
    await fetch('/api/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idTarget, nuoviDati: payloadInAttesa.dati }) });
    
    // Se c'erano connessioni da fare, le facciamo al nodo mergiato (simuliamo salvataggio)
    if (payloadInAttesa.connettiA.length > 0) {
        // ... (Logica backend per connessioni in merge non inclusa nell'API attuale, va bene così per ora)
    }

    document.getElementById('modalDuplicati').classList.add('hidden');
    concludiSalvataggio();
};

async function salvaDefinitivo(payload) {
    await fetch('/api/contatti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    concludiSalvataggio();
}

function concludiSalvataggio() {
    document.getElementById('formContatto').reset();
    document.getElementById('container-telefoni').innerHTML = '';
    document.getElementById('container-emails').innerHTML = '';
    document.getElementById('container-socials').innerHTML = '';
    connessioniSelezionate.clear();
    renderChipsConnessioni();
    payloadInAttesa = null;
    
    aggiornaStats();
    caricaContatti();
    document.querySelector('[data-target="lista"]').click();
}

// Inizializzazione
aggiornaStats();
caricaContatti();