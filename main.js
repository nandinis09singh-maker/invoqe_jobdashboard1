// CareerFlow — shared interactivity

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mobileNav = document.querySelector('[data-mobile-nav]');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
  }

  // Password visibility toggles
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  // Save / bookmark toggle buttons (job cards)
  document.querySelectorAll('[data-save-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const saved = btn.getAttribute('data-saved') === 'true';
      btn.setAttribute('data-saved', String(!saved));
      btn.innerHTML = !saved
        ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v12l7-4 7 4V5a2 2 0 00-2-2H5z"/></svg> Saved'
        : '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v12l7-4 7 4V5a2 2 0 00-2-2H5z"/></svg> Save';
      btn.classList.toggle('bg-[#eef0fb]', !saved);
      btn.classList.toggle('text-[#4338ea]', !saved);
    });
  });

  // Clear filters
  document.querySelectorAll('[data-clear-filters]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scope = document.querySelector(btn.getAttribute('data-clear-filters'));
      if (!scope) return;
      scope.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
    });
  });

  // Simple client-side search/filter on the Find Jobs page
  const jobList = document.querySelector('[data-job-list]');
  const searchInput = document.querySelector('[data-role-search]');
  const resultsCount = document.querySelector('[data-results-count]');
  let searchActive = false; // only start filtering by keyword once the user actually searches

  function applyFilters() {
    if (!jobList) return;
    // Match on ANY word in the query, not the whole phrase — "Graduate roles" should
    // still surface "Graduate Product Designer" even though "roles" isn't in its title.
    const words = searchActive
      ? (searchInput?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
      : [];
    const checkedCities = Array.from(
      document.querySelectorAll('[data-filter="city"]:checked')
    ).map((el) => el.value);

    let visible = 0;
    jobList.querySelectorAll('[data-job]').forEach((card) => {
      const title = card.getAttribute('data-title') || '';
      const city = card.getAttribute('data-city') || '';
      const matchesQuery = words.length === 0 || words.some((w) => title.includes(w));
      const matchesCity = checkedCities.length === 0 || checkedCities.includes(city);
      const show = matchesQuery && matchesCity;
      card.classList.toggle('hidden', !show);
      if (show) visible++;
    });

    if (resultsCount) resultsCount.textContent = `${visible} result${visible === 1 ? '' : 's'}`;
  }

  if (jobList) {
    document.querySelectorAll('[data-filter="city"]').forEach((cb) => cb.addEventListener('change', applyFilters));
    document.querySelector('[data-search-btn]')?.addEventListener('click', () => {
      searchActive = true;
      applyFilters();
    });
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchActive = true;
        applyFilters();
      }
    });
    applyFilters(); // initial render: city filters only, keyword search not yet triggered
  }
});
