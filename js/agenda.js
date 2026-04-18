let APPTS = [];
const HOURS = [7,8,9,10,11,12,13,14,15,16,17,18];
const DAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let currentMonday = getMonday(new Date());

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  dt.setHours(0,0,0,0);
  return dt;
}

function formatRange(monday) {
  const fri = new Date(monday); fri.setDate(fri.getDate() + 6);
  const m = monday.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  const f = fri.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
  return `${m} – ${f}`;
}

function loadAppts() {
  APPTS = window.FakeDB ? window.FakeDB.agendamentos.list() : [];
  renderGrid();
}

function renderGrid() {
  const today = new Date(); today.setHours(0,0,0,0);
  const container = document.getElementById('agenda-container');
  if (!container) return;

  document.getElementById('semana-label').textContent = formatRange(currentMonday);

  const days = Array.from({length:7}, (_,i)=>{
    const d = new Date(currentMonday); d.setDate(d.getDate()+i); return d;
  });

  let html = '<div class="agenda-grid"><table class="agenda-table"><thead><tr>';
  html += '<th class="time-col">Horário</th>';
  days.forEach((d,i) => {
    const isToday = d.getTime() === today.getTime();
    const dayNum = `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
    html += `<th style="${isToday?'background:var(--primary);':''}">`;
    if (isToday) html += `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#fff;color:var(--primary);font-weight:700;">${d.getDate()}</span> ${DAYS_SHORT[d.getDay()]}`;
    else html += dayNum;
    html += '</th>';
  });
  html += '</tr></thead><tbody>';

  HOURS.forEach(h => {
    [`${h}:00`, `${h}:30`].forEach((slot, half) => {
      html += '<tr>';
      if (half === 0) html += `<td class="time-cell" rowspan="2">${String(h).padStart(2,'0')}:00</td>`;
      days.forEach((d,di) => {
        const appt = APPTS.find(a => a.dia === di && a.hora === h && (half===0 ? a.min<30 : a.min>=30));
        if (appt) {
          html += `<td style="padding:3px;" class="clickable" onclick="openEditModal(${appt.id})">
            <div class="appt-block ${appt.status}" title="${appt.paciente} — ${appt.proc}">
              <span style="font-size:10px;font-weight:700">${appt.proc}</span>
              <span style="font-size:9px;opacity:.85">${appt.paciente}</span>
            </div>
          </td>`;
        } else {
          html += `<td class="clickable" onclick="openNewModal(${di}, ${h}, ${half*30})"></td>`;
        }
      });
      html += '</tr>';
    });
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function openNewModal(dia, hora, min) {
  const modal = document.getElementById('modal-novo-agendamento');
  if (!modal) return;

  // Limpar form
  document.getElementById('modal-appt-id').value = '';
  document.getElementById('modal-paciente').value = '';
  document.getElementById('modal-procedimento').value = '';
  document.getElementById('modal-obs').value = '';
  document.getElementById('modal-status').value = 'confirmado';
  document.getElementById('modal-duracao').value = '30';

  // Setar data/hora
  const d = new Date(currentMonday);
  if (dia !== undefined) {
    d.setDate(d.getDate() + dia);
    document.getElementById('modal-horario').value = `${String(hora).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  } else {
    // Se clicar no botão superior, usa data de hoje e horário padrão
    const today = new Date();
    document.getElementById('modal-horario').value = '08:00';
    d.setTime(today.getTime());
  }
  
  document.getElementById('modal-data').value = d.toISOString().split('T')[0];

  modal.querySelector('.modal-title').textContent = 'Nova Consulta';
  modal.classList.add('open');
}

function openEditModal(id) {
  const appt = APPTS.find(a => a.id == id);
  if (!appt) return;

  const modal = document.getElementById('modal-novo-agendamento');
  if (!modal) return;

  document.getElementById('modal-appt-id').value = appt.id;
  document.getElementById('modal-paciente').value = appt.paciente;
  document.getElementById('modal-procedimento').value = appt.proc;
  document.getElementById('modal-status').value = appt.status;
  document.getElementById('modal-duracao').value = appt.dur || '30';
  document.getElementById('modal-obs').value = appt.obs || '';

  const d = new Date(currentMonday);
  d.setDate(d.getDate() + appt.dia);
  document.getElementById('modal-data').value = d.toISOString().split('T')[0];
  document.getElementById('modal-horario').value = `${String(appt.hora).padStart(2,'0')}:${String(appt.min).padStart(2,'0')}`;

  modal.querySelector('.modal-title').textContent = 'Editar Consulta';
  modal.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function salvarAgendamento() {
  const id = document.getElementById('modal-appt-id').value;
  const paciente = document.getElementById('modal-paciente').value;
  const proc = document.getElementById('modal-procedimento').value;
  const dataStr = document.getElementById('modal-data').value;
  const horario = document.getElementById('modal-horario').value;
  const dur = parseInt(document.getElementById('modal-duracao').value);
  const status = document.getElementById('modal-status').value;
  const obs = document.getElementById('modal-obs').value;

  if (!paciente || !proc || !dataStr || !horario) {
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  // Calcular dia da semana (0-6) em relação à segunda-feira atual
  const selDate = new Date(dataStr + 'T00:00:00');
  const MondayTime = new Date(currentMonday).setHours(0,0,0,0);
  const SelTime = selDate.getTime();
  const diffDays = Math.round((SelTime - MondayTime) / (1000 * 60 * 60 * 24));
  
  const [h, m] = horario.split(':').map(Number);

  const appt = {
    id: id ? parseInt(id) : Date.now(),
    paciente,
    proc,
    dia: diffDays,
    hora: h,
    min: m,
    dur,
    status,
    obs
  };

  if (window.FakeDB) {
    window.FakeDB.agendamentos.save(appt);
  } else {
    if (id) {
      const idx = APPTS.findIndex(a => a.id == id);
      APPTS[idx] = appt;
    } else {
      APPTS.push(appt);
    }
  }

  closeModal('modal-novo-agendamento');
  loadAppts();
}

document.addEventListener('DOMContentLoaded', () => {
  loadAppts();
  
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() - 7); renderGrid();
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() + 7); renderGrid();
  });
  document.getElementById('btn-hoje')?.addEventListener('click', () => {
    currentMonday = getMonday(new Date()); renderGrid();
  });

  document.querySelectorAll('.tab-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-view-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'none'; b.style.color = '';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--primary-light)';
      btn.style.color = 'var(--primary)';
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });
});
