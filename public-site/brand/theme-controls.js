(function () {
  var button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  function show(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    button.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.querySelector('[data-theme-label]').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  show(document.documentElement.dataset.theme || 'light');
  button.addEventListener('click', function () {
    var theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('smartstaff-theme', theme); } catch (_) {}
    show(theme);
  });
  window.addEventListener('storage', function (event) {
    if (event.key === 'smartstaff-theme') show(event.newValue === 'dark' ? 'dark' : 'light');
  });
})();
