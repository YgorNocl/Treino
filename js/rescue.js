// Rede de segurança da abertura (script comum, carregado antes do app).
//
// 1. Atalhos do ícone (segurar o ícone do app): ?mode=gym|cali|mobi|run abre direto
//    no modo escolhido.
// 2. Se o app quebrar ao abrir (erro de código, arquivo que não carregou), em vez
//    de ficar parado em "Carregando..." aparece uma tela com: tentar de novo,
//    salvar os dados num arquivo e forçar a atualização. Os dados continuam no
//    celular; a tela só existe para não deixar ninguém sem saída.
(function () {
  var mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'gym' || mode === 'cali' || mode === 'mobi' || mode === 'run') {
    // Corrida fica dentro da Academia (botão ao lado de Superior/Inferior).
    try {
      localStorage.setItem('app:mode', mode === 'run' ? 'gym' : mode);
      if (mode === 'run') localStorage.setItem('gym:view', 'run');
      else if (mode === 'gym') localStorage.setItem('gym:view', 'lift');
    } catch (e) { /* segue no modo salvo */ }
    history.replaceState(null, '', location.pathname);
  }

  var ready = false;
  var panel = null;
  var BOOT_TIMEOUT_MS = 20000;

  function button(label, primary, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin-top:10px;padding:15px;border-radius:14px;font:700 15px sans-serif;cursor:pointer;' +
      (primary ? 'background:#ccff33;color:#0f1113;border:none;' : 'background:#1a1d21;color:#f4f4f2;border:1px solid rgba(255,255,255,0.12);');
    b.addEventListener('click', onClick);
    return b;
  }

  function saveBackup() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    var today = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var name = 'treino-backup-' + today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate()) + '.json';
    var blob = new Blob([JSON.stringify({ app: 'treino', version: 1, exportedAt: today.toISOString(), data: data })], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function forceUpdate() {
    var jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf('treino-cache-') === 0; }).map(function (k) { return caches.delete(k); }));
      }));
    }
    Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
  }

  function show() {
    if (ready || panel || !document.body) return;
    panel = document.createElement('div');
    panel.setAttribute('role', 'alertdialog');
    panel.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0b0c0e;color:#f4f4f2;display:flex;align-items:center;justify-content:center;padding:24px;font-family:sans-serif;';
    var box = document.createElement('div');
    box.style.cssText = 'max-width:360px;width:100%;text-align:center;';
    var title = document.createElement('h2');
    title.textContent = 'O app não abriu direito';
    title.style.cssText = 'font-size:20px;margin:0 0 10px;';
    var text = document.createElement('p');
    text.textContent = 'Seus treinos continuam guardados neste celular. Tente de novo; se continuar, salve os dados num arquivo e force a atualização.';
    text.style.cssText = 'font-size:14px;line-height:1.5;color:#a8afb5;margin:0 0 14px;';
    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(button('Tentar de novo', true, function () { location.reload(); }));
    box.appendChild(button('Salvar backup dos dados', false, saveBackup));
    box.appendChild(button('Forçar atualização do app', false, forceUpdate));
    panel.appendChild(box);
    document.body.appendChild(panel);
  }

  // Erros de código e de script que não carregou (fase de captura). Imagens e
  // fontes que falham (sem internet) não contam.
  window.addEventListener('error', function (e) {
    if (ready) return;
    var t = e.target;
    var isResource = t && t !== window && t.tagName;
    if (isResource && t.tagName !== 'SCRIPT') return;
    setTimeout(show, 300);
  }, true);
  setTimeout(show, BOOT_TIMEOUT_MS);

  // Chamado pelo app quando terminou de abrir.
  window.treinoReady = function () {
    ready = true;
    if (panel) { panel.remove(); panel = null; }
  };
})();
