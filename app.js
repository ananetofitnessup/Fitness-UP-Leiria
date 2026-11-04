import { API_URL, CLIENT_ID } from './config.js';
const $ = s => document.querySelector(s);
const eur = n => Number(n || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const num = n => Number(n || 0).toLocaleString('pt-PT', { maximumFractionDigits: 1 });
const sum = a => a.reduce((x, y) => x + Number(y || 0), 0);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
let S = localStorage.getItem('fu_sessao'), EU = null, sel = null, charts = [];

async function post(corpo) {
  const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  return r.json();
}
async function api(acao, extra = {}) {
  const j = await post({ acao, sessao: S, ...extra });
  if (j.erro === 'sessao') { sair(); throw new Error('sessao'); }
  return j;
}
function sair() {
  S = null; localStorage.removeItem('fu_sessao'); EU = null; sel = null;
  mostrarLogin();
}
$('#sair').onclick = sair;

function mostrarLogin(msg) {
  $('#login').hidden = false; $('#app').hidden = true; $('#nav').hidden = true; $('#sair').hidden = true;
  $('#estado').textContent = msg || '';
  const t = setInterval(() => {
    if (!window.google || !google.accounts) return;
    clearInterval(t);
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: async x => {
      $('#estado').textContent = 'A entrar…';
      try {
        const j = await post({ acao: 'login', idToken: x.credential });
        if (!j.ok) return mostrarLogin(j.erro);
        S = j.sessao; localStorage.setItem('fu_sessao', S); arrancar();
      } catch (e) { mostrarLogin('Sem ligação. Tenta outra vez.'); }
    } });
    google.accounts.id.renderButton($('#botao-google'), { theme: 'filled_black', size: 'large', locale: 'pt-PT' });
  }, 200);
}

async function arrancar() {
  if (!S) return mostrarLogin();
  try { EU = await api('eu'); } catch (e) { if (e.message !== 'sessao') $('#estado').textContent = 'Sem ligação. Tenta outra vez.'; return; }
  $('#login').hidden = true; $('#app').hidden = false; $('#nav').hidden = false; $('#sair').hidden = false; $('#estado').textContent = '';
  const man = EU.papel === 'manager'; sel = EU.nome || null;
  const abas = [];
  if (man) abas.push(['equipa', 'Equipa']);
  if (man || EU.nome) abas.push(['inicio', 'Início'], ['hist', 'Progresso']);
  if (EU.negocio) abas.push(['neg', 'Negócio']);
  $('#nav').innerHTML = abas.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach(b => b.onclick = () => abrir(b.dataset.k));
  abrir(abas[0][0]);
}

async function abrir(k) {
  $('#nav').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const v = $('#vista'); v.innerHTML = '<p class="c">A carregar…</p>';
  charts.forEach(c => c.destroy()); charts = [];
  try {
    if (k === 'equipa') return equipa(v, await api('equipa'));
    if (k === 'neg') return neg(v, await api('negocio'));
    if (!sel) { v.innerHTML = '<p class="c">Escolhe um PT em «Equipa».</p>'; return; }
    const d = await api('pt', { nome: sel });
    if (!d.ok) { v.innerHTML = `<p class="c">${esc(d.erro)}</p>`; return; }
    k === 'inicio' ? inicio(v, d) : hist(v, d);
  } catch (e) { if (e.message !== 'sessao') v.innerHTML = '<p class="c">Sem ligação. Tenta outra vez.</p>'; }
}

function equipa(v, d) {
  v.innerHTML = '<h2>Equipa</h2>' + d.pts.map(p => `<button class="k pt" data-n="${esc(p.nome)}"><b>${esc(p.nome)}</b>
    <em>Mês: ${eur(p.fat)} · ${num(p.horas)} h · comissão ${eur(p.comissao)}</em>
    <em>Próximo mês (previsão): ${eur(p.prevFat)} · comissão ${eur(p.prevCom)}</em></button>`).join('');
  v.querySelectorAll('.pt').forEach(b => b.onclick = () => { sel = b.dataset.n; abrir('inicio'); });
}

