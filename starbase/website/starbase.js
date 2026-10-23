/*
 * Starbase website embed — connects the Imagine Surrey website to Starbase.
 *
 *   <script src="https://YOUR-STARBASE/embed/starbase.js" data-key="pk_..." defer></script>
 *
 * Forms:    <form data-starbase-form="signup|volunteer|sign|contact|pledge|endorse">
 *           Field names: first_name, last_name (or name), email, phone, postal_code,
 *           address, email_opt_in, message, issues. Submissions are merged into
 *           Starbase's People database.
 *           Optional: data-starbase-success="Thanks!" and data-starbase-redirect="/thanks".
 * Counters: <span data-starbase-stat="doors_knocked|conversations|volunteers|sign_requests|supporters">
 */
(function () {
  'use strict';
  var script = document.currentScript || document.querySelector('script[src*="/embed/starbase.js"]');
  if (!script) return;
  var key = script.getAttribute('data-key');
  var endpoint = script.getAttribute('data-endpoint') || script.src.replace(/\/embed\/starbase\.js.*$/, '');
  if (!key) { console.warn('[Starbase] Missing data-key on the embed script tag'); return; }

  function post(form, data) {
    return fetch(endpoint + '/api/public/forms/' + encodeURIComponent(form), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Starbase-Key': key },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
        return body;
      });
    });
  }

  function serialize(form) {
    var data = {};
    var issues = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'checkbox') {
        if (el.name === 'issues') { if (el.checked) issues.push(el.value); }
        else data[el.name] = el.checked ? (el.value && el.value !== 'on' ? el.value : '1') : '0';
        return;
      }
      if (el.type === 'radio' && !el.checked) return;
      data[el.name] = el.value;
    });
    if (issues.length) data.issues = issues;
    return data;
  }

  function message(form, text, isError) {
    var box = form.querySelector('[data-starbase-message]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-starbase-message', '');
      box.setAttribute('role', 'status');
      form.appendChild(box);
    }
    box.textContent = text;
    box.style.color = isError ? '#b42318' : '';
  }

  function bindForm(form) {
    if (form.__starbase) return;
    form.__starbase = true;
    // Honeypot field: hidden from people, irresistible to bots.
    if (!form.querySelector('[name="website"]')) {
      var hp = document.createElement('input');
      hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
      hp.setAttribute('aria-hidden', 'true');
      hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
      form.appendChild(hp);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
      if (btn) btn.disabled = true;
      post(form.getAttribute('data-starbase-form'), serialize(form)).then(function (res) {
        var redirect = form.getAttribute('data-starbase-redirect');
        if (redirect) { window.location.href = redirect; return; }
        form.reset();
        message(form, form.getAttribute('data-starbase-success') || res.message || 'Thank you!');
        form.dispatchEvent(new CustomEvent('starbase:success', { detail: res }));
      }).catch(function (err) {
        message(form, err.message, true);
        form.dispatchEvent(new CustomEvent('starbase:error', { detail: err }));
      }).then(function () { if (btn) btn.disabled = false; });
    });
  }

  function loadStats() {
    var els = document.querySelectorAll('[data-starbase-stat]');
    if (!els.length) return;
    fetch(endpoint + '/api/public/stats', { headers: { 'X-Starbase-Key': key } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (stats) {
        if (!stats) return;
        Array.prototype.forEach.call(els, function (el) {
          var v = stats[el.getAttribute('data-starbase-stat')];
          if (typeof v === 'number') el.textContent = v.toLocaleString();
        });
      }).catch(function () {});
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('form[data-starbase-form]'), bindForm);
    loadStats();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.Starbase = { submit: post, refreshStats: loadStats, bind: bindForm };
})();
