import { CONFIG } from './config.js';

const CHAVE_SESSAO = 'fu_sessao';

const el = {
  login: document.getElementById('ecra-login'),
  dados: document.getElementById('ecra-dados'),
  quem: document.getElementById('quem'),
  lista: document.getElementById('lista'),
  estado: document.getElementById('estado'),
  sair: document.getElementById('sair'),
  botaoGoogle: document.getElementById('botao-google')
};

/* ---------- Comunicação com o servidor ---------- */

// Enviamos texto simples (sem cabeçalhos especiais) para o Apps Script aceitar o pedido
async function chamarServidor(corpo) {
  const resposta = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify(corpo),
    redirect: 'follow'
  });
  return resposta.json();
}

/* ---------- Estado e ecrãs ---------- */

function mostrarEstado(texto) {
  el.estado.textContent = texto || '';
}

function mostrarLogin() {
  el.dados.hidden = true;
  el.login.hidden = false;
  iniciarGoogle();
}

function mostrarDados(r) {
  el.login.hidden = true;
  el.dados.hidden = false;
  el.quem.textContent = r.email + ' (' + (r.papel === 'manager' ? 'Manager' : 'PT') + ')';

  el.lista.replaceChildren();
  if (r.linhas.length === 0) {
    const vazio = document.createElement('li');
    vazio.className = 'cartao';
    vazio.textContent = 'Sem dados para este email.';
    el.lista.appendChild(vazio);
    return;
  }
  r.linhas.forEach(function (linha) {
    const li = document.createElement('li');
    li.className = 'cartao';
    const msg = document.createElement('strong');
    msg.textContent = linha.mensagem;           // textContent: nunca interpreta HTML
    const dono = document.createElement('span');
    dono.textContent = linha.email;
    li.append(msg, dono);
    el.lista.appendChild(li);
  });
}

/* ---------- Login Google ---------- */

function esperarGoogle() {
  return new Promise(function (resolver) {
    const t = setInterval(function () {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(t);
        resolver();
      }
    }, 100);
  });
}

let googleIniciado = false;

async function iniciarGoogle() {
  await esperarGoogle();
  if (!googleIniciado) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.CLIENT_ID,
      callback: aoEntrarGoogle,
      auto_select: true
    });
    googleIniciado = true;
  }
  el.botaoGoogle.replaceChildren();
  window.google.accounts.id.renderButton(el.botaoGoogle, {
    theme: 'filled_black',
    size: 'large',
    text: 'signin_with',
    locale: 'pt-PT'
  });
}

async function aoEntrarGoogle(resposta) {
  mostrarEstado('A validar o acesso...');
  try {
    const r = await chamarServidor({ acao: 'login', idToken: resposta.credential });
    if (!r.ok) {
      mostrarEstado(r.erro || 'Não foi possível entrar.');
      return;
    }
    localStorage.setItem(CHAVE_SESSAO, r.sessao);
    await carregarDados();
  } catch (err) {
    mostrarEstado('Sem ligação ao servidor. Verifica o URL em config.js.');
  }
}

/* ---------- Dados ---------- */

async function carregarDados() {
  const sessao = localStorage.getItem(CHAVE_SESSAO);
  if (!sessao) { mostrarLogin(); return; }

  mostrarEstado('A carregar...');
  try {
    const r = await chamarServidor({ acao: 'dados', sessao: sessao });
    if (!r.ok) {
      localStorage.removeItem(CHAVE_SESSAO);
      mostrarEstado(r.erro === 'sessao' ? 'A sessão terminou. Entra outra vez.' : r.erro);
      mostrarLogin();
      return;
    }
    mostrarEstado('');
    mostrarDados(r);
  } catch (err) {
    mostrarEstado('Sem ligação ao servidor. Tenta outra vez.');
  }
}

/* ---------- Sair ---------- */

el.sair.addEventListener('click', function () {
  localStorage.removeItem(CHAVE_SESSAO);
  if (window.google && window.google.accounts) {
    window.google.accounts.id.disableAutoSelect();
  }
  mostrarEstado('');
  mostrarLogin();
});

/* ---------- Arranque ---------- */

carregarDados();
