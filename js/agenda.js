const APPTS = [
  { dia: 0, hora: 8,  min: 0,  dur: 30, paciente: 'Maria Silva',        proc: 'Retorno',        status: 'confirmado' },
  { dia: 0, hora: 9,  min: 0,  dur: 45, paciente: 'João Pereira',       proc: 'Extração',       status: 'pendente'   },
  { dia: 0, hora: 10, min: 30, dur: 60, paciente: 'Ana Beatriz Santos', proc: 'Clareamento',    status: 'confirmado' },
  { dia: 0, hora: 14, min: 0,  dur: 30, paciente: 'Carlos Mendes',      proc: 'Ortodontia',     status: 'confirmado' },
  { dia: 0, hora: 15, min: 30, dur: 60, paciente: 'Fernanda Lima',      proc: 'Implante — Aval.', status: 'pendente' },
  { dia: 2, hora: 9,  min: 0,  dur: 30, paciente: 'Roberta Nunes',      proc: 'Limpeza',        status: 'confirmado' },
  { dia: 2, hora: 11, min: 0,  dur: 45, paciente: 'Paulo César',        proc: 'Canal',          status: 'confirmado' },
  { dia: 3, hora: 10, min: 0,  dur: 30, paciente: 'Larissa Mota',       proc: 'Restauração',    status: 'pendente'   },
  { dia: 4, hora: 8,  min: 30, dur: 60, paciente: 'Bruno Alves',        proc: 'Prótese',        status: 'confirmado' },
];

const HOURS = [7,8,9,10,11,12,13,14,15,16,17,18];
const DAYS_FULL  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
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
      const curMin = h * 60 + half * 30;
      html += '<tr>';
      if (half === 0) html += `<td class="time-cell" rowspan="2">${String(h).padStart(2,'0')}:00</td>`;
      days.forEach((d,di) => {
        const appt = APPTS.find(a => a.dia === di && a.hora === h && (half===0 ? a.min<30 : a.min>=30));
        if (appt) {
          html += `<td style="padding:3px;" class="clickable">
            <div class="appt-block ${appt.status}" title="${appt.paciente} — ${appt.proc}">
              <span style="font-size:10px;font-weight:700">${appt.proc}</span>
              <span style="font-size:9px;opacity:.85">${appt.paciente}</span>
            </div>
          </td>`;
        } else {
          html += `<td class="clickable" onclick="openModal('modal-novo-agendamento')"></td>`;
        }
      });
      html += '</tr>';
    });
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  const dateInput = document.getElementById('input-data-ag');
  if (dateInput) dateInput.valueAsDate = new Date();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
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
