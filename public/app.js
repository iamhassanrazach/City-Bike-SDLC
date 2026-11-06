'use strict';

const ui = {
  search: document.querySelector('#search'),
  available: document.querySelector('#available-only'),
  list: document.querySelector('#station-list'),
  count: document.querySelector('#result-count'),
  notification: document.querySelector('#notification'),
  reservePanel: document.querySelector('#reserve-panel'),
  selected: document.querySelector('#selected-station'),
  email: document.querySelector('#email'),
  emailError: document.querySelector('#email-error'),
  result: document.querySelector('#result'),
  form: document.querySelector('#reservation-form'),
  confirm: document.querySelector('#confirm')
};
let stations = [];
let selected = null;

function showError(message) {
  ui.notification.hidden = false;
  ui.notification.replaceChildren(document.createTextNode(message + ' '));
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = 'Retry loading';
  retry.addEventListener('click', loadStations);
  ui.notification.append(retry);
}

// Render station results based on search term
function renderStations() {
  const term = ui.search.value.trim().toLowerCase();
  const result = stations.filter(s => {
    if (!s.name.toLowerCase().includes(term)) return false;
    if (ui.available.checked && s.bikes <= 0) return false;
    return true;
  });
  ui.count.textContent = `${result.length} station${result.length === 1 ? '' : 's'}`;
  ui.list.replaceChildren();
  if (!result.length) { ui.list.textContent = 'No stations match your filters.'; return; }
  for (const station of result) {
    const card = document.createElement('article'); card.className = 'station-card';
    card.dataset.testid = 'station-card';  // getByTestId in 01 test scans for this
    const details = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = station.name;
    const inventory = document.createElement('p'); inventory.textContent = `${station.bikes} bikes available · ${station.docks} empty docks`;
    details.append(name, inventory);
    const button = document.createElement('button');
    button.textContent = `Reserve at ${station.name}`;
    button.disabled = station.bikes === 0;
    button.addEventListener('click', () => {
      selected = station;
      ui.selected.textContent = `Selected station: ${station.name}`;
      ui.reservePanel.hidden = false;
      ui.result.textContent = '';  // clears container : (1) on Reserve button; (2) After form submission
      ui.email.value = ''; ui.emailError.hidden = true;
      ui.email.focus();
    });
    card.append(details, button); ui.list.append(card);
  }
}
async function loadStations() {
  ui.notification.hidden = true;
  // Placeholder
  ui.list.textContent = 'Loading stations...';
  // Fetch 
  try {
    const response = await fetch('/api/stations');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    stations = payload.stations;
    renderStations();
  } catch (error) {
    stations = []; ui.list.replaceChildren(); ui.count.textContent = '0 stations';
    showError('Unable to load stations.');
  }
}

ui.search.addEventListener('input', renderStations);
ui.available.addEventListener('change', renderStations);
ui.form.addEventListener('submit', async (event) => {
  event.preventDefault();  // stop default action of an event
  ui.emailError.hidden = true; ui.result.textContent = '';
  const email = ui.email.value.trim();
  const reg = /^(?!\.)(?!.*\.\.)(?!.*\.@)[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?!-)[a-zA-Z0-9-]+(?<!-)(?:\.[a-zA-Z0-9-]+(?<!-))*\.[a-zA-Z]{2,}$/
  if (!reg.test(email)) {
    ui.emailError.hidden = false; return;
  }
  ui.confirm.disabled = true;
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId: selected.id, email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Reservation failed');
    ui.result.textContent = `Reservation confirmed: ${data.reservationId}`;
  } catch {
    ui.result.textContent = 'Reservation failed. Please retry.';
  } finally { ui.confirm.disabled = false; }
});
loadStations();
// This is a harmless comment for Mission 2 cache testing
