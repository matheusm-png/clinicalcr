/**
 * FakeDB - Camada de persistência em LocalStorage para o protótipo.
 * Preparado para ser substituído por chamadas de API do Supabase.
 */

const FakeDB = {
  get(key, defaultVal = []) {
    const data = localStorage.getItem('lcr_' + key);
    return data ? JSON.parse(data) : defaultVal;
  },
  save(key, val) {
    localStorage.setItem('lcr_' + key, JSON.stringify(val));
    return val;
  },

  // PACIENTES
  pacientes: {
    list() {
      let list = FakeDB.get('pacientes', []);
      if (list.length === 0) {
        // Dados iniciais se estiver vazio
        list = [
          { id: 1, nome: 'Maria Silva', cpf: '012.345.678-90', tel: '(74) 99123-4567', plano: 'Particular', nascimento: '1991-05-12', status: 'Ativo' },
          { id: 2, nome: 'João Pereira', cpf: '101.234.567-89', tel: '(74) 90012-3456', plano: 'Particular', nascimento: '1997-08-20', status: 'Ativo' },
          { id: 3, nome: 'Ana Beatriz Santos', cpf: '112.345.678-90', tel: '(74) 99123-0001', plano: 'Unimed', nascimento: '1985-03-15', status: 'Ativo' },
        ];
        FakeDB.save('pacientes', list);
      }
      return list;
    },
    get(id) {
      return this.list().find(p => p.id == id);
    }
  },

  // PROCEDIMENTOS (Odontograma)
  procedimentos: {
    list(pacienteId) {
      const all = FakeDB.get('procedimentos', []);
      return all.filter(p => p.pacienteId == pacienteId);
    },
    save(proc) {
      const all = FakeDB.get('procedimentos', []);
      if (proc.id) {
        const idx = all.findIndex(p => p.id === proc.id);
        all[idx] = proc;
      } else {
        proc.id = Date.now();
        all.push(proc);
      }
      FakeDB.save('procedimentos', all);
      return proc;
    },
    remove(id) {
      const all = FakeDB.get('procedimentos', []);
      const filtered = all.filter(p => p.id !== id);
      FakeDB.save('procedimentos', filtered);
    }
  },

  // ANAMNESES
  anamneses: {
    list(pacienteId) {
      const all = FakeDB.get('anamneses', []);
      return all.filter(a => a.pacienteId == pacienteId);
    },
    save(anamnese) {
      const all = FakeDB.get('anamneses', []);
      anamnese.id = Date.now();
      anamnese.data = new Date().toISOString().split('T')[0];
      all.push(anamnese);
      FakeDB.save('anamneses', all);
      return anamnese;
    }
  },

  // FINANCEIRO
  financeiro: {
    list() {
      return FakeDB.get('financeiro', [
        { id: 1, data: '2026-04-17', desc: 'Consulta de retorno', pacienteId: 1, forma: 'PIX', cat: 'Consulta', valor: 150, tipo: 'receita', status: 'Pago' },
        { id: 2, data: '2026-04-16', desc: 'Sessão clareamento', pacienteId: 3, forma: 'Cartão de Crédito', cat: 'Procedimento', valor: 550, tipo: 'receita', status: 'Pago' },
      ]);
    },
    add(item) {
      const all = this.list();
      item.id = Date.now();
      all.push(item);
      FakeDB.save('financeiro', all);
      return item;
    }
  },

  // AGENDAMENTOS
  agendamentos: {
    list() {
      let list = FakeDB.get('agendamentos', []);
      if (list.length === 0) {
        list = [
          { id: 1, dia: 0, hora: 8,  min: 0,  dur: 30, paciente: 'Maria Silva',        proc: 'Retorno',        status: 'confirmado' },
          { id: 2, dia: 0, hora: 9,  min: 0,  dur: 45, paciente: 'João Pereira',       proc: 'Extração',       status: 'pendente'   },
          { id: 3, dia: 0, hora: 10, min: 30, dur: 60, paciente: 'Ana Beatriz Santos', proc: 'Clareamento',    status: 'confirmado' },
          { id: 4, dia: 0, hora: 14, min: 0,  dur: 30, paciente: 'Carlos Mendes',      proc: 'Ortodontia',     status: 'confirmado' },
          { id: 5, dia: 0, hora: 15, min: 30, dur: 60, paciente: 'Fernanda Lima',      proc: 'Implante — Aval.', status: 'pendente' },
          { id: 6, dia: 2, hora: 9,  min: 0,  dur: 30, paciente: 'Roberta Nunes',      proc: 'Limpeza',        status: 'confirmado' },
          { id: 7, dia: 2, hora: 11, min: 0,  dur: 45, paciente: 'Paulo César',        proc: 'Canal',          status: 'confirmado' },
          { id: 8, dia: 3, hora: 10, min: 0,  dur: 30, paciente: 'Larissa Mota',       proc: 'Restauração',    status: 'pendente'   },
          { id: 9, dia: 4, hora: 8,  min: 30, dur: 60, paciente: 'Bruno Alves',        proc: 'Prótese',        status: 'confirmado' },
        ];
        FakeDB.save('agendamentos', list);
      }
      return list;
    },
    get(id) {
      return this.list().find(a => a.id == id);
    },
    save(appt) {
      const all = this.list();
      if (appt.id) {
        const idx = all.findIndex(a => a.id == appt.id);
        if (idx !== -1) all[idx] = appt;
        else all.push(appt);
      } else {
        appt.id = Date.now();
        all.push(appt);
      }
      FakeDB.save('agendamentos', all);
      return appt;
    }
  }
};

window.FakeDB = FakeDB;
