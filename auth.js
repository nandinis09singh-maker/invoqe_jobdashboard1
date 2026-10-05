/* CareerFlow — shared account logic (put this file in js/auth.js) */
(function () {
  const USER_KEY = 'cf_user';
  const get = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } };
  const initials = n => n.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  /* Show the signed-up user's details anywhere you add data-user-* attributes */
  function fillUser() {
    const u = get();
    if (!u) return;
    const map = { name: u.name, email: u.email, phone: u.phone, avatar: initials(u.name) };
    Object.entries(map).forEach(([k, v]) => {
      document.querySelectorAll('[data-user-' + k + ']').forEach(el => (el.textContent = v));
    });
  }

  /* Input rules: data-name = no digits/symbols, data-phone = digits only, max 10 */
  function wireInputs() {
    document.querySelectorAll('input[data-name]').forEach(i => {
      i.addEventListener('input', () => {
        i.value = i.value.replace(/[^\p{L}\p{M}\s.'-]/gu, '');
      });
    });
    document.querySelectorAll('input[data-phone]').forEach(i => {
      i.maxLength = 10;
      i.inputMode = 'numeric';
      i.addEventListener('input', () => {
        i.value = i.value.replace(/\D/g, '').slice(0, 10);
      });
    });
  }

  /* Inline error message under a field */
  function setErr(input, msg) {
    let p = input._err;
    if (!msg) {
      if (p) p.remove();
      input._err = null;
      input.classList.remove('border-red-500');
      return true;
    }
    if (!p) {
      p = document.createElement('p');
      p.className = 'cf-err text-xs text-red-600 mt-1';
      (input.closest('.relative') || input).insertAdjacentElement('afterend', p);
      input._err = p;
    }
    p.textContent = msg;
    input.classList.add('border-red-500');
    return false;
  }

  function initSignup(form) {
    const q = id => form.querySelector('#' + id);
    const name = q('full-name'), email = q('email'), phone = q('phone'), pass = q('password');
    const fields = [name, email, phone, pass];
    fields.forEach(i => i.addEventListener('input', () => setErr(i, '')));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const n = name.value.trim().replace(/\s+/g, ' ');
      let ok = true;
      ok = setErr(name, n.length < 2 ? 'Enter your full name (letters only).' : '') && ok;
      ok = setErr(email, /^\S+@\S+\.\S+$/.test(email.value.trim()) ? '' : 'Enter a valid email address.') && ok;
      ok = setErr(phone, /^\d{10}$/.test(phone.value) ? '' : 'Mobile number must be exactly 10 digits.') && ok;
      ok = setErr(pass, pass.value.length >= 8 ? '' : 'Password is required (at least 8 characters).') && ok;
      if (!ok) { fields.find(i => i._err).focus(); return; }

      // Demo only: a real site must store/check passwords on a server (hashed).
      localStorage.setItem(USER_KEY, JSON.stringify({
        name: n,
        email: email.value.trim().toLowerCase(),
        phone: phone.value,
        password: pass.value,
        degree: q('degree').value,
        gradYear: q('grad-year').value,
        locations: q('locations').value.trim()
      }));
      localStorage.setItem('cf_name', n); // index.html reads this for the top-right name
      location.href = 'profile.html';
    });
  }

  function initLogin(form) {
    const email = form.querySelector('#email'), pass = form.querySelector('#password');
    const u = get();
    if (u) { email.value = u.email; pass.value = ''; }
    [email, pass].forEach(i => i.addEventListener('input', () => setErr(i, '')));

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!pass.value) { setErr(pass, 'Password is required.'); pass.focus(); return; }
      if (u) {
        if (email.value.trim().toLowerCase() !== u.email) { setErr(email, 'No account found with this email. Please sign up.'); return; }
        if (pass.value !== u.password) { setErr(pass, 'Incorrect password.'); return; }
        localStorage.setItem('cf_name', u.name);
      }
      location.href = 'index.html';
    });
  }

  function syncPersonalData() {
    const u = get();
    if (!u) return;

    // Replace old demo identity anywhere it appears as visible text.
    const replacements = [
      ['Aarav Mehta', u.name],
      ['AARAV MEHTA', u.name.toUpperCase()],
      ['Aarav_Mehta', u.name.replace(/\s+/g, '_')],
      ['aarav.mehta@gmail.com', u.email],
      ['aaravmehta@gmail.com', u.email],
      ['linkedin.com/in/aaravmehta', 'linkedin.com/in/' + u.name.toLowerCase().replace(/[^a-z0-9]+/g, '')],
      ['github.com/aaravmehta', 'github.com/' + u.name.toLowerCase().replace(/[^a-z0-9]+/g, '')],
      ['aaravbuilds.dev', u.name.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.dev']
    ];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let value = node.nodeValue;
      replacements.forEach(([from, to]) => {
        value = value.split(from).join(to);
      });
      node.nodeValue = value;
    });

    // Update common form fields / values that are attributes, not text nodes.
    const nameField = document.getElementById('full-name');
    if (nameField && u.name) nameField.value = u.name;
    const emailField = document.querySelector('#email');
    if (emailField && u.email) emailField.value = u.email;
    const phoneField = document.getElementById('phone');
    if (phoneField && u.phone) phoneField.value = u.phone;

    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = u.name);
    document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = u.email);
    document.querySelectorAll('[data-user-phone]').forEach(el => el.textContent = u.phone);
    document.querySelectorAll('[data-user-avatar]').forEach(el => el.textContent = initials(u.name));

    // Show the graduation year selected during signup. For a typical 4-year
    // bachelor's degree, calculate the corresponding start year as well.
    const educationYears = document.getElementById('education-years');
    if (educationYears && u.gradYear) {
      const endYear = Number(u.gradYear);
      educationYears.textContent = Number.isFinite(endYear) ? `${endYear - 4}–${endYear}` : u.gradYear;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireInputs();
    fillUser();
    syncPersonalData();
    const s = document.getElementById('signupForm');
    if (s) initSignup(s);
    const l = document.getElementById('loginForm');
    if (l) initLogin(l);
  });
})();