function inicio(v, d) {
  const m = d.mes, p = d.prox;
  v.innerHTML = `<h2>${esc(d.nome)}</h2>
  <div class="g"><div class="k y"><small>Faturado este mês</small><b>${eur(m.fat)}</b></div>
  <div class="k b"><small>Horas este mês</small><b>${num(m.horas)} h</b></div></div>
  <div class="k" style="margin-top:10px"><small>Comissão a receber · ${Math.round(m.pct * 100)}% · escalão ${esc(m.escalao)}</small><b>${eur(m.comissao)}</b>
  ${Number(m.faltam) > 0 ? `<em>Faltam ${num(m.faltam)} h para o escalão seguinte</em>` : ''}</div>
  <h3>Previsão até ao fim do mês</h3>
  <div class="g"><div class="k"><small>Faturação</small><b>${eur(m.prevFat)}</b></div><div class="k"><small>Horas</small><b>${num(m.prevHoras)} h</b></div></div>
  <h3>Previsão do próximo mês</h3>
  <div class="g"><div class="k"><small>Faturação</small><b>${eur(p.fat)}</b></div><div class="k"><small>Horas</small><b>${num(p.horas)} h</b></div></div>
  <div class="k" style="margin-top:10px"><small>Comissão prevista · ${Math.round(p.pct * 100)}%</small><b>${eur(p.comissao)}</b></div>
  <h3>Fechos novos</h3>
  <div class="k"><b>${num(m.fechos)}</b> fechos · ${num(m.fechosH)} h · ${eur(m.fechosFat)}<em>${num(m.clientes)} alunos ativos</em></div>`;
}

function grafico(id, tipo, dados, extra) {
  const o = { responsive: true, plugins: { legend: { labels: { color: '#999' } } }, scales: { x: { ticks: { color: '#999' } }, y: { ticks: { color: '#999' } } } };
  charts.push(new Chart($(id), { type: tipo, data: { labels: extra || MES, datasets: dados }, options: o }));
}

function hist(v, d) {
  const h = d.hist;
  v.innerHTML = `<h2>${esc(d.nome)} · ${h.ano}</h2>
  <div class="g"><div class="k y"><small>Faturado no ano</small><b>${eur(sum(h.fat))}</b></div><div class="k b"><small>Horas no ano</small><b>${num(sum(h.horas))} h</b></div></div>
  <h3>Faturação e comissão</h3><div class="k"><canvas id="c1"></canvas></div>
  <h3>Horas</h3><div class="k"><canvas id="c2"></canvas></div>`;
  grafico('#c1', 'bar', [{ label: 'Faturação', data: h.fat, backgroundColor: '#FFD600' }, { label: 'Comissão', data: h.comissao, backgroundColor: '#1F5BFF' }]);
  grafico('#c2', 'line', [{ label: 'Horas', data: h.horas, borderColor: '#1F5BFF', backgroundColor: '#1F5BFF' }]);
}

function neg(v, d) {
  if (!d.ok) { v.innerHTML = `<p class="c">${esc(d.erro)}</p>`; return; }
  const m = d.mes;
  v.innerHTML = `<h2>Negócio · ${d.ano}</h2>
  <div class="g"><div class="k y"><small>Target do mês</small><b>${eur(m.target)}</b></div><div class="k b"><small>Faturado até agora</small><b>${eur(m.fat)}</b></div></div>
  <div class="g" style="margin-top:10px"><div class="k"><small>Previsão do mês seguinte</small><b>${eur(m.prev)}</b></div><div class="k"><small>Target mês seguinte</small><b>${eur(m.targetProx)}</b></div></div>
  <h3>Target vs faturação</h3><div class="k"><canvas id="c1"></canvas></div>`;
  grafico('#c1', 'bar', [{ label: 'Target', data: d.target, backgroundColor: '#1F5BFF' }, { label: 'Faturação', data: d.fat, backgroundColor: '#FFD600' }]);
}

arrancar();
