// Versão do app, mostrada em Configurações. Fonte única: a página carrega este
// arquivo e o Service Worker (sw.js) também, via importScripts — o nome do cache
// sai daqui. Mudou alguma coisa no app? Suba este número (2.0 → 2.1 → 2.2...).
// Só isso já faz o celular baixar a versão nova.
self.APP_VERSION = '3.2';
